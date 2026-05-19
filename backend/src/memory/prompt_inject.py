"""每个 thread 启动时把当前用户的记忆渲染成 Hermes 风格的两个块。"""
from __future__ import annotations

from typing import Any, Callable

from langchain.agents.middleware.types import AgentMiddleware, ModelRequest
from langchain_core.messages import SystemMessage
from langgraph.runtime import Runtime
from langgraph.store.base import BaseStore

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

    同时把当前 thread 解析出的 user_id 和平台注入的 store 缓存到实例字段上，
    供同一个 thread 内的 memory tool 复用（避免每次工具调用都重新走 runtime）。
    """

    def __init__(
        self,
        get_user_id_from_runtime: Callable[[Runtime[Any]], str | None],
    ) -> None:
        super().__init__()
        self._get_user_id = get_user_id_from_runtime
        self._last_user_id: str | None = None
        self._last_store: BaseStore | None = None

    async def abefore_agent(
        self, state: dict[str, Any], runtime: Runtime[Any]
    ) -> dict[str, Any] | None:
        """Cache the per-thread user_id and store for downstream hooks.

        Returns no state updates — the actual memory injection happens inside
        awrap_model_call, which mutates ModelRequest.system_message (the LLM-
        only system slot) instead of state.messages. This keeps memory out of
        the persisted message list, so:
          - the frontend never renders it as a chat bubble, and
          - it doesn't accumulate one duplicate per turn.
        """
        self._last_user_id = self._get_user_id(runtime)
        self._last_store = getattr(runtime, "store", None)
        return None

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Any],
    ) -> Any:
        # Re-read store/user_id on every model call — abefore_agent caches
        # them at agent start but the request's own runtime is the truth.
        runtime = request.runtime
        user_id = self._get_user_id(runtime) if runtime else self._last_user_id
        store = (getattr(runtime, "store", None) if runtime else None) or self._last_store
        # Keep cache fresh so the memory tool sees the same values.
        if user_id is not None:
            self._last_user_id = user_id
        if store is not None:
            self._last_store = store

        if user_id and store is not None:
            mem = MemoryStore(store)
            block = await render_memory_blocks(mem, user_id)
            if block:
                if request.system_message is not None:
                    request.system_message = SystemMessage(
                        content=f"{request.system_message.content}\n\n{block}"
                    )
                else:
                    request.system_message = SystemMessage(content=block)
        return await handler(request)
