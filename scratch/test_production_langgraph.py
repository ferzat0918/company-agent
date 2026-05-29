import httpx
import os
import jwt
from dotenv import load_dotenv

load_dotenv()

LANGGRAPH_API_URL = "http://192.168.1.100:2024"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-key-at-least-32-chars-long!!")
USER_ID = "b24cc916-5f68-4bb4-9a60-ae75a5766ea8"

def test_production_status():
    print(f"--- Probing {LANGGRAPH_API_URL}/ok ---")
    try:
        r = httpx.get(f"{LANGGRAPH_API_URL}/ok", timeout=5.0)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text}\n")
        if r.status_code != 200:
            return
    except Exception as e:
        print(f"Failed to connect to /ok: {e}\n")
        return

    # Generate JWT Token
    payload = {
        'sub': USER_ID,
        'role': 'authenticated',
        'iss': 'supabase',
        'iat': 1700000000,
        'exp': 2000000000
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}'}

    # Fetch Threads
    print("--- Fetching Threads ---")
    try:
        r = httpx.post(f"{LANGGRAPH_API_URL}/threads/search", json={'limit': 10}, headers=headers, timeout=10.0)
        if r.status_code != 200:
            print(f"Failed to search threads: {r.text}")
            return
        threads = r.json()
        print(f"Found {len(threads)} threads. Checking active runs for each...\n")
    except Exception as e:
        print(f"Failed to search threads: {e}")
        return

    # Check runs on each thread
    for t in threads:
        thread_id = t.get('thread_id')
        chat_name = t.get('metadata', {}).get('chat_name', 'N/A')
        print(f"Thread: {thread_id} (Chat: {chat_name})")
        
        # Get runs
        try:
            r_runs = httpx.get(f"{LANGGRAPH_API_URL}/threads/{thread_id}/runs", headers=headers, timeout=10.0)
            if r_runs.status_code == 200:
                runs = r_runs.json()
                if not runs:
                    print("  No runs found.")
                for run in runs:
                    run_id = run.get('id')
                    status = run.get('status')
                    created_at = run.get('created_at')
                    print(f"  - Run ID: {run_id} | Status: {status} | Created at: {created_at}")
            else:
                print(f"  Failed to get runs (HTTP {r_runs.status_code}): {r_runs.text}")
        except Exception as e:
            print(f"  Failed to fetch runs: {e}")
        
        # Optionally, get the latest message in this thread
        try:
            r_msgs = httpx.get(f"{LANGGRAPH_API_URL}/threads/{thread_id}/messages", headers=headers, timeout=10.0)
            if r_msgs.status_code == 200:
                msgs = r_msgs.json()
                if msgs:
                    last_msg = msgs[0]
                    content = last_msg.get('content', '')
                    if isinstance(content, list):
                        content = str(content[:2])
                    print(f"  - Last Message: {last_msg.get('type')} from {last_msg.get('role')} | content: {str(content)[:100]}")
            else:
                print(f"  Failed to get messages: {r_msgs.status_code}")
        except Exception as e:
            print(f"  Failed to fetch messages: {e}")
        print("-" * 50)

if __name__ == "__main__":
    test_production_status()
