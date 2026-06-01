import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from langchain_core.messages import SystemMessage
from backend.src.wechat_middleware import WeChatChannelMiddleware

@pytest.mark.asyncio
async def test_wechat_channel_middleware_wechat():
    """Verify that WeChatChannelMiddleware injects WeChat instructions when channel is 'wechat'."""
    middleware = WeChatChannelMiddleware()
    
    # Mock get_config to return channel = 'wechat'
    mock_config = {
        "metadata": {
            "channel": "wechat",
            "chat_name": "测试微信群",
            "sender": "小明"
        }
    }
    
    # Create a mock ModelRequest
    request = MagicMock()
    request.system_message = SystemMessage(content="你是智能助手。")
    request.runtime = MagicMock()
    
    async def handler(req):
        return req
        
    with patch("backend.src.wechat_middleware.get_config", return_value=mock_config):
        res = await middleware.awrap_model_call(request, handler)
        
    assert "【渠道上下文控制：微信环境 (Channel: WeChat)】" in res.system_message.content
    assert "测试微信群" in res.system_message.content
    assert "小明" in res.system_message.content


@pytest.mark.asyncio
async def test_wechat_channel_middleware_web():
    """Verify that WeChatChannelMiddleware injects Web instructions when channel is 'web'."""
    middleware = WeChatChannelMiddleware()
    
    # Mock get_config to return channel = 'web'
    mock_config = {
        "metadata": {
            "channel": "web",
            "chat_name": "Web网页端",
            "sender": "Web用户"
        }
    }
    
    # Create a mock ModelRequest
    request = MagicMock()
    request.system_message = SystemMessage(content="你是智能助手。")
    request.runtime = MagicMock()
    
    async def handler(req):
        return req
        
    with patch("backend.src.wechat_middleware.get_config", return_value=mock_config):
        res = await middleware.awrap_model_call(request, handler)
        
    assert "【渠道上下文控制：Web网页端 (Channel: Web)】" in res.system_message.content
    assert "Web网页端" in res.system_message.content
    assert "Web用户" in res.system_message.content
    assert "点击下载" in res.system_message.content
