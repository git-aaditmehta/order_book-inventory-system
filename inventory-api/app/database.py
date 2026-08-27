from supabase import create_client, Client
from app.config import settings
import logging

logger = logging.getLogger("uvicorn")

def get_supabase() -> Client:
    """Returns initialized Supabase Admin Client using service role key."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment.")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
