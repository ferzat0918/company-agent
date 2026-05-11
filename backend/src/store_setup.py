"""Postgres Checkpointer and Store factory functions.

These are loaded DIRECTLY by the LangGraph API platform via the langgraph.json
checkpointer/store config fields (not as part of a package), so we CANNOT use
relative imports.
"""
import os
from dotenv import load_dotenv

load_dotenv()

_pg_uri = os.environ.get("POSTGRES_URI")
if not _pg_uri:
    raise RuntimeError("Missing required env var: POSTGRES_URI")


def create_checkpointer():
    """Create Postgres-backed checkpointer for session persistence."""
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    return AsyncPostgresSaver.from_conn_string(_pg_uri)


def create_store():
    """Create Postgres-backed Store for cross-thread long-term memory."""
    from langgraph.store.postgres.aio import AsyncPostgresStore

    return AsyncPostgresStore.from_conn_string(_pg_uri)
