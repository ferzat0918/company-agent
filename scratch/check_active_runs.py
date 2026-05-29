import httpx
import os
import jwt
from dotenv import load_dotenv

load_dotenv()

LANGGRAPH_API_URL = "http://192.168.1.100:2024"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-key-at-least-32-chars-long!!")
USER_ID = "b24cc916-5f68-4bb4-9a60-ae75a5766ea8"
THREAD_ID = "fac19bc1-b1f2-5b2d-909b-2787a0e27b69"

def check_runs():
    payload = {
        'sub': USER_ID,
        'role': 'authenticated',
        'iss': 'supabase',
        'iat': 1700000000,
        'exp': 2000000000
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}'}

    print(f"--- Fetching runs for thread: {THREAD_ID} ---")
    try:
        r = httpx.get(f"{LANGGRAPH_API_URL}/threads/{THREAD_ID}/runs", headers=headers, timeout=10.0)
        if r.status_code == 200:
            runs = r.json()
            if runs:
                print("First run dict:")
                import pprint
                pprint.pprint(runs[0])
            else:
                print("No runs found.")
        else:
            print(f"Error: {r.text}")
    except Exception as e:
        print(f"Failed to check runs: {e}")

if __name__ == "__main__":
    check_runs()
