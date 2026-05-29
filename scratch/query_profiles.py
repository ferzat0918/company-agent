import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "http://192.168.1.100:8000"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def check_prod_profiles():
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    url = f"{SUPABASE_URL}/rest/v1/profiles"
    try:
        resp = httpx.get(url, headers=headers, timeout=10.0)
        if resp.status_code == 200:
            profiles = resp.json()
            print("=" * 60)
            print(f"📊 生产服务器 192.168.1.100 profiles 表中共发现 {len(profiles)} 条用户记录：")
            print("=" * 60)
            for p in profiles:
                user_id = p.get("user_id")
                wechat_nickname = p.get("wechat_nickname")
                dept = p.get("dept")
                role = p.get("role")
                status = "✅ 已绑定微信: " + f"[{wechat_nickname}]" if wechat_nickname else "❌ 未绑定微信"
                print(f"- 用户ID: {user_id}\n  部门: {dept} | 角色: {role}\n  微信绑定: {status}")
                print("-" * 60)
        else:
            print(f"🔴 请求失败，状态码: {resp.status_code}, 详情: {resp.text}")
    except Exception as e:
        print(f"🔴 查询发生异常: {e}")

if __name__ == "__main__":
    check_prod_profiles()
