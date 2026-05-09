"""Supabase JWT authentication handler for LangGraph @auth"""
import jwt
from langgraph_sdk.auth import Auth
from langgraph_sdk.auth.exceptions import HTTPException
from .config import SUPABASE_JWT_SECRET

auth = Auth()


@auth.authenticate
async def verify_supabase_jwt(authorization: str | None) -> dict:
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
        return {"identity": payload["sub"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

__all__ = ["auth"]
