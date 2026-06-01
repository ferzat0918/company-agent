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
                SELECT id, thread_id, task_description, status, executed_at, error_log 
                FROM public.scheduled_agent_tasks 
                ORDER BY executed_at DESC NULLS LAST, id DESC
                LIMIT 5
            """)
            rows = cur.fetchall()
            print("Latest 5 scheduled agent tasks in DB:")
            for r in rows:
                print(f"ID: {r[0]}")
                print(f"  Thread ID: {r[1]}")
                print(f"  Description: {r[2]}")
                print(f"  Status: {r[3]}")
                print(f"  Executed At: {r[4]}")
                print(f"  Error Log: {r[5]}")
                print("-" * 50)
except Exception as e:
    print(f"Failed to inspect scheduled_agent_tasks: {e}")
