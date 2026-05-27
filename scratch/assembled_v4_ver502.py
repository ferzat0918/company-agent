import threading
import logging
from logging.handlers import RotatingFileHandler
from queue import Queue
from concurrent.futures import ThreadPoolExecutor
import re
from wxauto4 import WeChat

# === Configuration ===
LANGGRAPH_API_URL = "http://localhost:2024"
JWT_SECRET = "dev-jwt-secret-key-at-least-32-chars-long!!"
FREDDY_SUB_UUID = "d81a0391-2663-4f0b-ba89-39f17773a9a1"
ASSISTANT_ID = "company_agent"
MAX_WORKERS = 5              # Max concurrent AI thinking threads
POLL_INTERVAL = 1.5          # Main UI poll interval (seconds)
RETRY_MAX = 3                # LangGraph request retries
RETRY_BACKOFF = 2            # Base multiplier for exponential backoff

# === Logging Setup ===
# Configure root logger for third-party libraries (httpx, etc.)
root_logger = logging.getLogger()
root_logger.setLevel(logging.WARNING)

logger = logging.getLogger("wechat_rpa")
logger.setLevel(logging.INFO)
logger.propagate = False

# Formatter with thread information
formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] (%(threadName)s) %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Rotate files at 5MB, keep 5 backup files
file_handler = RotatingFileHandler(
    "logs/rpa_client.log",
    maxBytes=5 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8"
)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Colorful stdout formatting for console
class ConsoleColorFormatter(logging.Formatter):
    COLOR_MAP = {
        logging.DEBUG: "\033[36m",     # Cyan
        logging.INFO: "\033[32m",      # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[41;37m" # Red BG, White FG
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLOR_MAP.get(record.levelno, "")
        message = super().format(record)
        if color:
            return f"{color}{message}{self.RESET}"
        return message

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ConsoleColorFormatter(
    "%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
))
logger.addHandler(console_handler)
root_logger.addHandler(console_handler)

os.makedirs("logs", exist_ok=True)

# === Thread-Safe State & Queues ===
reply_queue = Queue()            # Outgoing AI responses to be typed/sent: (chat_name, reply_text, target_files)
thinking_chats = set()          # Currently processing chats to prevent double-polling
thinking_lock = threading.Lock() # Lock to synchronize thinking_chats
chat_queues = {}                 # chat_name -> list of (sender, content)
queues_lock = threading.Lock()   # Lock to synchronize chat_queues
listen_chats = []                # Target chats to whitelist (configured at startup)

# Background Thread Pool for LangGraph workers
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="AIWorker")

# Global WeChat binder
wx = None

def gen_supabase_jwt():
    payload = {
        "iss": "supabase",
        "sub": FREDDY_SUB_UUID,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600 * 24 * 365,  # 1 year expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def invoke_langgraph_with_retry(chat_name: str, prompt: str, channel: str = "wechat", sender: str = "未知发送者") -> tuple[str, list[str]]:
    """Invokes LangGraph and intercepts tool calls for send_wechat_file in the run stream."""
    namespace = uuid.UUID(FREDDY_SUB_UUID)
    thread_id = str(uuid.uuid5(namespace, chat_name))
    jwt_token = gen_supabase_jwt()
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    body = {
        "assistant_id": ASSISTANT_ID,
        "input": {
            "messages": [{"type": "human", "content": prompt}]
        },
        "config": {
            "metadata": {
                "channel": channel,
                "chat_name": chat_name,
                "sender": sender
            },
            "configurable": {
                "channel": channel,
                "chat_name": chat_name,
                "sender": sender
            }
        },
        "stream_mode": ["values"],
        "stream_subgraphs": True
    }

    # First ensure thread exists
    with httpx.Client() as client:
        try:
            client.post(
                f"{LANGGRAPH_API_URL}/threads",
                json={"thread_id": thread_id, "metadata": {}},
                headers=headers,
                timeout=5.0
            )
        except Exception:
            pass  # Thread already provisioned

    # Retry loop for LLM execution
    for attempt in range(1, RETRY_MAX + 1):
        try:
            logger.info(f"发送请求给 AI Agent (尝试 {attempt}/{RETRY_MAX})...")
            full_response = ""
            target_files = []
            printed_message_ids = set()
            with httpx.Client() as client:
                with client.stream(
                    "POST",
                    f"{LANGGRAPH_API_URL}/threads/{thread_id}/runs/stream",
                    json=body,
                    headers=headers,
                    timeout=90.0  # Safe timeout for complex deep thinking & sandboxed runs
                ) as response:
                    if response.status_code != 200:
                        raise httpx.HTTPStatusError(
                            f"HTTP {response.status_code}",
                            request=None,
                            response=response
                        )
                    
                    for line in response.iter_lines():
                        decoded = line.strip()
                        if decoded.startswith("data:"):
                            data_str = decoded[5:].strip()
                            if data_str:
                                try:
                                    chunk = json.loads(data_str)
                                    if isinstance(chunk, dict) and "messages" in chunk:
                                        msgs = chunk["messages"]
                                        for m in msgs:
                                            if isinstance(m, dict):
                                                msg_id = m.get("id") or f"{m.get('type')}_{m.get('name')}_{len(str(m.get('content', '')))}"
                                                if msg_id not in printed_message_ids:
                                                    printed_message_ids.add(msg_id)
                                                    
                                                    m_type = m.get("type")
                                                    m_name = m.get("name")
                                                    m_content = m.get("content", "")
                                                    
                                                    if m_type == "ai":
                                                        tool_calls = m.get("tool_calls", [])
                                                        if tool_calls:
                                                            for tc in tool_calls:
                                                                logger.info(f"🔮 [AI 决定调用工具] -> {tc.get('name')}({json.dumps(tc.get('args', {}), ensure_ascii=False)})")
                                                        elif m_content:
                                                            preview = m_content.strip().replace("\n", " ")
                                                            if len(preview) > 60:
                                                                preview = preview[:60] + "..."
                                                            logger.info(f"🤖 [AI 正在生成回复] -> \"{preview}\"")
                                                    elif m_type == "tool":
                                                        preview = str(m_content).strip().replace("\n", " ")
                                                        if len(preview) > 80:
                                                            preview = preview[:80] + "..."
# MISSING LINE 194
# MISSING LINE 195
# MISSING LINE 196
# MISSING LINE 197
# MISSING LINE 198
# MISSING LINE 199
# MISSING LINE 200
# MISSING LINE 201
# MISSING LINE 202
# MISSING LINE 203
# MISSING LINE 204
# MISSING LINE 205
# MISSING LINE 206
# MISSING LINE 207
# MISSING LINE 208
# MISSING LINE 209
# MISSING LINE 210
# MISSING LINE 211
# MISSING LINE 212
# MISSING LINE 213
# MISSING LINE 214
# MISSING LINE 215
# MISSING LINE 216
# MISSING LINE 217
# MISSING LINE 218
# MISSING LINE 219
# MISSING LINE 220
# MISSING LINE 221
# MISSING LINE 222
# MISSING LINE 223
# MISSING LINE 224
# MISSING LINE 225
# MISSING LINE 226
# MISSING LINE 227
# MISSING LINE 228
# MISSING LINE 229
# MISSING LINE 230
# MISSING LINE 231
# MISSING LINE 232
# MISSING LINE 233
# MISSING LINE 234
# MISSING LINE 235
# MISSING LINE 236
# MISSING LINE 237
# MISSING LINE 238
# MISSING LINE 239
# MISSING LINE 240
# MISSING LINE 241
# MISSING LINE 242
# MISSING LINE 243
# MISSING LINE 244
# MISSING LINE 245
# MISSING LINE 246
# MISSING LINE 247
# MISSING LINE 248
# MISSING LINE 249
# MISSING LINE 250
# MISSING LINE 251
# MISSING LINE 252
# MISSING LINE 253
# MISSING LINE 254
# MISSING LINE 255
# MISSING LINE 256
# MISSING LINE 257
# MISSING LINE 258
# MISSING LINE 259
# MISSING LINE 260
# MISSING LINE 261
# MISSING LINE 262
# MISSING LINE 263
# MISSING LINE 264
# MISSING LINE 265
# MISSING LINE 266
# MISSING LINE 267
# MISSING LINE 268
# MISSING LINE 269
# MISSING LINE 270
# MISSING LINE 271
# MISSING LINE 272
# MISSING LINE 273
# MISSING LINE 274
# MISSING LINE 275
# MISSING LINE 276
# MISSING LINE 277
# MISSING LINE 278
# MISSING LINE 279
# MISSING LINE 280
# MISSING LINE 281
# MISSING LINE 282
# MISSING LINE 283
# MISSING LINE 284
# MISSING LINE 285
# MISSING LINE 286
# MISSING LINE 287
# MISSING LINE 288
# MISSING LINE 289
# MISSING LINE 290
# MISSING LINE 291
# MISSING LINE 292
# MISSING LINE 293
# MISSING LINE 294
# MISSING LINE 295
# MISSING LINE 296
# MISSING LINE 297
# MISSING LINE 298
# MISSING LINE 299
# MISSING LINE 300
# MISSING LINE 301
# MISSING LINE 302
# MISSING LINE 303
# MISSING LINE 304
# MISSING LINE 305
# MISSING LINE 306
# MISSING LINE 307
# MISSING LINE 308
# MISSING LINE 309
# MISSING LINE 310
# MISSING LINE 311
# MISSING LINE 312
# MISSING LINE 313
# MISSING LINE 314
# MISSING LINE 315
# MISSING LINE 316
# MISSING LINE 317
# MISSING LINE 318
# MISSING LINE 319
# MISSING LINE 320
# MISSING LINE 321
# MISSING LINE 322
# MISSING LINE 323
# MISSING LINE 324
# MISSING LINE 325
# MISSING LINE 326
# MISSING LINE 327
# MISSING LINE 328
# MISSING LINE 329
# MISSING LINE 330
# MISSING LINE 331
# MISSING LINE 332
# MISSING LINE 333
# MISSING LINE 334
# MISSING LINE 335
# MISSING LINE 336
# MISSING LINE 337
# MISSING LINE 338
# MISSING LINE 339
# MISSING LINE 340
# MISSING LINE 341
# MISSING LINE 342
# MISSING LINE 343
# MISSING LINE 344
# MISSING LINE 345
# MISSING LINE 346
# MISSING LINE 347
# MISSING LINE 348
# MISSING LINE 349
# MISSING LINE 350
# MISSING LINE 351
# MISSING LINE 352
# MISSING LINE 353
# MISSING LINE 354
# MISSING LINE 355
# MISSING LINE 356
# MISSING LINE 357
# MISSING LINE 358
# MISSING LINE 359
# MISSING LINE 360
# MISSING LINE 361
# MISSING LINE 362
# MISSING LINE 363
# MISSING LINE 364
# MISSING LINE 365
# MISSING LINE 366
# MISSING LINE 367
# MISSING LINE 368
# MISSING LINE 369
# MISSING LINE 370
# MISSING LINE 371
# MISSING LINE 372
# MISSING LINE 373
# MISSING LINE 374
# MISSING LINE 375
# MISSING LINE 376
# MISSING LINE 377
# MISSING LINE 378
# MISSING LINE 379
# MISSING LINE 380
# MISSING LINE 381
# MISSING LINE 382
# MISSING LINE 383
# MISSING LINE 384
# MISSING LINE 385
# MISSING LINE 386
# MISSING LINE 387
# MISSING LINE 388
# MISSING LINE 389
# MISSING LINE 390
# MISSING LINE 391
# MISSING LINE 392
# MISSING LINE 393
                                                        logger.info(f"🛠️ [工具执行完毕] {m_name or '匿名工具'} -> 结果: {preview}")
                                                
                                                # Standard parsing logic
                                                if m.get("type") == "ai":
                                                    c = m.get("content", "")
                                                    if c:
                                                        full_response = c
                                                elif m.get("type") == "tool" and m.get("name") == "send_wechat_file":
                                                    content = m.get("content", "")
                                                    if content.startswith("[WECHAT_FILE_PUSH]:"):
                                                        filepath = content.split(":", 1)[1].strip()
                                                        if filepath not in target_files:
                                                            target_files.append(filepath)
                                except Exception:
                                    pass
            if full_response:
                return full_response, target_files
            raise ValueError("未收到有效回复数据")
            
        except Exception as e:
            logger.warning(f"请求失败 (尝试 {attempt}/{RETRY_MAX}): {e}")
            if attempt == RETRY_MAX:
                logger.error(f"经历 {RETRY_MAX} 次尝试后最终失败。")
                return f"⚠️ 抱歉，智能服务暂时有些拥堵，请稍后再试（错误：{e}）", []
            sleep_time = RETRY_BACKOFF ** attempt
            logger.info(f"等待 {sleep_time} 秒后重试...")
            time.sleep(sleep_time)
            
    return "系统发生未知异常，请重试。", []

def trigger_thinking_for_chat(chat_name: str):
    """Triggers the AI thinking worker for a chat room if it is not already running."""
    with thinking_lock:
        if chat_name in thinking_chats:
            # Already active, let the sequential consumer trigger next runs
            return
        thinking_chats.add(chat_name)
    
    # Safely extract all pending messages from the queue
    with queues_lock:
        queue = chat_queues.get(chat_name, [])
        if not queue:
            # Nothing in queue, release lock
            with thinking_lock:
                thinking_chats.discard(chat_name)
            return
        
        # Check if this chat room is a group chat (sender != chat_name)
        is_group = (chat_name != "文件传输助手" and any(sender != chat_name for sender, _ in queue))
        
        if is_group:
            # In group chats, process messages one-by-one sequentially to avoid sender-level conflicts
            sender, content = queue.pop(0)
            merged_contents = [f"[{sender}]: {content}"]
            primary_sender = sender
            logger.info(f"📩 [群聊队列排队] 从群聊 [{chat_name}] 队列中提取出 [{sender}] 的独立请求，其中发言内容已标记发送者，剩余待处理数: {len(queue)}")
        else:
            # For private chats, merge all currently queued messages for cohesive context
            merged_contents = []
            primary_sender = chat_name
            for sender, content in queue:
                if sender != "未知发送者":
                    primary_sender = sender
                merged_contents.append(content)
            # Clear the queue for this run
            chat_queues[chat_name] = []
        
    combined_prompt = "\n".join(merged_contents)
    logger.info(f"🚀 [触发AI思考] [{chat_name}] 发起请求 (发言人: [{primary_sender}])：\n{combined_prompt}")
    
    # Dispatch thinking to background ThreadPool
    executor.submit(async_think_worker, chat_name, combined_prompt, "wechat", primary_sender)

def async_think_worker(chat_name: str, prompt: str, channel: str = "wechat", sender: str = "未知发送者"):
    """Worker task executed in the ThreadPool to query the AI asynchronously."""
    logger.info(f"🚀 [思考开始] 正在处理来自 [{chat_name}] 的消息...")
    start_time = time.time()
    try:
        reply, target_files = invoke_langgraph_with_retry(chat_name, prompt, channel, sender)
        elapsed = time.time() - start_time
        logger.info(f"✨ [思考完成] [{chat_name}] 耗时 {elapsed:.2f}s")
        # Enqueue reply for the UI thread to consume
        reply_queue.put((chat_name, reply, target_files))
    except Exception as e:
        logger.error(f"❌ [思考出错] [{chat_name}] 异常: {e}")
        # Remove from locking set to allow user to retry if thread crashes
        with thinking_lock:
            thinking_chats.discard(chat_name)
        # Check if there are other messages in queue to process
        with queues_lock:
            has_more = bool(chat_queues.get(chat_name))
        if has_more:
            trigger_thinking_for_chat(chat_name)

def bind_wechat() -> bool:
    """Attempts to bind to the local PC WeChat client. Returns True if successful."""
    global wx
    try:
        wx = WeChat()
        logger.info("🟢 成功绑定本地 PC 微信客户端！")
        return True
    except Exception as e:
        logger.error(f"🔴 绑定微信窗口失败！原因: {e}")
        return False

def self_healing_reconnect():
    """Enters a polling loop to rebind WeChat after a GUI crash or closure."""
    global wx
    wx = None
    logger.warning("🚨 [自愈模式激活] 微信客户端连接中断！系统进入静默重连轮询中...")
    while True:
        logger.info("🔍 尝试重新搜索并绑定本地微信客户端...")
        if bind_wechat():
            logger.info("🎉 [自愈成功] 微信客户端成功恢复连接！正在重启未读监听机制...")
            break
        logger.info("⏳ 绑定失败，将在 5 秒后继续重试...")
        time.sleep(5)

def main():
    global listen_chats
    print("=" * 75)
    print("🤖 WeChat PC 4.x RPA + LangGraph 生产级多线程自愈守护进程")
    print("=" * 75)
    print("💡 部署要点：")
    print("   1. 请确保您的 Windows 电脑上已登录官方 PC 版微信 4.x 客户端。")
    print("   2. 请确保微信窗口处于可见状态（不可最小化至系统托盘，建议常驻背景或半屏显示）。")
    print("   3. 所有网络请求异步并发执行，主 GUI 操作单线程排队，绝无竞态冲突。")
    print("=" * 75)

    # Initial WeChat bind
    if not bind_wechat():
        logger.warning("首次绑定失败，进入自愈自动搜索程序...")
        self_healing_reconnect()

    listen_env = os.environ.get("LISTEN_CHATS", "").strip()
    if listen_env:
        listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
        logger.info(f"🚀 [环境变量配置] 已设定专属监听名单：{listen_chats}")
    else:
        print("\n📝 配置监听列表 (请输入您希望自动回复的好友备注名或微信群聊全称，多项用英文逗号分隔)：")
        print("💡 若直接按回车，将开启全局智能回复监听 (⚠️ 警告: 所有新消息均会被自动回复)。")
        listen_input = input("👉 监听名单: ").strip()
        
        if listen_input:
            listen_chats = [item.strip() for item in listen_input.split(",") if item.strip()]
            logger.info(f"🚀 已设定专属监听名单：{listen_chats}")
        else:
            logger.info("🚀 开启全局自动回复监听模式 (无白名单限制)")

    logger.info("⚡ 微信 RPA 生产级服务已正式启动，按 Ctrl+C 可安全退出。")
    
    while True:
        # === 1. UI Thread Consumer: Consume ready AI replies from the queue ===
        try:
            while not reply_queue.empty():
                chat_name, reply, target_files = reply_queue.get_nowait()
                logger.info(f"📤 [UI 发送队列] 正在回复给 [{chat_name}]...")
                
                # Active UI interaction to switch and send msg
                wx.ChatWith(chat_name)
                time.sleep(0.3)
                
                # Send text reply
                wx.SendMsg(reply)
                logger.info(f"✅ 文字消息成功送达！[{chat_name}]")
                
                # If we intercepted explicit file sending tool calls
                if target_files:
                    logger.info(f"📂 [RPA 工具雷达] 拦截到大模型显式发送文件请求，共 {len(target_files)} 个...")
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    workspace_dir = os.path.join(script_dir, "workspace")
                    
                    # Compute thread_id dynamically to locate the thread-isolated folder
                    namespace = uuid.UUID(FREDDY_SUB_UUID)
                    thread_id = str(uuid.uuid5(namespace, chat_name))
                    
                    for filepath in target_files:
                        # Clean prefix, keep the subfolder structure (e.g. umx-logo/logo-full.svg)
                        rel_path = filepath.replace("/workspace/", "", 1)
                        
                        # Generate 4 robust lookup paths to prevent any subdirectory or thread-isolation mismatch
                        lookups = [
                            # A: Thread-isolated exact path (e.g. workspace/<thread_id>/umx-logo/logo-full.svg)
                            os.path.join(workspace_dir, thread_id, rel_path),
                            # B: Thread-isolated basename fallback (e.g. workspace/<thread_id>/logo-full.svg)
                            os.path.join(workspace_dir, thread_id, os.path.basename(rel_path)),
                            # C: Root workspace exact path (e.g. workspace/umx-logo/logo-full.svg)
                            os.path.join(workspace_dir, rel_path),
                            # D: Root workspace basename fallback (e.g. workspace/logo-full.svg)
                            os.path.join(workspace_dir, os.path.basename(rel_path))
                        ]
                        
                        local_filepath = None
                        for path in lookups:
                            # Normalize path slashes for Windows compatibility
                            path = os.path.normpath(path)
                            if os.path.exists(path):
                                local_filepath = path
                                break
                        
# MISSING LINE 594
# MISSING LINE 595
# MISSING LINE 596
# MISSING LINE 597
# MISSING LINE 598
# MISSING LINE 599
# MISSING LINE 600
# MISSING LINE 601
# MISSING LINE 602
# MISSING LINE 603
# MISSING LINE 604
# MISSING LINE 605
# MISSING LINE 606
# MISSING LINE 607
# MISSING LINE 608
# MISSING LINE 609
# MISSING LINE 610
# MISSING LINE 611
# MISSING LINE 612
# MISSING LINE 613
# MISSING LINE 614
# MISSING LINE 615
# MISSING LINE 616
# MISSING LINE 617
# MISSING LINE 618
# MISSING LINE 619
# MISSING LINE 620
# MISSING LINE 621
# MISSING LINE 622
# MISSING LINE 623
# MISSING LINE 624
# MISSING LINE 625
# MISSING LINE 626
# MISSING LINE 627
# MISSING LINE 628
# MISSING LINE 629
# MISSING LINE 630
# MISSING LINE 631
# MISSING LINE 632
# MISSING LINE 633
# MISSING LINE 634
# MISSING LINE 635
# MISSING LINE 636
# MISSING LINE 637
# MISSING LINE 638
# MISSING LINE 639
# MISSING LINE 640
# MISSING LINE 641
# MISSING LINE 642
# MISSING LINE 643
# MISSING LINE 644
# MISSING LINE 645
# MISSING LINE 646
# MISSING LINE 647
# MISSING LINE 648
# MISSING LINE 649
# MISSING LINE 650
# MISSING LINE 651
# MISSING LINE 652
# MISSING LINE 653
# MISSING LINE 654
# MISSING LINE 655
# MISSING LINE 656
# MISSING LINE 657
# MISSING LINE 658
# MISSING LINE 659
# MISSING LINE 660
# MISSING LINE 661
# MISSING LINE 662
# MISSING LINE 663
# MISSING LINE 664
# MISSING LINE 665
# MISSING LINE 666
# MISSING LINE 667
# MISSING LINE 668
# MISSING LINE 669
# MISSING LINE 670
# MISSING LINE 671
# MISSING LINE 672
# MISSING LINE 673
# MISSING LINE 674
# MISSING LINE 675
# MISSING LINE 676
# MISSING LINE 677
# MISSING LINE 678
# MISSING LINE 679
# MISSING LINE 680
# MISSING LINE 681
# MISSING LINE 682
# MISSING LINE 683
# MISSING LINE 684
# MISSING LINE 685
# MISSING LINE 686
# MISSING LINE 687
# MISSING LINE 688
# MISSING LINE 689
# MISSING LINE 690
# MISSING LINE 691
# MISSING LINE 692
# MISSING LINE 693
# MISSING LINE 694
# MISSING LINE 695
# MISSING LINE 696
# MISSING LINE 697
# MISSING LINE 698
# MISSING LINE 699
# MISSING LINE 700
# MISSING LINE 701
# MISSING LINE 702
# MISSING LINE 703
# MISSING LINE 704
# MISSING LINE 705
# MISSING LINE 706
# MISSING LINE 707
# MISSING LINE 708
# MISSING LINE 709
# MISSING LINE 710
# MISSING LINE 711
# MISSING LINE 712
# MISSING LINE 713
# MISSING LINE 714
# MISSING LINE 715
# MISSING LINE 716
# MISSING LINE 717
# MISSING LINE 718
# MISSING LINE 719
# MISSING LINE 720
# MISSING LINE 721
# MISSING LINE 722
# MISSING LINE 723
# MISSING LINE 724
# MISSING LINE 725
# MISSING LINE 726
# MISSING LINE 727
# MISSING LINE 728
# MISSING LINE 729
# MISSING LINE 730
# MISSING LINE 731
# MISSING LINE 732
# MISSING LINE 733
# MISSING LINE 734
# MISSING LINE 735
# MISSING LINE 736
# MISSING LINE 737
# MISSING LINE 738
# MISSING LINE 739
# MISSING LINE 740
# MISSING LINE 741
# MISSING LINE 742
# MISSING LINE 743
# MISSING LINE 744
# MISSING LINE 745
# MISSING LINE 746
# MISSING LINE 747
# MISSING LINE 748
# MISSING LINE 749
# MISSING LINE 750
# MISSING LINE 751
# MISSING LINE 752
# MISSING LINE 753
# MISSING LINE 754
# MISSING LINE 755
# MISSING LINE 756
# MISSING LINE 757
# MISSING LINE 758
# MISSING LINE 759
# MISSING LINE 760
# MISSING LINE 761
# MISSING LINE 762
# MISSING LINE 763
# MISSING LINE 764
# MISSING LINE 765
# MISSING LINE 766
# MISSING LINE 767
# MISSING LINE 768
# MISSING LINE 769
# MISSING LINE 770
# MISSING LINE 771
# MISSING LINE 772
# MISSING LINE 773
# MISSING LINE 774
# MISSING LINE 775
# MISSING LINE 776
# MISSING LINE 777
# MISSING LINE 778
# MISSING LINE 779
# MISSING LINE 780
# MISSING LINE 781
# MISSING LINE 782
# MISSING LINE 783
# MISSING LINE 784
# MISSING LINE 785
# MISSING LINE 786
# MISSING LINE 787
# MISSING LINE 788
# MISSING LINE 789
# MISSING LINE 790
# MISSING LINE 791
# MISSING LINE 792
# MISSING LINE 793
                        if local_filepath:
                            logger.info(f"   - 正在提取并传输文件: {local_filepath}")
                            time.sleep(1.0)  # Settle UI
                            wx.SendFiles(local_filepath)
                            logger.info(f"   🎉 文件 [{os.path.basename(local_filepath)}] 成功推送给 [{chat_name}]！")
                        else:
                            logger.warning(f"   ⚠️ 未在本地工作区找到匹配文件。尝试过的路径:")
                            for p in lookups:
                                logger.warning(f"     - {os.path.normpath(p)}")
                
                # Release lock on this chat room to allow future messages
                with thinking_lock:
                    thinking_chats.discard(chat_name)
                
                # Check if new messages arrived in the queue during AI thinking, and trigger next sequential run!
                with queues_lock:
                    has_more = bool(chat_queues.get(chat_name))
                if has_more:
                    logger.info(f"🔄 [{chat_name}] 在AI思考期间收到了新消息，自动触发下一轮顺序回复...")
                    trigger_thinking_for_chat(chat_name)
                    
        except Exception as e:
            logger.error(f"💥 UI发送阶段发生致命异常: {e}")
            self_healing_reconnect()
            continue

        # === 2. UI Thread Producer: Poll WeChat for unread messages ===
        try:
            sessions = wx.GetSession()
            for s in sessions:
                # Identify sessions with unread messages
                if s.isnew:
                    # Whitelist check
                    if listen_chats and s.name not in listen_chats:
                        continue
                    
                    logger.info(f"💬 收到 [{s.name}] 的未读消息！进行 UI 切换读取中...")
                    wx.ChatWith(s.name)
                    time.sleep(0.4)
                    
                    msgs = wx.GetAllMessage()
                    if not msgs:
                        continue
                    
                    new_count = s.new_count if s.new_count > 0 else 1
                    unread_msgs = msgs[-new_count:]
                    
                    # Extract and validate unread messages
                    valid_msgs = []
                    for m in unread_msgs:
                        # Loopback protection: Filter out self messages (except in File Transfer Helper for self testing)
                        if m.attr == "self" and s.name != "文件传输助手":
                            continue
                        if m.attr == "system" or m.type == "time":
                            continue
                        
                        # Group chat check: if it is a group chat message, it MUST @ us!
                        # We identify group chat messages when s.name (session name) is different from m.sender (sender name)
                        is_group_msg = (m.sender != s.name and s.name != "文件传输助手")
                        content = m.content
                        
                        if is_group_msg:
                            our_name = wx.nickname if (wx and hasattr(wx, "nickname")) else "扎特 Freddy"
                            mention_1 = f"@{our_name}"
                            mention_2 = f"@{our_name.split()[-1]}" if our_name and len(our_name.split()) > 1 else mention_1
                            
                            # Perform mention check
                            if mention_1 not in content and mention_2 not in content:
                                continue
                                
                            logger.info(f"🔔 [群聊@提醒] 在群聊 [{s.name}] 中收到来自 [{m.sender}] 的 @ 提问！")
                            # Clean up the @ mention prefix and WeChat zero-width spaces (\u2005) for better prompt quality
                            content = content.replace(mention_1, "").replace(mention_2, "").replace("\u2005", "").strip()

                        valid_msgs.append((m.sender, content))
                    
                    if not valid_msgs:
                        continue
                    
                    # Add to chat room sequential queue
                    with queues_lock:
                        if s.name not in chat_queues:
                            chat_queues[s.name] = []
                        chat_queues[s.name].extend(valid_msgs)
                        logger.info(f"📩 [{s.name}] 队列新增 {len(valid_msgs)} 条消息，当前队列长度: {len(chat_queues[s.name])}")
                    
                    # Trigger sequential AI execution
                    trigger_thinking_for_chat(s.name)
                        
        except KeyboardInterrupt:
            logger.info("👋 收到退出指令，微信 RPA 监听守护进程已安全停止。")
            break
        except Exception as e:
            logger.error(f"💥 监听主循环捕获未知错误: {e}")
            self_healing_reconnect()
            continue
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

