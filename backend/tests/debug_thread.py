import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from src.config import POSTGRES_URI

async def main():
    thread_id = "019e48a6-51ef-77f2-b557-cd821adc2c4c"
    config = {"configurable": {"thread_id": thread_id}}
    print(f"Connecting to database and listing all checkpoints for thread {thread_id}...")
    try:
        async with AsyncPostgresSaver.from_conn_string(POSTGRES_URI) as checkpointer:
            count = 0
            async for checkpoint_tuple in checkpointer.alist(config):
                count += 1
                checkpoint = checkpoint_tuple.checkpoint
                metadata = checkpoint_tuple.metadata
                channel_values = checkpoint.get("channel_values", {})
                print(f"\n================ Checkpoint {count} ================")
                print(f"Config ID: {checkpoint_tuple.config}")
                print(f"Step: {metadata.get('step')}, Source: {metadata.get('source')}")
                print(f"Run ID: {metadata.get('run_id')}")
                print(f"Channel Keys: {list(channel_values.keys())}")
                
                # Check for messages
                for k, v in channel_values.items():
                    if "message" in k or isinstance(v, list) and len(v) > 0 and hasattr(v[0], 'type'):
                        print(f"Found messages in key '{k}': count={len(v)}")
                        for idx, m in enumerate(v[:3]):
                            print(f"  [{idx}] Type={getattr(m, 'type', 'N/A')}, Content={str(getattr(m, 'content', ''))[:200]}")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
