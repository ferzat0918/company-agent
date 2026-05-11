"""Supabase JWT authentication handler for LangGraph @auth.

Flow:
  1. Validate JWT from Authorization header
  2. Query Supabase profiles table for user's dept/role/region
  3. Return identity + user_profile in the auth context
  4. LangGraph injects this into RunnableConfig for every node
"""
import jwt
from langgraph_sdk.auth import Auth
from langgraph_sdk.auth.exceptions import HTTPException
from .config import SUPABASE_JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY
from .profiles import get_profile

auth = Auth()


@auth.authenticate
async def verify_supabase_jwt(authorization: str | None) -> dict:
    """Authenticate request by verifying Supabase JWT and loading user profile."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload["sub"]

    # Query profiles table for dept/role/region
    profile = await get_profile(user_id)

    if profile:
        return {
            "identity": user_id,
            "user_profile": {
                "user_id": user_id,
                "dept": profile.dept,
                "role": profile.role,
                "region": profile.region,
            },
        }
    else:
        # User exists in auth.users but not in profiles table
        # Allow access with a fallback profile (no dept routing)
        return {
            "identity": user_id,
            "user_profile": {
                "user_id": user_id,
                "dept": "unknown",
                "role": "",
                "region": None,
            },
        }


__all__ = ["auth"]
