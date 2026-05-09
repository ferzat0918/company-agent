"""Postgres Checkpointer and Store setup with memory fallback"""
from .config import POSTGRES_URI


def create_checkpointer():
    """Create Postgres-backed checkpointer for session persistence.
    Falls back to MemorySaver if Postgres is unavailable (dev mode)."""
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        cp = PostgresSaver.from_conn_string(POSTGRES_URI)
        return cp
    except Exception as e:
        print(f"WARNING: Postgres checkpointer unavailable, using MemorySaver: {e}")
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()


def create_store():
    """Create Postgres-backed Store for cross-thread long-term memory.
    Falls back to InMemoryStore if Postgres is unavailable (dev mode)."""
    try:
        from langgraph.store.postgres import PostgresStore
        store = PostgresStore.from_conn_string(POSTGRES_URI)
        return store
    except Exception as e:
        print(f"WARNING: Postgres store unavailable, using InMemoryStore: {e}")
        from langgraph.store.memory import InMemoryStore
        return InMemoryStore()
