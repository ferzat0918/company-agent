import os
import sys
import time
import json
import uuid
import httpx
import jwt
import threading
import logging
from logging.handlers import RotatingFileHandler
from queue import Queue
from concurrent.futures import ThreadPoolExecutor
import re
from wxauto4 import WeChat
from dotenv import load_dotenv

# Load env variables at bootstrap
load_dotenv()

# === Configuration ===
LANGGRAPH_API_URL = os.environ.get("LANGGRAPH_API_URL") or "http://localhost:2024"
JWT_SECRET = os.environ.get("JWT_SECRET") or "dev-jwt-secret-key-at-least-32-chars-long!!"
SUPABASE_URL = os.environ.get("SUPABASE_URL") or "http://localhost:8000"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or ""
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

def gen_supabase_jwt(user_id: str):
    payload = {
        "iss": "supabase",
        "sub": user_id,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600 * 24 * 365,  # 1 year expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def check_wechat_binding(wechat_nickname: str) -> str | None:
    """根据微信发言人昵称向 Supabase REST 接口反查 profiles 绑定关系，获取 user_id"""
    if not wechat_nickname or wechat_nickname == "未知发送者":
        return None
    # 微信文件传输助手是调试利器，默认直通绑定 Freddy
    if wechat_nickname == "文件传输助手":
        return FREDDY_SUB_UUID
    try:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        url = f"{SUPABASE_URL}/rest/v1/profiles"
        params = {"wechat_nickname": f"eq.{wechat_nickname}", "select": "*"}
        with httpx.Client() as client:
            resp = client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    user_id = data[0].get("user_id")
                    logger.info(f"🔍 [安全反查] 微信发言人 [{wechat_nickname}] 成功匹配绑定系统用户: {user_id}")
                    return user_id
    except Exception as e:
        logger.error(f"🔴 [安全反查] 查询 profiles 发生异常: {e}")
    logger.warning(f"⚠️ [安全反查] 微信发言人 [{wechat_nickname}] 未在 profiles 表中绑定任何系统账号！")
    return None

def trigger_thread_summarize_and_archive(user_id: str, old_thread_id: str):
    """静默发送 __summarize_memory__ 并等待大模型高优先级同步总结，完成后归档 thread"""
    jwt_token = gen_supabase_jwt(user_id)
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    logger.info(f"💾 [记忆保护] 正在向旧活跃 Thread [{old_thread_id}] 同步发送记忆总结指令...")
    body = {
        "assistant_id": ASSISTANT_ID,
        "input": {
            "messages": [{"type": "human", "content": "__summarize_memory__"}]
        },
        "stream_mode": ["values"],
    }
    try:
        with httpx.Client() as client:
            with client.stream(
                "POST",
                f"{LANGGRAPH_API_URL}/threads/{old_thread_id}/runs/stream",
                json=body,
                headers=headers,
                timeout=180.0
            ) as response:
                if response.status_code == 200:
                    for line in response.iter_lines():
                        pass
            logger.info(f"✨ [记忆保护] 旧 Thread [{old_thread_id}] 的长期记忆自动提炼与归纳归集成功完成！")
    except Exception as e:
        logger.error(f"🔴 [记忆保护] 触发 __summarize_memory__ 时出错: {e}")
        
    logger.info(f"📦 正在标记旧活跃 Thread [{old_thread_id}] 为 is_active = false...")
    try:
        with httpx.Client() as client:
            resp = client.patch(
                f"{LANGGRAPH_API_URL}/threads/{old_thread_id}",
                json={
                    "metadata": {
                        "is_active": False
                    }
                },
                headers=headers,
                timeout=10.0
            )
            if resp.status_code == 200:
                logger.info(f"✅ 旧 Thread [{old_thread_id}] 成功归档。")
    except Exception as e:
        logger.error(f"🔴 归档旧 Thread [{old_thread_id}] 时出错: {e}")

def get_or_create_active_wechat_thread(user_id: str, chat_name: str, sender: str) -> str:
    """获取该用户当前活跃的 wechat 渠道会话 thread_id。
    1. 查找 metadata 中 channel == 'wechat', owner == user_id, is_active == true 且在 30 天内的 thread。
    2. 如果存在，直接复用。
    3. 如果超过 30 天或不存在活跃 thread，先自动触发旧活跃会话 of __summarize_memory__，然后再归档并开辟全新活跃 thread。
    """
    jwt_token = gen_supabase_jwt(user_id)
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    
    active_thread_id = None
    try:
        with httpx.Client() as client:
            body = {
                "metadata": {
                    "channel": "wechat",
                    "owner": user_id,
                    "sender": sender,
                    "is_active": True
                },
                "limit": 1
            }
            resp = client.post(f"{LANGGRAPH_API_URL}/threads/search", json=body, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                threads = resp.json().get("results", [])
                if threads:
                    active_thread_id = threads[0].get("thread_id")
                    created_at_str = threads[0].get("created_at")
                    
                    from datetime import datetime, timezone
                    try:
                        created_time = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        delta = (now - created_time).total_seconds()
                        if delta >= 30 * 86400:
                            logger.info(f"⏳ 检测到微信活跃 Thread [{active_thread_id}] 已建于 {created_at_str} (超过30天)，正在触发自动归档轮转...")
                            trigger_thread_summarize_and_archive(user_id, active_thread_id)
                            active_thread_id = None
                        else:
                            logger.info(f"🔄 微信活跃 Thread [{active_thread_id}] 在 30 天安全期内，直接复用。")
                    except Exception as parse_err:
                        logger.error(f"解析 Thread 时间出错: {parse_err}，强制新建 Thread。")
                        active_thread_id = None
    except Exception as e:
        logger.error(f"🔴 获取微信活跃 Thread 时出错: {e}")
        
    if active_thread_id:
        return active_thread_id
        
    new_thread_id = str(uuid.uuid4())
    logger.info(f"🆕 正在为用户 [{sender}] 开启全新活跃微信 Thread: [{new_thread_id}]")
    try:
        with httpx.Client() as client:
            resp = client.post(
                f"{LANGGRAPH_API_URL}/threads",
                json={
                    "thread_id": new_thread_id,
                    "metadata": {
                        "channel": "wechat",
                        "owner": user_id,
                        "chat_name": chat_name,
                        "sender": sender,
                        "is_active": True
                    }
                },
                headers=headers,
                timeout=10.0
            )
            if resp.status_code == 200:
                logger.info(f"✅ 成功创建并记录全新微信 Thread [{new_thread_id}]！")
                return new_thread_id
    except Exception as e:
        logger.error(f"🔴 创建微信全新 Thread 失败: {e}")
        
    return new_thread_id

def invoke_langgraph_with_retry(chat_name: str, prompt: str, channel: str = "wechat", sender: str = "未知发送者", user_id: str = FREDDY_SUB_UUID) -> tuple[str, list[str]]:
    """Invokes LangGraph and intercepts tool calls for send_wechat_file in the run stream."""
    # 动态获取或轮转 30 天活跃 Thread
    thread_id = get_or_create_active_wechat_thread(user_id, chat_name, sender)
    
    jwt_token = gen_supabase_jwt(user_id)
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
                "sender": sender,
                "owner": user_id
            },
            "configurable": {
                "channel": channel,
                "chat_name": chat_name,
                "sender": sender,
                "owner": user_id
            }
        },
        "stream_mode": ["values"],
        "stream_subgraphs": True
    }

    # Fetch existing message IDs to prevent repeating historical tool calls/logs
    history_message_ids = set()
    try:
        with httpx.Client() as client:
            state_resp = client.get(
                f"{LANGGRAPH_API_URL}/threads/{thread_id}/state",
                headers=headers,
                timeout=5.0
            )
            if state_resp.status_code == 200 and state_resp.json():
                state_data = state_resp.json()
                values = state_data.get("values", {})
                existing_msgs = values.get("messages", [])
                for m in existing_msgs:
                    if isinstance(m, dict) and m.get("id"):
                        history_message_ids.add(m["id"])
    except Exception as e:
        logger.warning(f"获取历史消息状态失败: {e}")

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
                                                
                                                # Ignore messages that already existed in thread history before this run
                                                if msg_id in history_message_ids:
                                                    continue
                                                    
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
                return full_response, target_files, thread_id
            raise ValueError("未收到有效回复数据")
            
        except Exception as e:
            logger.warning(f"请求失败 (尝试 {attempt}/{RETRY_MAX}): {e}")
            if attempt == RETRY_MAX:
                logger.error(f"经历 {RETRY_MAX} 次尝试后最终失败。")
                return f"⚠️ 抱歉，智能服务暂时有些拥堵，请稍后再试（错误：{e}）", [], thread_id
            sleep_time = RETRY_BACKOFF ** attempt
            logger.info(f"等待 {sleep_time} 秒后重试...")
            time.sleep(sleep_time)
            
    return "系统发生未知异常，请重试。", [], thread_id

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
        # 1. 微信发言人 strict 安全校验与绑定反查
        user_id = check_wechat_binding(sender)
        if not user_id:
            # 🛑 触发情况 B 安全拦截阻断，免调用大模型，直接友好引导
            block_reply = "抱歉，小U未在系统录入您的微信，请先前往 UMX Web 平台绑定您的微信账号，以加载您的专业个人档案和部门记忆哦。"
            logger.warning(f"🛑 [安全阻断] 拦截到未绑定微信发言人 [{sender}]，已推送引导绑定提示。")
            reply_queue.put((chat_name, block_reply, [], "blocked"))
            return
            
        reply, target_files, thread_id = invoke_langgraph_with_retry(chat_name, prompt, channel, sender, user_id)
        elapsed = time.time() - start_time
        logger.info(f"✨ [思考完成] [{chat_name}] 耗时 {elapsed:.2f}s")
        # Enqueue reply for the UI thread to consume
        reply_queue.put((chat_name, reply, target_files, thread_id))
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

    # Get and log self nickname for group @ mention detection
    bot_name = os.environ.get("BOT_WECHAT_NICKNAME") or (wx.nickname if (wx and hasattr(wx, "nickname")) else None) or "扎特 Freddy"
    logger.info(f"🤖 [机器人身份识别] 当前监听的微信群聊 @ 昵称为: [@{bot_name}] (如需修改，请在 .env 中设置 BOT_WECHAT_NICKNAME)")

    listen_env = os.environ.get("LISTEN_CHATS", "").strip()
    if listen_env:
        listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
        logger.info(f"🚀 [环境变量配置] 已设定专属监听名单：{listen_chats}")
    else:
        logger.info("🚀 [环境变量配置] 未在 .env 检测到 LISTEN_CHATS，自动切换为全局防灾回复模式 (监听所有新消息)")

    logger.info("⚡ 微信 RPA 生产级服务已正式启动，按 Ctrl+C 可安全退出。")
    
    while True:
        # === 1. UI Thread Consumer: Consume ready AI replies from the queue ===
        try:
            while not reply_queue.empty():
                chat_name, reply, target_files, thread_id = reply_queue.get_nowait()
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
                    
                    # Updated: Resolve workspace relative to project root
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    workspace_dir = os.path.abspath(os.path.join(script_dir, "..", "..", "workspace"))
                    
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
                    
                    # 采用高可靠自适应双重校验提取未读消息，防止 new_count 识别等错误
                    unread_msgs = []
                    for m in reversed(msgs):
                        if m.attr == "self" and s.name != "文件传输助手":
                            # 扫到自己发的消息，说明在此之前的他人消息都已处理过，停止扫描
                            break
                        if m.attr == "system" or m.type == "time":
                            continue
                        unread_msgs.insert(0, m)
                    
                    # Extract and validate unread messages
                    valid_msgs = []
                    # 优先从环境变量或 .env 中读取机器人自己的微信昵称，其次从 wxauto 属性中读取，最后兜底
                    bot_name = os.environ.get("BOT_WECHAT_NICKNAME") or (wx.nickname if (wx and hasattr(wx, "nickname")) else None) or "扎特 Freddy"
                    mention_1 = f"@{bot_name}"
                    mention_2 = f"@{bot_name.split()[-1]}" if bot_name and len(bot_name.split()) > 1 else mention_1

                    for m in unread_msgs:
                        # Double protection: Filter out self messages
                        if m.attr == "self" and s.name != "文件传输助手":
                            continue
                        
                        # Group chat check: if it is a group chat message, it MUST @ us!
                        is_group_msg = (m.sender != s.name and s.name != "文件传输助手")
                        content = m.content
                        
                        if is_group_msg:
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
