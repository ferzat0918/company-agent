import os
import sys
import time
import json
Total Bytes: 24350
import httpx
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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

                    new_file_push = settings.get("file_push_enabled", True)
                    
                    with config_sync_lock:
                        is_wechat_active = new_active
                        
                        # Sync listening mode with env fallback
                        if not new_mode:
                            new_mode = os.environ.get("LISTEN_MODE", "whitelist").strip().lower()
                        wechat_listen_mode = new_mode if new_mode in ["global", "whitelist"] else "whitelist"
                        
                        if listen_str.strip():
                            new_listen = [x.strip() for x in listen_str.split(",") if x.strip()]
                        else:
                            # Fallback to environment variable to avoid dangerous global listening
                            listen_env = os.environ.get("LISTEN_CHATS", "").strip()
                            listen_env = os.environ.get("LISTEN_CHATS", "").strip()
                            if listen_env:
                                new_listen = [x.strip() for x in listen_env.split(",") if x.strip()]
                            else:
                                new_listen = []
                        
                        listen_chats = new_listen
                        if new_prompt:
                            wechat_system_prompt = new_prompt
                        wechat_reply_delay = new_delay
                        wechat_group_at_only = new_at_only
                        wechat_file_push_enabled = new_file_push
                
                last_settings_sync = now
            
            # 2. Heartbeat (every 5 seconds)
            if now - last_heartbeat >= 5.0:
                with thinking_lock:
                    num_workers = len(thinking_chats)
                
                logs = get_recent_logs(20)
                
                current_status = "online"
                if wx is None:
                    current_status = "offline"
                
                nickname = ""
                if wx:
                    nickname = getattr(wx, "nickname", "")
                    if not nickname:
                        try:
                            # Attempt to get nickname via wx GetSelfInfo
                            info = wx.GetSelfInfo()
                            nickname = info.get("Name", "")
                        except:
                            nickname = "微信客户端"
                
                supabase.update_status(
                    client_status=current_status,
                    wechat_nickname=nickname,
                    active_workers=num_workers,
                    system_logs=logs
                )
                last_heartbeat = now
                
        except Exception as e:
            logger.warning(f"心跳与同步线程异常: {e}")
            
        time.sleep(1.0)

# Background Thread Pool for LangGraph workers
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="AIWorker")

# Global WeChat binder
wx = None

def gen_supabase_jwt():
    payload = {
        "iss": "supabase",
        "sub": FREDDY_SUB_UUID,
        "role": "authenticated",
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
        
        # Log successful execution to database history
        supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabase.insert_history(
            chat_name=chat_name,
            sender=sender,
            message=prompt,
            response=reply,
            status="success",
            elapsed_time=elapsed
        )
    except Exception as e:
        logger.error(f"❌ [思考出错] [{chat_name}] 异常: {e}")
        # Remove from locking set to allow user to retry if thread crashes
        with thinking_lock:
            thinking_chats.discard(chat_name)
        
        # Log failed execution to database history
        elapsed = time.time() - start_time
        supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabase.insert_history(
            chat_name=chat_name,
            sender=sender,
            message=prompt,
            response=f"Error: {e}",
            status="error",
            elapsed_time=elapsed
        )
        
        # Check if there are other messages in queue to process
        with queues_lock:
            has_more = bool(chat_queues.get(chat_name))
        if has_more:
            trigger_thinking_for_chat(chat_name)
                        if s.name not in chat_queues:
                            chat_queues[s.name] = []
                        chat_queues[s.name].extend(valid_msgs)
                        logger.info(f"📩 [{s.name}] 队列新增 {len(valid_msgs)} 条消息，当前队列长度: {len(chat_queues[s.name])}")
                    
                    # Trigger sequential AI execution
                    trigger_thinking_for_chat(s.name)
                        
        elapsed = time.time() - start_time
        supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabase.insert_history(
            chat_name=chat_name,
            sender=sender,
            message=prompt,
            response=f"Error: {e}",
            status="error",
            elapsed_time=elapsed
        )
        
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
    global listen_chats, is_wechat_active, wechat_listen_mode
    
    # 1. Load initial settings from Supabase
    supabase = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    initial_settings = supabase.fetch_settings()
    if initial_settings:
        is_wechat_active = initial_settings.get("is_active", True)
        listen_str = initial_settings.get("listen_chats", "")
        new_mode = initial_settings.get("listen_mode", "").strip().lower()
        
        # Load listen mode with env fallback
        if not new_mode:
            new_mode = os.environ.get("LISTEN_MODE", "whitelist").strip().lower()
        wechat_listen_mode = new_mode if new_mode in ["global", "whitelist"] else "whitelist"
        
        if listen_str.strip():
            listen_chats = [item.strip() for item in listen_str.split(",") if item.strip()]
        else:
            # Fallback to environment variable to avoid dangerous global listening
            listen_env = os.environ.get("LISTEN_CHATS", "").strip()
            if listen_env:
                listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
                logger.info(f"🚀 [数据库空值回退] 已回退至环境变量监控名单：{listen_chats}")
            else:
                logger.info("⚠️ [数据库配置] 未配置白名单列表，且无环境变量白名单回退")
                listen_chats = []
        logger.info(f"🚀 [数据库配置] 成功加载初始监听策略 (监听模式={wechat_listen_mode.upper()}, 状态={'启用' if is_wechat_active else '禁用'})：{listen_chats}")
    else:
        # Fallback
        new_mode = os.environ.get("LISTEN_MODE", "whitelist").strip().lower()
        wechat_listen_mode = new_mode if new_mode in ["global", "whitelist"] else "whitelist"
        listen_env = os.environ.get("LISTEN_CHATS", "").strip()
        if listen_env:
            listen_chats = [item.strip() for item in listen_env.split(",") if item.strip()]
            logger.info(f"🚀 [环境配置] 已设定监听名单：{listen_chats}")
        else:
            logger.info(f"🚀 [环境配置] 全局自动监听模式 (白名单为空)")
            listen_chats = []
        logger.info(f"🚀 [环境配置] 成功加载默认监听策略 (监听模式={wechat_listen_mode.upper()})：{listen_chats}")

    # 2. Start database heartbeat and configuration sync thread IMMEDIATELY
    # This guarantees that logs and errors are streamed to Supabase in real-time even when offline!
    sync_thread = threading.Thread(target=sync_supabase_settings_loop, daemon=True)
    sync_thread.start()

    print("=" * 75)
    print("🤖 WeChat PC 4.x RPA + LangGraph 生产级多线程自愈守护进程")
    print("=" * 75)
    print("💡 部署要点：")
    print("   1. 请确保您的 Windows 电脑上已登录官方 PC 版微信 4.x 客户端。")
    print("   2. 请确保微信窗口处于可见状态（不可最小化至系统托盘，建议常驻背景或半屏显示）。")
    print("   3. 所有网络请求异步并发执行，主 GUI 操作单线程排队，绝无竞态冲突。")
    print("=" * 75)

    # 3. Initial WeChat bind (which may block/retry indefinitely)
    if not bind_wechat():
        logger.warning("首次绑定失败，进入自愈自动搜索程序...")
        self_healing_reconnect()

    logger.info("⚡ 微信 RPA 生产级服务已正式启动，按 Ctrl+C 可安全退出。")
                
                # Send text reply
                wx.SendMsg(reply)
                logger.info(f"✅ 文字消息成功送达！[{chat_name}]")
                
                # If we intercepted explicit file sending tool calls
                if target_files:
                    with config_sync_lock:
                        file_push_allowed = wechat_file_push_enabled
                    
                    if not file_push_allowed:
                        logger.warning("🚫 [RPA 工具雷达] 大模型试图发送文件，但自动文件发送功能已在后台被管理员禁用！")
                        target_files = []
                    else:
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
            with config_sync_lock:
                active = is_wechat_active
                mode = wechat_listen_mode
                whitelist = list(listen_chats)

            if active:
                sessions = wx.GetSession()
                for s in sessions:
                    # Identify sessions with unread messages
                    if not s.isnew:
                        continue
                    
                    # Apply listening mode strategy
                    if mode == "whitelist":
                        # If in whitelist mode, restrict to the whitelist. If whitelist is empty, we listen to nothing.
                        if s.name not in whitelist:
                            continue
                    # If mode is 'global', no filtering is applied.
                    
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

