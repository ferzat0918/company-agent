"""One-shot: create LangGraph checkpointer + store tables in a fresh Postgres.

Run from inside the langgraph container:
    docker exec company-agent-langgraph python /app/backend/scripts/init_db.py

Idempotent — safe to re-run.
"""
import asyncio
import os
from pathlib import Path

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore


# Path to SQL init scripts (relative to project root inside the container)
INIT_FEEDBACK_SQL = Path(__file__).resolve().parent.parent.parent / "infra" / "init-feedback.sql"


async def main() -> None:
    uri = os.environ["POSTGRES_URI"]
    print(f"Initializing tables on {uri.split('@')[-1]}")

    async with AsyncPostgresSaver.from_conn_string(uri) as saver:
        await saver.setup()
        print("checkpointer tables ok")

    async with AsyncPostgresStore.from_conn_string(uri) as store:
        await store.setup()
        print("store tables ok")

    # Create feedback table (idempotent)
    if INIT_FEEDBACK_SQL.exists():
        import psycopg

        conn = await psycopg.AsyncConnection.connect(uri)
        async with conn:
            await conn.execute(INIT_FEEDBACK_SQL.read_text())
            await conn.commit()
        print("feedback table ok")
    else:
        print(f"WARNING: {INIT_FEEDBACK_SQL} not found — skipping feedback table")


if __name__ == "__main__":
    asyncio.run(main())

