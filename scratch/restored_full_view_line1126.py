Created At: 2026-05-26T08:17:34Z
Completed At: 2026-05-26T08:17:34Z
File Path: `file:///C:/Users/lenovo/company-agent/wechat_rpa_v4.py`
Total Lines: 502
Total Bytes: 24350
Showing lines 201 to 400
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
                        
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
