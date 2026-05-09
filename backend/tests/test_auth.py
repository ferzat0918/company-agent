"""Tests for Supabase JWT auth handler"""
import pytest
import jwt
from datetime import datetime, timedelta

from backend.src.auth import verify_supabase_jwt
from backend.src.config import SUPABASE_JWT_SECRET
from langgraph_sdk.auth.exceptions import HTTPException


@pytest.mark.asyncio
async def test_verify_valid_token():
    user_id = "test-uuid-123"
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(hours=1)},
        SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    result = await verify_supabase_jwt(f"Bearer {token}")
    assert result["identity"] == user_id


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
    token = jwt.encode(
        {"sub": "test", "exp": datetime.utcnow() - timedelta(hours=1)},
        SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        await verify_supabase_jwt(f"Bearer {token}")
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token expired"
