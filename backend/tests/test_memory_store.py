import pytest
from langgraph.store.memory import InMemoryStore
from src.memory.store import MemoryStore, MemoryEntry

USER_A = "user-aaa"
USER_B = "user-bbb"


@pytest.mark.asyncio
async def test_write_then_read_back_same_user():
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    entry = await mem.add(USER_A, "memory", "用户喜欢简洁回答")
    items = await mem.read_all(USER_A, "memory")
    assert len(items) == 1
    assert items[0].content == "用户喜欢简洁回答"
    assert items[0].key == entry.key


@pytest.mark.asyncio
async def test_cross_user_isolation():
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    await mem.add(USER_A, "memory", "A 的秘密")
    await mem.add(USER_B, "memory", "B 的秘密")
    a_items = await mem.read_all(USER_A, "memory")
    b_items = await mem.read_all(USER_B, "memory")
    assert [e.content for e in a_items] == ["A 的秘密"]
    assert [e.content for e in b_items] == ["B 的秘密"]


@pytest.mark.asyncio
async def test_bucket_isolation_within_user():
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    await mem.add(USER_A, "memory", "环境事实")
    await mem.add(USER_A, "user", "用户偏好")
    assert len(await mem.read_all(USER_A, "memory")) == 1
    assert len(await mem.read_all(USER_A, "user")) == 1


@pytest.mark.asyncio
async def test_remove_by_key():
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    e = await mem.add(USER_A, "memory", "可删除")
    await mem.remove_by_key(USER_A, "memory", e.key)
    assert await mem.read_all(USER_A, "memory") == []
