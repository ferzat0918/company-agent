"""Supabase profiles table access layer"""
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class UserProfile:
    user_id: str
    dept: str
    role: str
    region: Optional[str] = None


class ProfileNotFound(Exception):
    pass


async def get_profile(user_id: str, supabase_url: str = "http://localhost:8000", anon_key: str = "") -> Optional[UserProfile]:
    """Query user profile by user_id from Supabase profiles table."""
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
