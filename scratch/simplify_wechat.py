import re

with open("scripts/rpa/wechat_rpa_v4.py", "r", encoding="utf-8") as f:
    content = f.read()

# Locate from trigger_thread_summarize_and_archive down to invoke_langgraph_with_retry
start_marker = "def trigger_thread_summarize_and_archive"
end_marker = '    body = {\n        "assistant_id": ASSISTANT_ID,\n        "input": {\n            "messages": [{"type": "human", "content": prompt}]\n        },'

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print(f"ERROR: Markers not found. start: {idx_start}, end: {idx_end}")
    exit(1)

replacement = """def invoke_langgraph_with_retry(chat_name: str, prompt: str, channel: str = "wechat", sender: str = "未知发送者", user_id: str = FREDDY_SUB_UUID) -> tuple[str, list[str]]:
    \"\"\"Invokes LangGraph and intercepts tool calls for send_wechat_file in the run stream.\"\"\"
    # Deterministically generate a persistent thread_id based on the chat_name (WeChat channel)
    namespace = uuid.UUID(FREDDY_SUB_UUID)
    thread_id = str(uuid.uuid5(namespace, chat_name))
    
    jwt_token = gen_supabase_jwt(FREDDY_SUB_UUID)
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    # 1. Autocreate thread in LangGraph if it doesn't exist
    try:
        with httpx.Client() as client:
            client.post(
                f"{LANGGRAPH_API_URL}/threads",
                json={
                    "thread_id": thread_id,
                    "metadata": {
                        "channel": channel,
                        "chat_name": chat_name,
                        "sender": sender,
                        "owner": user_id  # Passed so that the backend's auth.py can bind/update it to the real user_id
                    }
                },
                headers=headers,
                timeout=5.0
            )
    except Exception:
        pass  # Already exists, proceed
        
"""

new_content = content[:idx_start] + replacement + content[idx_end:]

# Now let's add the message debugging print.
# Find msgs = wx.GetAllMessage()
search_str = "msgs = wx.GetAllMessage()"
pos = new_content.find(search_str)
if pos != -1:
    insert_pos = pos + len(search_str)
    debug_code = """
                    if msgs:
                        logger.info(f"🔍 [DEBUG MSG] 获取到 {len(msgs)} 条消息，详情如下：")
                        for idx, m in enumerate(msgs):
                            logger.info(f"  [{idx}] sender: '{m.sender}', attr: '{m.attr}', type: '{m.type}', content: '{m.content}'")
"""
    new_content = new_content[:insert_pos] + debug_code + new_content[insert_pos:]

with open("scripts/rpa/wechat_rpa_v4.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("SUCCESS: simplified wechat_rpa_v4.py successfully!")
