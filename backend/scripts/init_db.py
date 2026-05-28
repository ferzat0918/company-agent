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

    # ─── Automatic Incremental Migration Runner ──────────────────────
    import psycopg
    from pathlib import Path

    migrations_dir = Path(__file__).resolve().parent.parent.parent / "infra" / "migrations"
    if migrations_dir.exists():
        print("Starting automatic database migration check...")
        conn = await psycopg.AsyncConnection.connect(uri)
        async with conn:
            # 1. Create schema_migrations table if not exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    migration_name VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            await conn.commit()

            # 2. Get and sort migrations
            sql_files = sorted(migrations_dir.glob("*.sql"))
            for sql_file in sql_files:
                migration_name = sql_file.name
                
                # Check if already applied
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT 1 FROM public.schema_migrations WHERE migration_name = %s",
                        (migration_name,)
                    )
                    already_applied = cur.rowcount > 0 or await cur.fetchone()

                if already_applied:
                    print(f"  - Migration '{migration_name}' already applied — skipping.")
                    continue

                # Apply migration
                print(f"  🚀 Applying migration: {migration_name} ...")
                try:
                    sql_content = sql_file.read_text(encoding="utf-8")
                    await conn.execute(sql_content)
                    
                    # Record execution
                    await conn.execute(
                        "INSERT INTO public.schema_migrations (migration_name) VALUES (%s)",
                        (migration_name,)
                    )
                    await conn.commit()
                    print(f"  ✓ Migration '{migration_name}' applied successfully!")
                except Exception as e:
                    await conn.rollback()
                    print(f"  ❌ ERROR applying migration '{migration_name}': {e}")
                    raise e
        print("Database migrations check completed!")
    else:
        print("No migrations directory found inside container — skipping migrations.")


if __name__ == "__main__":
    asyncio.run(main())
