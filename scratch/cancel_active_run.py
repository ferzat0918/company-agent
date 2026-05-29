import httpx
import os
import jwt
from dotenv import load_dotenv

load_dotenv()

LANGGRAPH_API_URL = "http://192.168.1.100:2024"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-key-at-least-32-chars-long!!")
USER_ID = "b24cc916-5f68-4bb4-9a60-ae75a5766ea8"
THREAD_ID = "fac19bc1-b1f2-5b2d-909b-2787a0e27b69"
RUN_ID = "019e7319-f5ab-7111-9624-6f0289617e6e"

def cancel_run():
    payload = {
        'sub': USER_ID,
        'role': 'authenticated',
        'iss': 'supabase',
        'iat': 1700000000,
        'exp': 2000000000
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}'}

    print(f"--- Sending cancel request for Run: {RUN_ID} on Thread: {THREAD_ID} ---")
    try:
        url = f"{LANGGRAPH_API_URL}/threads/{THREAD_ID}/runs/{RUN_ID}/cancel"
        r = httpx.post(url, headers=headers, timeout=10.0)
        print(f"Status Code: {r.status_code}")
        print(f"Response: {r.text}")
    except Exception as e:
        print(f"Failed to cancel run: {e}")

if __name__ == "__main__":
    cancel_run()
