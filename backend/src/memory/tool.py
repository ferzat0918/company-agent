"""memory 工具 —— AI 调用的对外接口。

工具描述里写"什么时候存"的引导，这是 AI 自主入库的关键。
"""
from __future__ import annotations

from typing import Callable, Literal

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from langgraph.store.base import BaseStore

from .security import scan_memory_content
from .store import Bucket, MemoryStore

MEMORY_TOOL_DESCRIPTION = """\
保存能跨会话存活的关键信息到长期记忆。记忆会注入未来会话的系统提示，
所以保持精简，只存日后还有用的事实。

主动存（不要等用户开口）：
- 用户纠正你，或者说"记住这个"/"别再这样了"
- 用户分享偏好、习惯或个人信息（姓名、角色、时区、沟通风格）
- 你发现关于环境的事（部门、岗位、所属团队、项目结构）
- 你学到这个用户特有的约定、API 怪癖或工作流
- 你识别出一个稳定事实，未来某次会话还用得上

优先级：用户偏好和纠正 > 环境事实 > 流程性知识。
最值钱的记忆是让用户不用重复说同一件事。

不要存：任务进度、会话产出、完成日志、临时 TODO 状态。

两个 target：
- 'user'   ：用户身份/偏好/沟通风格/雷区
- 'memory' ：你自己的笔记/环境事实/项目约定/教训

action：
- add     ：新增一条
- replace ：更新现有条（old_text 用一段短唯一子串定位）
- remove  ：删除一条（同上）

跳过：无关紧要的、容易重新发现的、原始数据 dump、临时任务状态。
"""


class MemoryToolInput(BaseModel):
    action: Literal["add", "replace", "remove"] = Field(description="动作")
    target: Bucket = Field(description="'user' 或 'memory'")
    content: str | None = Field(default=None, description="add/replace 时必填")
    old_text: str | None = Field(
        default=None, description="replace/remove 时必填的唯一短子串"
    )


def make_memory_tool(
    *,
    get_store: Callable[[], BaseStore | None],
    get_user_id: Callable[[], str | None],
) -> StructuredTool:
    """构造记忆工具实例。

    `get_store` / `get_user_id` 都是惰性 callable —— 真正的 Postgres Store 由
    LangGraph 平台在运行时注入到 runtime.store，所以工厂创建时拿不到，需要
    每次调用时再去取（middleware 的 abefore_agent 钩子会缓存它们）。
    """

    async def _run(
        action: str,
        target: Bucket,
        content: str | None = None,
        old_text: str | None = None,
    ) -> str:
        backend = get_store()
        user_id = get_user_id()
        if backend is None or user_id is None:
            return "Error: memory not initialized for this thread."
        store = MemoryStore(backend)

        if action == "add":
            if not content:
                return "Error: 'content' is required for action='add'."
            err = scan_memory_content(content)
            if err:
                return err
            entry = await store.add(user_id, target, content)
            # Emit a stream event so the frontend can render a Toast with an
            # undo button. Wrapped in try/except — in unit-test contexts
            # there's no stream writer and that's fine.
            try:
                from langgraph.config import get_stream_writer

                writer = get_stream_writer()
                writer({
                    "kind": "memory_saved",
                    "key": entry.key,
                    "target": target,
                    "content": content,
                })
            except Exception:
                pass
            return f"已存入 [{target}] (key={entry.key[:8]}…): {content}"

        if action in ("replace", "remove"):
            if not old_text:
                return f"Error: 'old_text' is required for action='{action}'."
            items = await store.read_all(user_id, target)
            matches = [it for it in items if old_text in it.content]
            if not matches:
                return f"Error: substring {old_text!r} matched 0 entries in [{target}]."
            if len(matches) > 1:
                return (
                    f"Error: substring {old_text!r} matched {len(matches)} entries "
                    f"in [{target}]. Provide a more specific substring."
                )
            hit = matches[0]
            if action == "remove":
                await store.remove_by_key(user_id, target, hit.key)
                return f"已删除 [{target}]: {hit.content}"
            # replace
            if not content:
                return "Error: 'content' is required for action='replace'."
            err = scan_memory_content(content)
            if err:
                return err
            await store.remove_by_key(user_id, target, hit.key)
            new_entry = await store.add(user_id, target, content)
            return f"已替换 [{target}] (key={new_entry.key[:8]}…): {content}"

        return f"Error: unknown action {action!r}."

    return StructuredTool.from_function(
        coroutine=_run,
        name="memory",
        description=MEMORY_TOOL_DESCRIPTION,
        args_schema=MemoryToolInput,
    )


# ────────────────────────────────────────────────────────────────
# memory_undo — invoked when the user clicks "撤销" on a Toast.
# Takes the entry's key (from the memory_saved stream event payload)
# and deletes it directly, no substring matching needed.
# ────────────────────────────────────────────────────────────────


class MemoryUndoInput(BaseModel):
    target: Bucket = Field(description="'user' 或 'memory'")
    key: str = Field(description="memory_saved 事件里返回的完整 UUID key")


def make_memory_undo_tool(
    *,
    get_store: Callable[[], BaseStore | None],
    get_user_id: Callable[[], str | None],
) -> StructuredTool:
    """构造 memory_undo 工具实例（参数风格同 make_memory_tool）。"""

    async def _undo(target: Bucket, key: str) -> str:
        backend = get_store()
        user_id = get_user_id()
        if backend is None or user_id is None:
            return "Error: memory not initialized for this thread."
        store = MemoryStore(backend)
        await store.remove_by_key(user_id, target, key)
        return f"已撤销 [{target}] key={key[:8]}…"

    return StructuredTool.from_function(
        coroutine=_undo,
        name="memory_undo",
        description=(
            "撤销最近的一次 memory.add —— 按完整 key 精确删除一条记忆。"
            "只在用户点 Toast 的'撤销'按钮时调用（前端会发一个特殊的"
            "__undo_memory__:<target>:<key> 用户消息触发你）。"
        ),
        args_schema=MemoryUndoInput,
    )
