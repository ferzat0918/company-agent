"""Configuration from environment"""
import os
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")

POSTGRES_URI = os.getenv(
    "POSTGRES_URI",
    "postgresql://postgres:password@localhost:5432/postgres"
)
