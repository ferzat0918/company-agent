"""Supabase profiles table access layer"""
from dataclasses import dataclass
from typing import Optional
import httpx

from .config import SUPABASE_URL, SUPABASE_ANON_KEY


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
    anon_key: str | None = None,
) -> Optional[UserProfile]:
    """Query user profile by user_id from Supabase profiles table."""
    supabase_url = supabase_url or SUPABASE_URL
    anon_key = anon_key or SUPABASE_ANON_KEY
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/profiles",
            params={"user_id": f"eq.{user_id}"},
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
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
