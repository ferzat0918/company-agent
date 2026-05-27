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