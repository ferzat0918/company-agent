"""Supabase JWT authentication handler for LangGraph @auth.

NOTE: This file is loaded DIRECTLY by LangGraph Server (not as part of a
package), so we CANNOT use relative imports like `from .config import ...`.
All configuration must be read from environment variables directly.

Flow:
  1. Validate JWT from Authorization header
  2. Query Supabase profiles table for user's dept/role/region
  3. Return identity + user_profile in the auth context
  4. LangGraph injects this into RunnableConfig for every node
"""
import os
import jwt
import httpx
from dotenv import load_dotenv
from langgraph_sdk.auth import Auth
from langgraph_sdk.auth.exceptions import HTTPException

# Load .env for local development and tests
load_dotenv()

# Read config from environment (can't use relative imports here)
_jwt_secret = os.environ.get("JWT_SECRET") or os.environ.get("SUPABASE_JWT_SECRET")
if not _jwt_secret:
    raise RuntimeError("Missing required env var: JWT_SECRET")

_supabase_url = os.environ.get("SUPABASE_URL", "http://localhost:8000")
_supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "")
# Service key bypasses RLS — needed to look up profiles server-side after
# RLS was enabled on `public.profiles`. Falls back to anon for dev/test.
_supabase_service_key = os.environ.get("SUPABASE_SERVICE_KEY", _supabase_anon_key)

auth = Auth()


async def _get_profile(user_id: str) -> dict | None:
    """Query Supabase profiles table for user info."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_supabase_url}/rest/v1/profiles",
                params={"user_id": f"eq.{user_id}", "select": "*"},
                headers={
                    "apikey": _supabase_service_key,
                    "Authorization": f"Bearer {_supabase_service_key}",
                },
            )
            if resp.status_code == 200 and resp.json():
                return resp.json()[0]
    except Exception:
        pass
    return None


@auth.authenticate
async def verify_supabase_jwt(authorization: str | None) -> dict:
    """Authenticate request by verifying Supabase JWT and loading user profile."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        payload = jwt.decode(
            token,
            _jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload["sub"]

    # Query profiles table for dept/role/region
    profile = await _get_profile(user_id)

    if profile:
        return {
            "identity": user_id,
            "user_profile": {
                "user_id": user_id,
                "dept": profile.get("dept", "unknown"),
                "role": profile.get("role", ""),
                "region": profile.get("region"),
            },
        }
    else:
        # User exists in auth.users but not in profiles table
        return {
            "identity": user_id,
            "user_profile": {
                "user_id": user_id,
                "dept": "unknown",
                "role": "",
                "region": None,
            },
        }


# ──────────────────────────────────────────────────────────
# Resource-level authorization: thread isolation per user
# ──────────────────────────────────────────────────────────

FREDDY_SUB_UUID = "d81a0391-2663-4f0b-ba89-39f17773a9a1"


async def _get_profile_by_wechat_nickname(wechat_nickname: str) -> dict | None:
    """Query Supabase profiles table by wechat_nickname."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_supabase_url}/rest/v1/profiles",
                params={"wechat_nickname": f"eq.{wechat_nickname}", "select": "*"},
                headers={
                    "apikey": _supabase_service_key,
                    "Authorization": f"Bearer {_supabase_service_key}",
                },
            )
            if resp.status_code == 200 and resp.json():
                return resp.json()[0]
    except Exception:
        pass
    return None


@auth.on.threads.create
async def on_thread_create(ctx, value):
    """Stamp every new thread with the owner's identity."""
    metadata = value.setdefault("metadata", {})
    owner = ctx.user.identity

    # If created in the WeChat channel, try to bind to the real employee account
    if metadata.get("channel") == "wechat":
        chat_name = metadata.get("chat_name") or metadata.get("sender")
        if chat_name:
            profile = await _get_profile_by_wechat_nickname(chat_name)
            if profile:
                owner = profile.get("user_id") or owner

    metadata["owner"] = owner
    return value


@auth.on.threads.read
async def on_thread_read(ctx, value):
    """Only return threads owned by the current user (except WeChat RPA superuser)."""
    if ctx.user.identity == FREDDY_SUB_UUID:
        return {}
    return {"owner": ctx.user.identity}


@auth.on.threads.update
async def on_thread_update(ctx, value):
    """Only allow updating threads owned by the current user (except WeChat RPA superuser)."""
    if ctx.user.identity == FREDDY_SUB_UUID:
        return {}
    return {"owner": ctx.user.identity}


@auth.on.threads.delete
async def on_thread_delete(ctx, value):
    """Only allow deleting threads owned by the current user (except WeChat RPA superuser)."""
    if ctx.user.identity == FREDDY_SUB_UUID:
        return {}
    return {"owner": ctx.user.identity}


@auth.on.threads.search
async def on_thread_search(ctx, value):
    """Only list threads owned by the current user (except WeChat RPA superuser)."""
    if ctx.user.identity == FREDDY_SUB_UUID:
        return {}
    return {"owner": ctx.user.identity}


__all__ = ["auth"]

