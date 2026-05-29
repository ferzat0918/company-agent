import httpx
import os
import jwt
import sys
from dotenv import load_dotenv

load_dotenv()

LANGGRAPH_API_URL = "http://192.168.1.100:2024"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-key-at-least-32-chars-long!!")
USER_ID = "b24cc916-5f68-4bb4-9a60-ae75a5766ea8"
THREAD_ID = "fac19bc1-b1f2-5b2d-909b-2787a0e27b69"

def check_state():
    payload = {
        'sub': USER_ID,
        'role': 'authenticated',
        'iss': 'supabase',
        'iat': 1700000000,
        'exp': 2000000000
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}'}

    print(f"--- Fetching state for thread: {THREAD_ID} ---")
    try:
        r = httpx.get(f"{LANGGRAPH_API_URL}/threads/{THREAD_ID}/state", headers=headers, timeout=10.0)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            state = r.json()
            values = state.get('values', {})
            msgs = values.get('messages', [])
            print(f"Found {len(msgs)} messages in thread state. Writing to scratch/messages_output.txt...")
            
            with open("scratch/messages_output.txt", "w", encoding="utf-8") as f:
                f.write(f"--- THREAD {THREAD_ID} STATE --- \n")
                f.write(f"Metadata: {state.get('metadata')}\n\n")
                f.write(f"Total messages: {len(msgs)}\n\n")
                # Write the last 20 messages to keep it focused
                for i, msg in enumerate(msgs[-20:]):
                    role = msg.get('role')
                    content = msg.get('content', '')
                    f.write(f"[{i+1}] Role: {role} | Type: {msg.get('type')}\n")
                    f.write(f"Content: {str(content)}\n")
                    f.write("-" * 80 + "\n")
            print("Successfully wrote messages to scratch/messages_output.txt!")
        else:
            print(f"Error: {r.text}")
    except Exception as e:
        print(f"Failed to check thread state: {e}")

if __name__ == "__main__":
    check_state()
