import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
postgres_uri = os.environ.get('POSTGRES_URI')

if not postgres_uri:
    print("Error: POSTGRES_URI is not set!")
    exit(1)

try:
    with psycopg.connect(postgres_uri) as conn:
        with conn.cursor() as cur:
            # 1. 统计当前 scheduled_agent_tasks 的记录数
            cur.execute("SELECT COUNT(*) FROM public.scheduled_agent_tasks")
            cnt_scheduled = cur.fetchone()[0]
            
            # 2. 统计当前 wechat_push_queue 的记录数
            cur.execute("SELECT COUNT(*) FROM public.wechat_push_queue")
            cnt_push = cur.fetchone()[0]
            
            print(f"Current scheduled agent tasks count: {cnt_scheduled}")
            print(f"Current wechat push queue tasks count: {cnt_push}")
            
            # 3. 清除所有的定时任务 (TRUNCATE 或者 DELETE)
            if cnt_scheduled > 0:
                print("Clearing all scheduled agent tasks...")
                cur.execute("DELETE FROM public.scheduled_agent_tasks")
            
            # 4. 清除所有的微信推信任务
            if cnt_push > 0:
                print("Clearing all wechat push queue tasks...")
                cur.execute("DELETE FROM public.wechat_push_queue")
                
            conn.commit()
            print("Successfully cleared all tasks from database!")
except Exception as e:
    print(f"Failed to clear tasks: {e}")
