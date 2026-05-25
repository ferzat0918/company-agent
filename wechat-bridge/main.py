import os
import logging
from fastapi import FastAPI, Request, BackgroundTasks
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("wechat-bridge")

app = FastAPI(title="UMX WeChat Agent Bridge")

# Environments
GEWECHAT_API_URL = os.getenv("GEWECHAT_API_URL", "http://gewechat:2531")
LANGGRAPH_API_URL = os.getenv("LANGGRAPH_API_URL", "http://langgraph:2024")
ASSISTANT_ID = os.getenv("ASSISTANT_ID", "company_agent")

async def reply_wechat(app_id: str, to_user_name: str, text: str):
    """Send text message back to WeChat user via GeWeChat API."""
    url = f"{GEWECHAT_API_URL}/v2/api/message/postText"
    headers = {
        "Content-Type": "application/json"
    }
    # Retrieve X-GEWE-TOKEN if configured
    token = os.getenv("GEWECHAT_TOKEN", "")
    if token:
        headers["X-GEWE-TOKEN"] = token
        
    payload = {
        "appId": app_id,
        "toCcUserName": to_user_name,
        "content": text
    }
    
    logger.info(f"Replying to {to_user_name}: {text[:100]}...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            logger.info(f"GeWeChat reply response: {resp.status_code} - {resp.text}")
        except Exception as err:
            logger.error(f"Failed to send GeWeChat reply: {str(err)}")

async def process_agent_interaction(app_id: str, from_user_name: str, text: str):
    """Call LangGraph Server to run the agent on the thread, then reply."""
    # Stable mapping of WeChat from_user_name to LangGraph thread_id
    thread_id = f"wechat_{from_user_name.replace('@', '_')}"
    
    # 1. Ensure thread exists (LangGraph handles thread generation dynamically, but we can explicitly create/get it)
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Check or create thread
            await client.post(f"{LANGGRAPH_API_URL}/threads", json={"thread_id": thread_id})
        except Exception as e:
            logger.warning(f"Error calling /threads: {str(e)} (Proceeding anyway)")
            
        # 2. Trigger run and wait for it
        run_payload = {
            "assistant_id": ASSISTANT_ID,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": text
                    }
                ]
            }
        }
        
        logger.info(f"Starting LangGraph run on thread {thread_id}...")
        try:
            resp = await client.post(
                f"{LANGGRAPH_API_URL}/threads/{thread_id}/runs/wait",
                json=run_payload
            )
            if resp.status_code != 200:
                logger.error(f"LangGraph run failed: {resp.status_code} - {resp.text}")
                await reply_wechat(app_id, from_user_name, "【系统提示】智能体思考出现异常，请稍后再试。")
                return
                
            run_data = resp.json()
            # In LangGraph wait response, the output values are under state or values
            values = run_data.get("values", {})
            messages = values.get("messages", [])
            
            assistant_reply = ""
            # Loop backwards to find the last assistant message
            for msg in reversed(messages):
                role = msg.get("role") or msg.get("type")
                if role in ("ai", "assistant"):
                    content = msg.get("content")
                    if isinstance(content, str):
                        assistant_reply = content
                    elif isinstance(content, list):
                        # Combine text blocks
                        text_blocks = []
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text_blocks.append(block.get("text", ""))
                            elif isinstance(block, str):
                                text_blocks.append(block)
                        assistant_reply = "".join(text_blocks)
                    break
            
            if assistant_reply:
                # Reply WeChat!
                await reply_wechat(app_id, from_user_name, assistant_reply)
            else:
                logger.warning("No assistant message found in LangGraph output.")
                await reply_wechat(app_id, from_user_name, "【系统提示】智能体无响应，请稍后再试。")
                
        except Exception as err:
            logger.error(f"Failed to communicate with LangGraph Server: {str(err)}")
            await reply_wechat(app_id, from_user_name, "【系统提示】通信超时，请稍后再试。")

@app.post("/webhook")
async def wechat_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive callback events from GeWeChat."""
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse JSON callback: {str(e)}")
        return {"status": "error", "message": "Invalid JSON"}
        
    logger.info(f"Received GeWeChat callback event: {payload.get('ret')} - {payload.get('msg')}")
    
    # Check if message event (type 1 represents message callback)
    event_data = payload.get("data", {}) or {}
    event_type = event_data.get("type")
    
    if event_type == 1:
        # Message payload
        msg_payload = event_data.get("data", {}) or {}
        app_id = event_data.get("appId")
        
        from_user = msg_payload.get("fromUserName", "")
        to_user = msg_payload.get("toUserName", "")
        content = msg_payload.get("content", "")
        is_self = msg_payload.get("isSendBySelf", False)
        msg_type = msg_payload.get("type") # 1 represents text message
        
        # Guard clause: ignore own messages to avoid infinite loops
        if is_self:
            logger.info("Ignoring message sent by self.")
            return {"status": "ok", "message": "Ignored self message"}
            
        # We only support text message (type 1) in initial stage
        if msg_type != 1:
            logger.info(f"Ignoring non-text message type: {msg_type}")
            return {"status": "ok", "message": "Ignored non-text message"}
            
        logger.info(f"Text Message from {from_user}: {content[:50]}")
        
        # Handle group chats
        is_group = from_user.endswith("@chatroom")
        clean_content = content
        
        if is_group:
            # Group messages look like "sender_wxid:\nactual_content"
            if ":\n" in content:
                sender_wxid, clean_content = content.split(":\n", 1)
                logger.info(f"Group chat message from member {sender_wxid}: {clean_content[:50]}")
            else:
                logger.info(f"Group chat message (unsplit): {content[:50]}")
                
            # For groups, we only respond if the bot is @mentioned
            if "@" not in clean_content:
                logger.info("Group message does not contain @, ignoring.")
                return {"status": "ok", "message": "Ignored group message without @"}
        
        # Enqueue processing in background so we respond 200 OK instantly to GeWeChat
        background_tasks.add_task(process_agent_interaction, app_id, from_user, clean_content)
        
    return {"status": "ok"}

@app.post("/register")
async def register_callback(app_id: str, callback_url: str):
    """Utility endpoint to tell GeWeChat to send callbacks to our /webhook."""
    url = f"{GEWECHAT_API_URL}/v2/api/tools/setCallback"
    headers = {
        "Content-Type": "application/json"
    }
    token = os.getenv("GEWECHAT_TOKEN", "")
    if token:
        headers["X-GEWE-TOKEN"] = token
        
    payload = {
        "appId": app_id,
        "callbackUrl": callback_url
    }
    
    logger.info(f"Registering GeWeChat callback for appId {app_id} -> {callback_url}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            return resp.json()
        except Exception as err:
            return {"status": "error", "message": f"Failed to register callback: {str(err)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "wechat-bridge"}
