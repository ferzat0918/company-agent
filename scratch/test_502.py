"""Quick test: directly import and run the agent to reproduce the 502 error locally."""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from dotenv import load_dotenv
load_dotenv()

print("=== Step 1: Testing DeepSeek API directly ===")
import httpx
try:
    r = httpx.post(
        "https://api.deepseek.com/chat/completions",
        json={
            "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
            "messages": [{"role": "user", "content": "say hi in 5 words"}],
            "max_tokens": 20,
        },
        headers={"Authorization": f"Bearer {os.getenv('DEEPSEEK_API_KEY')}"},
        timeout=30,
    )
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        content = data["choices"][0]["message"].get("content", "")
        reasoning = data["choices"][0]["message"].get("reasoning_content", "")
        print(f"  Response: {content or reasoning[:100]}")
        print(f"  Tokens: {data['usage']}")
    else:
        print(f"  Error: {r.text[:500]}")
except Exception as e:
    print(f"  FAILED: {e}")

print("\n=== Step 2: Testing agent import ===")
try:
    from src.agent import agent
    print(f"  Agent loaded: {agent}")
    print(f"  Agent name: {getattr(agent, 'name', 'N/A')}")
except Exception as e:
    print(f"  IMPORT FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Step 3: Testing LangChain ChatModel ===")
try:
    from src.config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL
    print(f"  Model: {DEEPSEEK_MODEL}")
    print(f"  Key: {DEEPSEEK_API_KEY[:10]}...")
    
    from src.chat_models import ChatDeepSeekThinking
    llm = ChatDeepSeekThinking(
        api_key=DEEPSEEK_API_KEY,
        model=DEEPSEEK_MODEL,
    )
    result = llm.invoke("say hi")
    print(f"  LLM Response: {result.content[:100]}")
except Exception as e:
    print(f"  FAILED: {e}")
    import traceback
    traceback.print_exc()
