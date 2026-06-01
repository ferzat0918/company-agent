import os
import psycopg
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

postgres_uri = os.environ.get('POSTGRES_URI')
if not postgres_uri:
    print("Error: POSTGRES_URI env variable is not set!")
    exit(1)

print(f"Connecting to database with URI length: {len(postgres_uri)}")

try:
    with psycopg.connect(postgres_uri) as conn:
        with conn.cursor() as cur:
            # 1. 查询当前处理中的任务
            cur.execute("SELECT id, chat_name, content, status FROM public.wechat_push_queue WHERE status = 'processing'")
            processing_rows = cur.fetchall()
            print(f"Found {len(processing_rows)} rows with status='processing':")
            for r in processing_rows:
                print(f"  - ID: {r[0]}, Chat: {r[1]}, Content: {r[2][:30]}, Status: {r[3]}")
            
            # 2. 如果有 processing 的，把它们重置为 'pending'
            if processing_rows:
                print("\nResetting processing tasks back to 'pending'...")
                cur.execute("UPDATE public.wechat_push_queue SET status = 'pending' WHERE status = 'processing'")
                conn.commit()
                print("Successfully reset tasks status to 'pending'!")
                
            # 3. 再次查询
            cur.execute("SELECT id, chat_name, content, status FROM public.wechat_push_queue WHERE status = 'pending'")
            pending_rows = cur.fetchall()
            print(f"\nNow total pending tasks in database: {len(pending_rows)}")
            for r in pending_rows:
                print(f"  - ID: {r[0]}, Chat: {r[1]}, Content: {r[2][:30]}, Status: {r[3]}")
                
except Exception as e:
    print(f"Database query failed: {e}")
