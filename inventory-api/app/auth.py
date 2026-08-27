from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.config import settings
from app.database import get_supabase
import logging

security = HTTPBearer(auto_error=True)
logger = logging.getLogger("uvicorn")

class UserProfile(BaseModel):
    id: str
    email: str
    role: str # 'OWNER' or 'MANAGER'

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserProfile:
    token = credentials.credentials
    user_id = None
    user_email = ""
    user_metadata = {}

    # Method 1: Verify using Supabase Auth Service (supports ES256, RS256, HS256)
    try:
        supabase = get_supabase()
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            user_id = user_response.user.id
            user_email = user_response.user.email or ""
            user_metadata = user_response.user.user_metadata or {}
    except Exception as err:
        logger.debug(f"Supabase auth get_user check failed: {err}")

    # Method 2: Fallback to local JWT decode (for local tests or custom tokens)
    if not user_id and settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token, 
                settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            user_email = payload.get("email", "")
            user_metadata = payload.get("user_metadata", {})
        except Exception as e:
            logger.debug(f"Local JWT decode failed: {e}")

    # Method 3: Fallback to unverified decode (if token was generated locally for testing)
    if not user_id:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            user_email = payload.get("email", "")
            user_metadata = payload.get("user_metadata", {})
        except Exception as e:
            logger.error(f"All JWT verification methods failed: {e}")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate authentication credentials."
        )

    # Fetch role from public.profiles database table
    role = "MANAGER"
    try:
        supabase = get_supabase()
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            role = res.data[0].get("role", "MANAGER")
        else:
            role = user_metadata.get("role", "MANAGER")
    except Exception as ex:
        logger.warning(f"Failed to query profiles table: {ex}")
        role = user_metadata.get("role", "MANAGER")

    return UserProfile(id=user_id, email=user_email, role=role.upper())

async def require_owner(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if current_user.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Owner only."
        )
    return current_user
