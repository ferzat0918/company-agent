import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT thread_id 
                FROM checkpoint_blobs 
                WHERE channel = 'messages'
            """)
            threads = cur.fetchall()
            print("Threads that have 'messages' channel blobs:")
            for t in threads:
                thread_id = t[0]
                cur.execute("""
                    SELECT checkpoint_id, checkpoint ->> 'ts', metadata 
                    FROM checkpoints 
                    WHERE thread_id = %s
                    ORDER BY checkpoint_id DESC
                    LIMIT 1
                """, (thread_id,))
                row = cur.fetchone()
                if row:
                    print(f"  Thread ID: {thread_id} | Latest TS: {row[1]} | Metadata: {row[2]}")

if __name__ == "__main__":
    main()
