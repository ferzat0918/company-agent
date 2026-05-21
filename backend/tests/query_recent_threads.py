import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
    
    serializer = JsonPlusSerializer()
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT thread_id, count(*), max(checkpoint_id)
                FROM checkpoint_writes
                GROUP BY thread_id
                ORDER BY max(checkpoint_id) DESC
            """)
            threads = cur.fetchall()
            print(f"Total unique threads: {len(threads)}")
            for t_id, cnt, max_cp in threads:
                print(f"\n=========================================")
                print(f"Thread ID: {t_id} (Writes count: {cnt}, Max Checkpoint: {max_cp})")
                
                # Fetch the latest human and AI messages in this thread
                cur.execute("""
                    SELECT checkpoint_id, channel, type, blob
                    FROM checkpoint_writes
                    WHERE thread_id = %s AND channel = 'messages'
                    ORDER BY checkpoint_id DESC
                """, (t_id,))
                
                msg_rows = cur.fetchall()
                print(f"  Messages writes count: {len(msg_rows)}")
                printed = 0
                for ch_id, channel, type_name, blob_data in msg_rows:
                    if printed >= 4:
                        break
                    try:
                        deserialized = serializer.loads_typed((type_name, blob_data))
                        if isinstance(deserialized, list):
                            for item in deserialized:
                                content = getattr(item, "content", None) if hasattr(item, "content") else str(item)
                                role = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else "unknown")
                                print(f"    [{role}]: {str(content)[:300]}")
                                printed += 1
                        else:
                            print(f"    Value: {str(deserialized)[:300]}")
                            printed += 1
                    except Exception as e:
                        print(f"    Failed to deserialize write: {e}")

if __name__ == "__main__":
    main()
