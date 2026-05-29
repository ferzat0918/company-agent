from typing import Any, Callable
from langchain.agents.middleware.types import AgentMiddleware, ModelRequest
from langchain_core.messages import SystemMessage
from langgraph.config import get_config

class WeChatChannelMiddleware(AgentMiddleware):
    """LangGraph Middleware to dynamically intercept and adapt model requests for WeChat."""

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Any],
    ) -> Any:
        try:
            # Dynamically fetch the current thread's RunnableConfig
            config = get_config()
            metadata = config.get("metadata", {})
            configurable = config.get("configurable", {})
            
            channel = configurable.get("channel") or metadata.get("channel", "web")
            chat_name = configurable.get("chat_name") or metadata.get("chat_name", "未知会话")
            sender = configurable.get("sender") or metadata.get("sender", "未知发送者")
        except Exception as e:
            import traceback
            print("!!! WeChatChannelMiddleware EXCEPTION in get_config():", e)
            traceback.print_exc()
            channel = "web"
            chat_name = "未知会话"
            sender = "未知发送者"

        if channel == "wechat":
            # Dynamically inject WeChat channel constraints and styling guide
            wechat_instruction = (
                f"\n\n【渠道上下文控制：微信环境 (Channel: WeChat)】\n"
                f"1. 当前会话发生在微信聊天室中 (当前窗口: {chat_name}，消息发送人: {sender})。\n"
                f"   - 【重要安全准则】如果这是群聊，历史聊天记录中的用户发言会自动带有 `[发言人姓名]: 消息内容` 的前缀（例如：`[阳光味儿的猫 UMX]: hello`）。请你务必仔细辨识每条历史消息的实际发言人，绝不可混淆他们的身份、姓名或历史对话背景！当前对你发起提问并期待你回复的是【{sender}】，请针对【{sender}】的问题进行专业且亲和的回答，且绝对不要在最终回复中带上 `[{sender}]: ` 这种前缀（这是给你的指示，不是你的输出格式）。\n"
                f"2. 【微信端专属风格激活】当前消息来自微信渠道！请立即推翻系统角色描述中关于『绝对禁止任何表情符号』和『冷峻冷酷』的旧限制！请切换为温暖亲和、幽默风趣、善用生动 Emoji 表情（如 🌟, 🚀, 🎉 等）的极客死党交互原则，分段易读，单次回复控制在 300 字以内！\n"
                f"3. 任何在沙盒中生成的文件，必须在回复中给予微信直推文件通道的温柔话术预警。\n"
                f"4. **文件发送与格式转换超级指南**：\n"
                f"   - **格式转换环境说明**：你的 Python 沙盒已经为您【预装了极为强大的格式转换与多媒体处理工具】：\n"
                f"     1. **视频与音频转码**：系统已预装 `ffmpeg` 命令（可处理 MOV、MP4、AVI、MP3 等）。你可以在代码中使用 `subprocess.run(['ffmpeg', '-y', '-i', 'input.mov', 'output.mp4'])` 极速、极其健壮地完成视频格式转换。\n"
                f"     2. **SVG 高可靠转换**：系统已安装命令行工具 `rsvg-convert`（来自 `librsvg2-bin`，可处理 SVG -> PNG/JPEG/PDF，支持宽高度参数）。在 Python 代码中执行 `subprocess.run(['rsvg-convert', '-o', 'output.png', 'input.svg'])` 是比任何纯 Python 库更加百分百成功、免编译且速度最快的转换方案！\n"
                f"     3. **图片通用处理**：已预装 `Pillow` 库，支持 JPG、PNG、WebP、BMP 等格式互转。已安装 `pdf2image` 和 `poppler-utils`，支持将 PDF 页面转换为图片。\n"
                f"   - **决策规则**：如果微信用户【没有明确指定格式】，就默认直接以原始的格式直接发送（使用 `send_wechat_file`），无需做任何额外转换！【只有当用户明确要求】特定格式（例如：\"帮我转成 PNG 发出来\" 或 \"把 MOV 转成 MP4 发我\"）时，你才必须调用 `execute_python_in_sandbox` 编写 Python 脚本调用 `subprocess.run` / `Pillow` 等库进行转码，转码完成后再调用 `send_wechat_file` 将转换后的新文件发送给用户！\n"
            )
            
            if request.system_message is not None:
                content = request.system_message.content
                
                if isinstance(content, list):
                    new_content = list(content)
                    new_content.append({"type": "text", "text": wechat_instruction})
                else:
                    new_content = str(content) + wechat_instruction
                
                request.system_message = SystemMessage(content=new_content)
                
        return await handler(request)
