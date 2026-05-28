import os
import sys
import time
import base64
import random
import hmac
import hashlib
import json
import uuid
import httpx
import jwt  # pip install pyjwt

# Try to import wxauto with a clear installation guide if it fails
try:
    from wxauto import WeChat
except ImportError:
    print("\n" + "="*70)
    print("❌ 缺少所需的 RPA 依赖库 'wxauto'！")
    print("👉 请在您的宿主机命令行（CMD/PowerShell）中执行以下命令进行安装：")
    print("   pip install wxauto pyjwt httpx")
    print("="*70 + "\n")
    sys.exit(1)

from dotenv import load_dotenv
load_dotenv()

# === Configuration ===
LANGGRAPH_API_URL = os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-key-at-least-32-chars-long!!")
FREDDY_SUB_UUID = "d81a0391-2663-4f0b-ba89-39f17773a9a1"  # Freddy's authorized Supabase sub UUID
ASSISTANT_ID = "company_agent"

# Helper to sign Supabase JWT locally
def gen_supabase_jwt():
    payload = {
        "iss": "supabase",
        "sub": FREDDY_SUB_UUID,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600 * 24 * 365,  # 1 year expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# Helper to call LangGraph agent locally
def invoke_langgraph(sender_name: str, prompt: str) -> str:
    # Deterministically generate a valid UUID based on sender's WeChat name
    # to maintain persistent chat histories per sender
    namespace = uuid.UUID(FREDDY_SUB_UUID)
    thread_id = str(uuid.uuid5(namespace, sender_name))
    
    jwt_token = gen_supabase_jwt()
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    # 1. Create thread if not exists
    channel = "wechat"
    chat_name = sender_name
    sender = sender_name

    with httpx.Client() as client:
        try:
            # Check if thread already exists and its metadata is unmapped/empty
            thread_resp = client.get(
                f"{LANGGRAPH_API_URL}/threads/{thread_id}",
                headers=headers,
                timeout=5.0
            )
            if thread_resp.status_code == 200:
                thread_data = thread_resp.json()
                metadata = thread_data.get("metadata") or {}
                if not metadata.get("channel") or metadata.get("owner") == FREDDY_SUB_UUID:
                    client.delete(
                        f"{LANGGRAPH_API_URL}/threads/{thread_id}",
                        headers=headers,
                        timeout=5.0
                    )
        except Exception:
            pass

        try:
            client.post(
                f"{LANGGRAPH_API_URL}/threads",
                json={
                    "thread_id": thread_id,
                    "metadata": {
                        "channel": channel,
                        "chat_name": chat_name,
                        "sender": sender
                    }
                },
                headers=headers,
                timeout=5.0
            )
        except Exception:
            pass  # Already exists, proceed
            
        # 2. Trigger run and stream response
        body = {
            "assistant_id": ASSISTANT_ID,
            "input": {
                "messages": [
                    {"type": "human", "content": prompt}
                ]
            },
            "stream_mode": ["values"],
            "stream_subgraphs": True
        }
        
        try:
            full_response = ""
            with client.stream(
                "POST",
                f"{LANGGRAPH_API_URL}/threads/{thread_id}/runs/stream",
                json=body,
                headers=headers,
                timeout=60.0
            ) as response:
                if response.status_code != 200:
                    return f"智能体服务器返回错误 HTTP {response.status_code}"
                
                for line in response.iter_lines():
                    decoded = line.strip()
                    if decoded.startswith("data:"):
                        data_str = decoded[5:].strip()
                        if data_str:
                            try:
                                chunk = json.loads(data_str)
                                if isinstance(chunk, dict) and "messages" in chunk:
                                    msgs = chunk["messages"]
                                    if isinstance(msgs, list):
                                        for m in msgs:
                                            if isinstance(m, dict) and m.get("type") == "ai":
                                                c = m.get("content", "")
                                                if isinstance(c, str):
                                                    full_response = c
                            except Exception:
                                pass
            
            if not full_response:
                return "未检测到智能体回复，请重试。"
            return full_response
        except Exception as e:
            return f"连接智能体出错: {e}"

def main():
    print("="*60)
    print("🤖 WeChat PC RPA + LangGraph 智能助手客户端")
    print("="*60)
    print("💡 准备阶段：")
    print("   1. 请确保您的 Windows 电脑上已登录官方 PC 版微信客户端。")
    print("   2. 请确保微信窗口处于可见状态（不可最小化至系统托盘）。")
    print("="*60)
    
    # Initialize WeChat RPA client
    try:
        wx = WeChat()
        print("✅ 成功绑定本地 PC 微信客户端！")
    except Exception as e:
        print(f"❌ 绑定微信窗口失败！原因：{e}")
        print("👉 请确保微信 PC 客户端正常开启并在桌面上可见，然后重新运行。")
        return

    # Let the user configure who they want to listen to (friends or group names)
    print("\n📝 配置监听列表 (请输入您希望自动回复的好友备注名或微信群聊全称，多项用英文逗号分隔)：")
    listen_input = input("👉 监听名单: ").strip()
    
    if not listen_input:
        print("❌ 未输入监听名单，程序退出。")
        return
        
    listen_chats = [item.strip() for item in listen_input.split(",") if item.strip()]
    
    print("\n🚀 正在为以下会话注册 RPA 自动监听：")
    for chat in listen_chats:
        wx.AddListenChat(who=chat)
        print(f"   - [已监听] {chat}")
        
    print("\n⚡ 开始同步长轮询监听新消息 (按 Ctrl+C 可随时退出)...")
    
    while True:
        try:
            # Check for new unread messages in registered listen chats
            msgs = wx.GetListenMessage()
            
            for chat_name, msg_list in msgs.items():
                for msg in msg_list:
                    # msg is typically a tuple/list: [sender_name, content] or similar depending on wxauto version
                    # We only process text messages (type 'friend' or 'group')
                    sender = msg[0]
                    content = msg[1]
                    
                    # Ignore self-sent message loopbacks
                    if sender == "Self" or sender == "自己":
                        continue
                        
                    print(f"\n💬 收到来自 [{chat_name}] 的好友 [{sender}] 的消息: {content}")
                    
                    # Call LangGraph
                    print("🧠 正在请求 LangGraph AI Agent 进行思考回复...")
                    reply = invoke_langgraph(chat_name, content)
                    print(f"🤖 智能体回复: {reply}")
                    
                    # Send response back via RPA
                    wx.SendMsg(reply, chat_name)
                    print(f"🚀 已自动向 [{chat_name}] 发送回复完成！")
                    
        except KeyboardInterrupt:
            print("\n👋 收到退出信号，RPA 监听服务已安全停止。")
            break
        except Exception as e:
            print(f"⚠️ 监听循环中发生异常: {e}")
            
        time.sleep(2)  # Check every 2 seconds to reduce CPU consumption

if __name__ == "__main__":
    main()
