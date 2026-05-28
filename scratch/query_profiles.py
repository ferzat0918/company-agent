import os
import httpx
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL", "http://localhost:8000")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_ANON_KEY"))

headers = {
    "apikey": supabase_service_key,
    "Authorization": f"Bearer {supabase_service_key}"
}

print(f"Querying profiles from Supabase REST at {supabase_url}...")
try:
    with httpx.Client() as client:
        resp = client.get(f"{supabase_url}/rest/v1/profiles", headers=headers)
        print("Status code:", resp.status_code)
        if resp.status_code == 200:
            profiles = resp.json()
            print(f"Found {len(profiles)} profiles:")
            for idx, p in enumerate(profiles):
                print(f"[{idx+1}] User ID: {p.get('user_id')} | Name: {p.get('name')} | WeChat Nickname: {p.get('wechat_nickname')} | Dept: {p.get('dept')} | Role: {p.get('role')}")
        else:
            print("Failed to fetch profiles:", resp.text)
except Exception as e:
    print("Error querying profiles:", e)
