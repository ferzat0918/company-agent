import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    print("Connecting to Postgres and querying recent threads sorted by actual timestamp...")
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # Query threads ordered by latest checkpoint timestamp
            cur.execute("""
                SELECT thread_id, MAX(checkpoint ->> 'ts') as latest_ts, COUNT(*) as steps_count
                FROM checkpoints
                GROUP BY thread_id
                ORDER BY latest_ts DESC
                LIMIT 10
            """)
            threads = cur.fetchall()
            print("\nRecent Threads (Sorted by TS):")
            for t in threads:
                thread_id, latest_ts, steps = t
                cur.execute(
                    "SELECT metadata, checkpoint_ns FROM checkpoints WHERE thread_id = %s ORDER BY checkpoint_id DESC LIMIT 1",
                    (thread_id,)
                )
                row = cur.fetchone()
                metadata = row[0] if row else {}
                ns = row[1] if row else ""
                print(f"Thread ID: {thread_id} | Latest TS: {latest_ts} | Steps: {steps} | NS: '{ns}'")
                print(f"  Metadata: {metadata}\n")

if __name__ == "__main__":
    main()
