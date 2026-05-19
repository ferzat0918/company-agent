import pytest
from langgraph.store.memory import InMemoryStore

from src.memory.prompt_inject import render_memory_blocks
from src.memory.store import MemoryStore


@pytest.mark.asyncio
async def test_render_two_blocks():
    mem = MemoryStore(InMemoryStore())
    await mem.add("u1", "user", "用户叫小明")
    await mem.add("u1", "memory", "项目用 PostgreSQL 15")

    text = await render_memory_blocks(mem, "u1")
    assert "USER PROFILE" in text
    assert "用户叫小明" in text
    assert "MEMORY" in text
    assert "项目用 PostgreSQL 15" in text


@pytest.mark.asyncio
async def test_render_empty_returns_empty_string():
    mem = MemoryStore(InMemoryStore())
    text = await render_memory_blocks(mem, "no-user")
    assert text == ""


@pytest.mark.asyncio
async def test_render_isolates_by_user():
    mem = MemoryStore(InMemoryStore())
    await mem.add("u1", "user", "小明")
    await mem.add("u2", "user", "小红")
    t1 = await render_memory_blocks(mem, "u1")
    assert "小明" in t1
    assert "小红" not in t1


@pytest.mark.asyncio
async def test_render_user_bucket_appears_before_memory_bucket():
    mem = MemoryStore(InMemoryStore())
    await mem.add("u1", "memory", "ENV_FACT")
    await mem.add("u1", "user", "USER_PREF")
    text = await render_memory_blocks(mem, "u1")
    assert text.index("USER_PREF") < text.index("ENV_FACT")


@pytest.mark.asyncio
async def test_header_includes_usage_percentage():
    mem = MemoryStore(InMemoryStore())
    await mem.add("u1", "user", "x" * 137)  # ~10% of 1375
    text = await render_memory_blocks(mem, "u1")
    assert "/1375 chars" in text
