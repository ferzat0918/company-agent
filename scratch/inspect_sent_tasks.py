import os
import psycopg
import json
from dotenv import load_dotenv

load_dotenv()
postgres_uri = os.environ.get('POSTGRES_URI')

try:
    with psycopg.connect(postgres_uri) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, chat_name, content, attachments, status, created_at, error_msg 
                FROM public.wechat_push_queue 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            rows = cur.fetchall()
            print("Latest 5 tasks in push queue:")
            for r in rows:
                print(f"ID: {r[0]}")
                print(f"  Chat Name: {r[1]}")
                print(f"  Content: {r[2]}")
                print(f"  Attachments: {r[3]}")
                print(f"  Status: {r[4]}")
                print(f"  Created At: {r[5]}")
                print(f"  Error Msg: {r[6]}")
                print("-" * 50)
except Exception as e:
    print(f"Failed to inspect DB: {e}")
