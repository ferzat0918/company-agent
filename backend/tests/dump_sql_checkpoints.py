import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    print(f"Connecting to Postgres using psycopg...")
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # List tables to confirm
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            tables = cur.fetchall()
            print("TABLES:", [t[0] for t in tables])
            
            # Query distinct namespaces for the thread
            cur.execute(
                "SELECT DISTINCT checkpoint_ns FROM checkpoints WHERE thread_id = %s",
                (thread_id,)
            )
            namespaces = cur.fetchall()
            print(f"\nDistinct namespaces for thread {thread_id}:")
            for ns in namespaces:
                print(f"  - '{ns[0]}'")
                
            # For each namespace, get the latest checkpoint and print its channels
            for ns in namespaces:
                checkpoint_ns = ns[0]
                cur.execute(
                    "SELECT metadata FROM checkpoints WHERE thread_id = %s AND checkpoint_ns = %s ORDER BY checkpoint_id DESC LIMIT 1",
                    (thread_id, checkpoint_ns)
                )
                row = cur.fetchone()
                if row:
                    print(f"\n--- Namespace: '{checkpoint_ns}' ---")
                    # metadata is usually stored as a json/string or bytes in PostgreSQL depending on schema
                    print(f"Metadata: {row[0]}")
                    
                    # Let's see if we can read the checkpoints using LangGraph checkpointer
                    # We will do this in another step if needed

if __name__ == "__main__":
    main()
