"""每个 thread 启动时把当前用户的记忆渲染成 Hermes 风格的两个块。"""
from __future__ import annotations

from typing import Any, Callable

from langchain.agents.middleware.types import AgentMiddleware
from langgraph.runtime import Runtime

from .store import Bucket, MemoryStore

# 字符上限，跟 Hermes 一致
LIMITS: dict[Bucket, int] = {"memory": 2200, "user": 1375}

BLOCK_TITLES: dict[Bucket, str] = {
    "memory": "MEMORY (your personal notes)",
    "user": "USER PROFILE (what you know about the user)",
}


async def render_memory_blocks(store: MemoryStore, user_id: str) -> str:
    """读取该用户的两个桶，渲染成可贴在系统提示前的文本块。"""
    parts: list[str] = []
    # user 优先级更高，先渲染
    for bucket in ("user", "memory"):
        entries = await store.read_all(user_id, bucket)
        if not entries:
            continue
        body = "\n§\n".join(e.content for e in entries)
        used = len(body)
        limit = LIMITS[bucket]
        pct = int(used * 100 / limit) if limit else 0
        header = (
            f"══════════════════════════════════════════════\n"
            f"{BLOCK_TITLES[bucket]} [{pct}% — {used}/{limit} chars]\n"
            f"══════════════════════════════════════════════"
        )
        parts.append(f"{header}\n{body}")
    return "\n\n".join(parts)


class MemoryInjectMiddleware(AgentMiddleware):
    """每个 agent 执行启动时把记忆块拼到系统消息前面。

    用 abefore_agent 钩子，会话期间不会再次触发 —— 即保证了冻结快照语义。

    Also caches the resolved user_id so other components (memory_tool factory)
    can read the current request's user without re-walking the runtime context.
    """

    def __init__(
        self,
        store: MemoryStore,
        get_user_id_from_runtime: Callable[[Runtime[Any]], str | None],
    ) -> None:
        super().__init__()
        self._store = store
        self._get_user_id = get_user_id_from_runtime
        self._last_user_id: str | None = None

    async def abefore_agent(
        self, state: dict[str, Any], runtime: Runtime[Any]
    ) -> dict[str, Any] | None:
        user_id = self._get_user_id(runtime)
        self._last_user_id = user_id
        if not user_id:
            return None
        block = await render_memory_blocks(self._store, user_id)
        if not block:
            return None
        return {"memory_block": block}
