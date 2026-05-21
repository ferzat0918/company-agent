import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # Let's inspect columns for checkpoint_writes
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'checkpoint_writes'
            """)
            print("checkpoint_writes table columns:")
            for col in cur.fetchall():
                print(f"  - {col[0]}: {col[1]}")
                
            # Query writes for the thread (excluding column value/blob if we don't know the name yet)
            cur.execute("""
                SELECT checkpoint_ns, checkpoint_id, task_id, idx, channel, type
                FROM checkpoint_writes
                WHERE thread_id = %s
            """, (thread_id,))
            
            writes = cur.fetchall()
            print(f"\ncheckpoint_writes count for thread {thread_id}: {len(writes)}")
            for idx, w in enumerate(writes):
                print(f"  [{idx}] NS: '{w[0]}' | Checkpoint: {w[1]} | Task: {w[2]} | Idx: {w[3]} | Channel: '{w[4]}' | Type: '{w[5]}'")

if __name__ == "__main__":
    main()
