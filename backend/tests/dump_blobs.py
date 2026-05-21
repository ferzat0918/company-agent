import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import POSTGRES_URI

def main():
    import psycopg
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
    
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    serializer = JsonPlusSerializer()
    
    with psycopg.connect(POSTGRES_URI) as conn:
        with conn.cursor() as cur:
            # Query all blobs for the thread
            cur.execute("""
                SELECT channel, version, type, blob 
                FROM checkpoint_blobs 
                WHERE thread_id = %s
                ORDER BY version DESC
            """, (thread_id,))
            
            rows = cur.fetchall()
            print(f"Total blobs found: {len(rows)}")
            
            for idx, r in enumerate(rows):
                channel, version, type_name, blob_data = r
                print(f"\n--- Blob {idx}: Channel='{channel}', Version='{version}', Type='{type_name}' ---")
                try:
                    # Deserialize blob
                    deserialized = serializer.loads(type_name, blob_data)
                    print(f"  Deserialized type: {type(deserialized)}")
                    if isinstance(deserialized, list):
                        print(f"  List length: {len(deserialized)}")
                        for b_idx, item in enumerate(deserialized):
                            # Try to extract content of the message
                            content = getattr(item, 'content', None) if hasattr(item, 'content') else str(item)
                            print(f"    Item {b_idx}: type={type(item)} | class={item.__class__.__name__}")
                            print(f"      Content Type: {type(content)}")
                            print(f"      Content: {str(content)[:400]}")
                    else:
                        print(f"  Snippet: {str(deserialized)[:500]}")
                except Exception as e:
                    print(f"  Failed to deserialize: {e}")

if __name__ == "__main__":
    main()
