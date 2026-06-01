"""Tests for Supabase JWT auth handler with user profile injection."""
import pytest
import jwt
from datetime import datetime, timedelta, UTC
from unittest.mock import patch, MagicMock, AsyncMock

from backend.src.auth import verify_supabase_jwt, _jwt_secret
from langgraph_sdk.auth.exceptions import HTTPException


def _make_token(sub: str, expired: bool = False) -> str:
    """Helper to create a JWT token for testing."""
    if expired:
        exp = datetime.now(UTC) - timedelta(hours=1)
    else:
        exp = datetime.now(UTC) + timedelta(hours=1)
    return jwt.encode(
        {"sub": sub, "exp": exp},
        _jwt_secret,
        algorithm="HS256",
    )


@pytest.mark.asyncio
async def test_verify_valid_token_with_profile():
    """When user has a profile, auth should return full user_profile."""
    user_id = "test-uuid-123"
    token = _make_token(user_id)

    mock_profile = {
        "user_id": user_id,
        "dept": "marketing",
        "role": "营销经理",
        "region": "cn",
    }

    with patch("backend.src.auth._get_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_profile
        result = await verify_supabase_jwt(f"Bearer {token}")

    assert result["identity"] == user_id
    assert result["user_profile"]["dept"] == "marketing"
    assert result["user_profile"]["role"] == "营销经理"
    assert result["user_profile"]["region"] == "cn"


@pytest.mark.asyncio
async def test_verify_valid_token_without_profile():
    """When user has no profile, auth should return fallback with dept='unknown'."""
    user_id = "test-uuid-no-profile"
    token = _make_token(user_id)

    with patch("backend.src.auth._get_profile", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        result = await verify_supabase_jwt(f"Bearer {token}")

    assert result["identity"] == user_id
    assert result["user_profile"]["dept"] == "unknown"
    assert result["user_profile"]["role"] == ""
    assert result["user_profile"]["region"] is None


@pytest.mark.asyncio
async def test_verify_invalid_token():
    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_jwt("Bearer invalid.token.here")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


@pytest.mark.asyncio
async def test_verify_no_header():
    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_jwt(None)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Missing Authorization header"


@pytest.mark.asyncio
async def test_verify_expired_token():
    token = _make_token("test", expired=True)
    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_jwt(f"Bearer {token}")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token expired"


@pytest.mark.asyncio
async def test_on_thread_create():
    from backend.src.auth import on_thread_create
    
    # 1. WeChat case: metadata already has channel
    ctx = MagicMock()
    ctx.user.identity = "test-owner-id"
    
    value_wechat = {
        "metadata": {
            "channel": "wechat",
            "chat_name": "阿三",
            "sender": "张三"
        }
    }
    
    res_wechat = await on_thread_create(ctx, value_wechat)
    assert res_wechat["metadata"]["owner"] == "test-owner-id"
    assert res_wechat["metadata"]["channel"] == "wechat"
    assert res_wechat["metadata"]["chat_name"] == "阿三"
    assert res_wechat["metadata"]["sender"] == "张三"

    # 2. Web case: metadata is empty/missing channel
    value_web = {}
    res_web = await on_thread_create(ctx, value_web)
    assert res_web["metadata"]["owner"] == "test-owner-id"
    assert res_web["metadata"]["channel"] == "web"
    assert res_web["metadata"]["chat_name"] == "Web网页端"
    assert res_web["metadata"]["sender"] == "Web用户"


@pytest.mark.asyncio
async def test_on_thread_read_and_mutation_auth():
    from backend.src.auth import (
        on_thread_read,
        on_thread_update,
        on_thread_delete,
        on_thread_search,
    )
    
    ctx = MagicMock()
    ctx.user.identity = "user-123"
    
    # Read
    res_read = await on_thread_read(ctx, {})
    assert res_read == {"owner": "user-123"}
    
    # Update
    res_update = await on_thread_update(ctx, {})
    assert res_update == {"owner": "user-123"}
    
    # Delete
    res_delete = await on_thread_delete(ctx, {})
    assert res_delete == {"owner": "user-123"}
    
    # Search
    res_search = await on_thread_search(ctx, {})
    assert res_search == {"owner": "user-123"}


