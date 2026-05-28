"""Supabase profiles table access layer.

Uses the service key (bypasses RLS) because backend lookups happen after
the JWT has already been validated — the user's identity is trusted,
we just need to enrich it with dept/role from `public.profiles`, which
has RLS enabled and is not readable by the anon role.
"""
from dataclasses import dataclass
from typing import Optional
import httpx

from .config import SUPABASE_URL, SUPABASE_SERVICE_KEY


@dataclass
class UserProfile:
    user_id: str
    dept: str
    role: str
    region: Optional[str] = None


class ProfileNotFound(Exception):
    pass


async def get_profile(
    user_id: str,
    supabase_url: str | None = None,
    service_key: str | None = None,
) -> Optional[UserProfile]:
    """Query user profile by user_id from Supabase profiles table."""
    supabase_url = supabase_url or SUPABASE_URL
    service_key = service_key or SUPABASE_SERVICE_KEY
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/profiles",
            params={"user_id": f"eq.{user_id}"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
        )
        if resp.status_code != 200 or not resp.json():
            return None
        data = resp.json()[0]
        return UserProfile(
            user_id=data["user_id"],
            dept=data["dept"],
            role=data.get("role", ""),
            region=data.get("region"),
        )


async def get_profile_by_wechat_nickname(
    wechat_nickname: str,
    supabase_url: str | None = None,
    service_key: str | None = None,
) -> Optional[UserProfile]:
    """Query user profile by wechat_nickname from Supabase profiles table."""
    supabase_url = supabase_url or SUPABASE_URL
    service_key = service_key or SUPABASE_SERVICE_KEY
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/profiles",
            params={"wechat_nickname": f"eq.{wechat_nickname}"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
        )
        if resp.status_code != 200 or not resp.json():
            return None
        data = resp.json()[0]
        return UserProfile(
            user_id=data["user_id"],
            dept=data["dept"],
            role=data.get("role", ""),
            region=data.get("region"),
        )

