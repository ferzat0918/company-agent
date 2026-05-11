"""ChatDeepSeek with reasoning_content preservation for multi-turn conversations.

DeepSeek's thinking mode requires that when the model performs tool calls,
the reasoning_content from that assistant message must be passed back verbatim
in all subsequent requests. LangChain's message serialization
(_convert_message_to_dict) strips this field from AIMessage.additional_kwargs,
causing a 400 error. This subclass restores it.
"""
from collections.abc import Sequence
from typing import Any

from langchain_core.language_models import LanguageModelInput
from langchain_core.messages import AIMessage
from langchain_deepseek import ChatDeepSeek


class ChatDeepSeekThinking(ChatDeepSeek):
    """ChatDeepSeek that preserves reasoning_content for multi-turn conversations."""

    def _get_request_payload(
        self,
        input_: LanguageModelInput,
        *,
        stop: list[str] | None = None,
        **kwargs: Any,
    ) -> dict:
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)

        if isinstance(input_, Sequence) and not isinstance(input_, str):
            for i, msg in enumerate(input_):
                if i >= len(payload["messages"]):
                    break
                if isinstance(msg, AIMessage):
                    reasoning = msg.additional_kwargs.get("reasoning_content")
                    if reasoning:
                        payload["messages"][i]["reasoning_content"] = reasoning

        return payload
