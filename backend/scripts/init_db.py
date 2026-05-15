"""One-shot: create LangGraph checkpointer + store tables in a fresh Postgres.

Run from inside the langgraph container:
    docker exec company-agent-langgraph python /app/backend/scripts/init_db.py

Idempotent — safe to re-run.
"""
import asyncio
import os

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore


async def main() -> None:
    uri = os.environ["POSTGRES_URI"]
    print(f"Initializing tables on {uri.split('@')[-1]}")

    async with AsyncPostgresSaver.from_conn_string(uri) as saver:
        await saver.setup()
        print("checkpointer tables ok")

    async with AsyncPostgresStore.from_conn_string(uri) as store:
        await store.setup()
        print("store tables ok")


if __name__ == "__main__":
    asyncio.run(main())
