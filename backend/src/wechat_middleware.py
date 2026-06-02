"""根据 channel metadata 动态注入渠道专属系统提示词。

同一个 supervisor agent，运行时根据 config metadata 中的 channel 字段
选择加载 Web 或 WeChat 风格的提示词，拼接到系统消息末尾。

基础 prompt（supervisor.md、subagent prompts）不包含任何渠道相关的格式指令，
渠道 prompt 是唯一的格式权威源，避免 LLM 面对前后矛盾的指令。
"""
from typing import Any, Callable
from langchain.agents.middleware.types import AgentMiddleware, ModelRequest
from langchain_core.messages import SystemMessage
from langgraph.config import get_config


class WeChatChannelMiddleware(AgentMiddleware):
    """根据 channel metadata 动态注入渠道专属系统提示词。

    初始化时接收两套渠道 prompt（从文件加载），运行时根据 config
    中的 channel 字段选择对应的 prompt 拼接到系统消息末尾。

    基础 prompt 已不含任何渠道相关的格式指令，因此不存在指令冲突。
    """

    def __init__(self, wechat_channel_prompt: str, web_channel_prompt: str):
        super().__init__()
        self._wechat_prompt = wechat_channel_prompt
        self._web_prompt = web_channel_prompt

    def _detect_channel(self) -> tuple[str, str, str]:
        """从当前 RunnableConfig 中读取渠道信息。

        Returns:
            (channel, chat_name, sender) 三元组
        """
        try:
            config = get_config()
            metadata = config.get("metadata", {})
            configurable = config.get("configurable", {})

            channel = configurable.get("channel") or metadata.get("channel", "web")
            chat_name = configurable.get("chat_name") or metadata.get("chat_name", "未知会话")
            sender = configurable.get("sender") or metadata.get("sender", "未知发送者")
        except Exception as e:
            import traceback
            print("!!! WeChatChannelMiddleware EXCEPTION in _detect_channel():", e)
            traceback.print_exc()
            channel = "web"
            chat_name = "未知会话"
            sender = "未知发送者"

        return channel, chat_name, sender

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Any],
    ) -> Any:
        channel, chat_name, sender = self._detect_channel()

        # 根据渠道选择对应的 prompt 模板并填充动态变量
        if channel == "wechat":
            channel_prompt = self._wechat_prompt.format(
                chat_name=chat_name, sender=sender
            )
        else:
            channel_prompt = self._web_prompt.format(
                chat_name=chat_name, sender=sender
            )

        # 拼接到系统消息末尾
        # 基础 prompt 已不含渠道格式指令，渠道 prompt 是唯一格式权威
        if request.system_message is not None:
            content = request.system_message.content

            if isinstance(content, list):
                new_content = list(content)
                new_content.append({"type": "text", "text": "\n\n" + channel_prompt})
            else:
                new_content = str(content) + "\n\n" + channel_prompt

            request.system_message = SystemMessage(content=new_content)

        return await handler(request)
