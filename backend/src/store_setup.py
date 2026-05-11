"""Postgres Checkpointer and Store factory functions.

These are loaded by the LangGraph API platform via the langgraph.json
checkpointer/store config fields.
"""
from .config import POSTGRES_URI


def create_checkpointer():
    """Create Postgres-backed checkpointer for session persistence."""
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    return AsyncPostgresSaver.from_conn_string(POSTGRES_URI)


def create_store():
    """Create Postgres-backed Store for cross-thread long-term memory."""
    from langgraph.store.postgres.aio import AsyncPostgresStore

    return AsyncPostgresStore.from_conn_string(POSTGRES_URI)
