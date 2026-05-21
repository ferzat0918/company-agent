import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # Query all distinct channels in checkpoint_blobs
            cur.execute("SELECT DISTINCT channel FROM checkpoint_blobs")
            channels = cur.fetchall()
            print("All distinct channels in checkpoint_blobs:")
            for ch in channels:
                print(f"  - '{ch[0]}'")
                
            # Query count of blobs per channel
            cur.execute("""
                SELECT channel, COUNT(*) 
                FROM checkpoint_blobs 
                GROUP BY channel
            """)
            counts = cur.fetchall()
            print("\nBlob counts per channel:")
            for row in counts:
                print(f"  - '{row[0]}': {row[1]}")
                
            # Let's see some actual data from one blob where channel is not skills_metadata
            cur.execute("""
                SELECT thread_id, checkpoint_ns, channel, version, type 
                FROM checkpoint_blobs 
                WHERE channel != 'skills_metadata'
                LIMIT 10
            """)
            rows = cur.fetchall()
            print("\nNon-skills_metadata blobs:")
            for r in rows:
                print(f"  Thread: {r[0]} | NS: '{r[1]}' | Channel: '{r[2]}' | Version: '{r[3]}' | Type: '{r[4]}'")

if __name__ == "__main__":
    main()
