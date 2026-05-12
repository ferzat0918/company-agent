"""Round-robin LLM wrapper for multi API key load balancing.

Distributes requests across multiple ChatDeepSeekThinking instances,
each with a different API key, using a thread-safe round-robin counter.
"""
import threading
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any, Optional

from langchain_core.callbacks import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun
from langchain_core.language_models import LanguageModelInput
from langchain_core.messages import BaseMessage, BaseMessageChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.runnables import RunnableConfig

from .chat_models import ChatDeepSeekThinking


class RoundRobinChatModel(ChatDeepSeekThinking):
    """Distributes requests across multiple API keys using round-robin.

    Drop-in replacement for ChatDeepSeekThinking. If only one key is
    provided, behaves identically to the base class.
    """

    _instances: list[ChatDeepSeekThinking] = []
    _counter: int = 0
    _lock: threading.Lock = threading.Lock()

    def __init__(self, api_keys: list[str], **kwargs: Any):
        # Initialize self with the first key (for schema/metadata)
        super().__init__(api_key=api_keys[0], **kwargs)

        # Create one instance per key
        self._instances = [
            ChatDeepSeekThinking(api_key=key, **kwargs)
            for key in api_keys
        ]
        self._counter = 0
        self._lock = threading.Lock()

        key_count = len(api_keys)
        masked = [f"{k[:8]}...{k[-4:]}" for k in api_keys]
        print(f"[RoundRobin] Initialized with {key_count} API key(s): {masked}")

    def _next_instance(self) -> ChatDeepSeekThinking:
        """Get the next LLM instance in round-robin order (thread-safe)."""
        with self._lock:
            idx = self._counter % len(self._instances)
            self._counter += 1
            return self._instances[idx]

    # --- Override all entry points to delegate to round-robin instance ---

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        instance = self._next_instance()
        return instance._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        instance = self._next_instance()
        return await instance._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        instance = self._next_instance()
        yield from instance._stream(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        instance = self._next_instance()
        async for chunk in instance._astream(messages, stop=stop, run_manager=run_manager, **kwargs):
            yield chunk
