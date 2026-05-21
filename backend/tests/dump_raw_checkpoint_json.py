import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT checkpoint 
                FROM checkpoints 
                WHERE thread_id = %s
                ORDER BY checkpoint_id DESC
                LIMIT 1
            """, (thread_id,))
            row = cur.fetchone()
            if row:
                print("Pretty printed raw checkpoint JSON:")
                print(json.dumps(row[0], indent=2, ensure_ascii=False)[:3000])

if __name__ == "__main__":
    main()
