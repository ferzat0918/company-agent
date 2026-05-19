"""命名空间化的 Store 封装。

每个用户的记忆放在 (user_id, bucket) 命名空间下。
bucket 只能是 "memory" 或 "user"。
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from langgraph.store.base import BaseStore

Bucket = Literal["memory", "user"]
VALID_BUCKETS: set[Bucket] = {"memory", "user"}


@dataclass
class MemoryEntry:
    key: str
    content: str
    created_at: str


class MemoryStore:
    """Per-user, per-bucket memory wrapper over a LangGraph BaseStore."""

    def __init__(self, backend: BaseStore) -> None:
        self._backend = backend

    @staticmethod
    def _ns(user_id: str, bucket: Bucket) -> tuple[str, str]:
        if bucket not in VALID_BUCKETS:
            raise ValueError(f"Invalid bucket: {bucket!r}")
        return (user_id, bucket)

    async def add(self, user_id: str, bucket: Bucket, content: str) -> MemoryEntry:
        key = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        await self._backend.aput(
            namespace=self._ns(user_id, bucket),
            key=key,
            value={"content": content, "created_at": created_at},
        )
        return MemoryEntry(key=key, content=content, created_at=created_at)

    async def read_all(self, user_id: str, bucket: Bucket) -> list[MemoryEntry]:
        items = await self._backend.asearch(self._ns(user_id, bucket))
        return [
            MemoryEntry(
                key=it.key,
                content=it.value["content"],
                created_at=it.value["created_at"],
            )
            for it in items
        ]

    async def remove_by_key(self, user_id: str, bucket: Bucket, key: str) -> None:
        await self._backend.adelete(self._ns(user_id, bucket), key)
