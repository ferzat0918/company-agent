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
                SELECT thread_id, checkpoint_id, channel, type, blob
                FROM checkpoint_writes
                ORDER BY checkpoint_id DESC
            """)
            
            rows = cur.fetchall()
            found_uploads = []
            for thread_id, ch_id, channel, type_name, blob_data in rows:
                try:
                    deserialized = serializer.loads_typed((type_name, blob_data))
                    if isinstance(deserialized, list):
                        for idx, item in enumerate(deserialized):
                            # Check if the message is a dict or standard HumanMessage
                            content = None
                            if isinstance(item, dict):
                                content = item.get("content")
                            elif hasattr(item, "content"):
                                content = item.content
                            
                            if isinstance(content, list):
                                for block in content:
                                    if isinstance(block, dict) and block.get("type") == "file":
                                        found_uploads.append({
                                            "thread_id": thread_id,
                                            "checkpoint_id": ch_id,
                                            "channel": channel,
                                            "filename": block.get("metadata", {}).get("filename") or block.get("metadata", {}).get("name") or "unknown",
                                            "mimeType": block.get("mimeType"),
                                            "data_len": len(block.get("data", "")),
                                            "content_list": content
                                        })
                except Exception:
                    pass
            
            print(f"Total uploads found in checkpoint_writes: {len(found_uploads)}")
            # Show details of the 5 most recent uploads
            for u in found_uploads[:5]:
                print("\n=========================================")
                print(f"Thread: {u['thread_id']} | Checkpoint: {u['checkpoint_id']}")
                print(f"File: {u['filename']} | MIME: {u['mimeType']} | Data Length: {u['data_len']}")
                print("-----------------------------------------")
                print("Content list structure:")
                for i, block in enumerate(u['content_list']):
                    if isinstance(block, dict):
                        b_type = block.get("type")
                        if b_type == "text":
                            print(f"  Block {i}: type=text, text={repr(block.get('text'))[:150]}")
                        elif b_type == "file":
                            print(f"  Block {i}: type=file, filename={block.get('metadata', {}).get('filename') or block.get('metadata', {}).get('name')}, data_len={len(block.get('data', ''))}")
                    else:
                        print(f"  Block {i}: {str(block)[:100]}")

if __name__ == "__main__":
    main()
