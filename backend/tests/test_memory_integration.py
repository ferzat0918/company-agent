"""End-to-end 隔离测试：两个 user_id 写入互不可见。

不依赖 LangGraph runtime / Postgres，只用 InMemoryStore 走完整路径
（store → render_memory_blocks），确保命名空间隔离逻辑不退化。
"""
import pytest
from langgraph.store.memory import InMemoryStore

from src.memory.prompt_inject import render_memory_blocks
from src.memory.store import MemoryStore


@pytest.mark.asyncio
async def test_user_a_memory_not_visible_to_user_b():
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    await mem.add("user-a", "user", "A 的偏好：简洁")
    await mem.add("user-a", "memory", "A 的项目：alpha")
    await mem.add("user-b", "user", "B 的偏好：详细")

    block_a = await render_memory_blocks(mem, "user-a")
    block_b = await render_memory_blocks(mem, "user-b")

    assert "A 的偏好" in block_a
    assert "A 的项目" in block_a
    assert "B 的偏好" not in block_a

    assert "B 的偏好" in block_b
    assert "A 的偏好" not in block_b
    assert "A 的项目" not in block_b


@pytest.mark.asyncio
async def test_user_a_writes_dont_create_user_b_namespace():
    """Even a noisy write storm on user-a should leave user-b's view empty."""
    backend = InMemoryStore()
    mem = MemoryStore(backend)
    for i in range(20):
        await mem.add("user-a", "memory", f"事实 {i}")

    assert await render_memory_blocks(mem, "user-b") == ""


@pytest.mark.asyncio
async def test_concurrent_writes_dont_cross_users():
    import asyncio

    backend = InMemoryStore()
    mem = MemoryStore(backend)

    async def write(user_id: str, label: str) -> None:
        for i in range(10):
            await mem.add(user_id, "memory", f"{label}-{i}")

    await asyncio.gather(write("user-a", "A"), write("user-b", "B"))

    a_items = await mem.read_all("user-a", "memory")
    b_items = await mem.read_all("user-b", "memory")
    assert all(it.content.startswith("A-") for it in a_items)
    assert all(it.content.startswith("B-") for it in b_items)
    assert len(a_items) == 10
    assert len(b_items) == 10
