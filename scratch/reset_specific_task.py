import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
postgres_uri = os.environ.get('POSTGRES_URI')
task_id = "8652b0b8-d0bf-424a-ab49-57f8348744a0"

try:
    with psycopg.connect(postgres_uri) as conn:
        with conn.cursor() as cur:
            # 重置特定任务为 pending
            cur.execute(
                "UPDATE public.wechat_push_queue SET status = 'pending' WHERE id = %s",
                (task_id,)
            )
            conn.commit()
            print(f"Successfully reset task {task_id} status back to 'pending'!")
except Exception as e:
    print(f"Failed to reset task: {e}")
