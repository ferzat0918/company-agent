"""Configuration from environment.

All secrets are loaded from environment variables.
If a required secret is missing, the application will fail fast
with a clear error rather than silently using an insecure default.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─── LLM ────────────────────────────────────────────────────────
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

# Multi-key support: comma-separated list for round-robin load balancing
# e.g. DEEPSEEK_API_KEYS=sk-key1,sk-key2,sk-key3
_raw_keys = os.getenv("DEEPSEEK_API_KEYS", "")
DEEPSEEK_API_KEYS: list[str] = [
    k.strip() for k in _raw_keys.split(",") if k.strip()
] or ([DEEPSEEK_API_KEY] if DEEPSEEK_API_KEY else [])

# ─── Supabase ───────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_jwt_secret = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
if not _jwt_secret:
    raise RuntimeError(
        "Missing required env var: JWT_SECRET (or SUPABASE_JWT_SECRET). "
        "Copy .env.example to .env and fill in your secrets."
    )
SUPABASE_JWT_SECRET: str = _jwt_secret

# ─── Database ───────────────────────────────────────────────────
_pg_uri = os.getenv("POSTGRES_URI")
if not _pg_uri:
    raise RuntimeError(
        "Missing required env var: POSTGRES_URI. "
        "Copy .env.example to .env and fill in your secrets."
    )
POSTGRES_URI: str = _pg_uri
