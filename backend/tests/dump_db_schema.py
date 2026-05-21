import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # Let's inspect columns for checkpoints
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'checkpoints'
            """)
            print("checkpoints table columns:")
            for col in cur.fetchall():
                print(f"  - {col[0]}: {col[1]}")
                
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'checkpoint_blobs'
            """)
            print("\ncheckpoint_blobs table columns:")
            for col in cur.fetchall():
                print(f"  - {col[0]}: {col[1]}")
                
            # Query all checkpoints for thread_id
            cur.execute("""
                SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, metadata 
                FROM checkpoints 
                WHERE thread_id = %s
                ORDER BY checkpoint_id ASC
            """, (thread_id,))
            rows = cur.fetchall()
            print(f"\nAll checkpoints for thread {thread_id}:")
            for idx, r in enumerate(rows):
                print(f"  [{idx}] NS: '{r[1]}' | ID: {r[2]} | Parent: {r[3]}")
                print(f"      Metadata: {r[4]}")

if __name__ == "__main__":
    main()
