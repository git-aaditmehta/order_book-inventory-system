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
    payload = None
    
    # Verify JWT if secret is present
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token, 
                settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                options={"verify_aud": False}
            )
        except Exception as e:
            logger.error(f"JWT decode error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token."
            )
    else:
        # Fallback: call Supabase auth service if secret is not set locally
        try:
            supabase = get_supabase()
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                payload = {
                    "sub": user_response.user.id,
                    "email": user_response.user.email,
                    "user_metadata": user_response.user.user_metadata or {}
                }
        except Exception as err:
            logger.error(f"Supabase auth check failed: {err}")

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials."
        )

    user_id = payload.get("sub")
    user_email = payload.get("email", "")

    # Fetch role from public.profiles database table
    try:
        supabase = get_supabase()
        res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            role = res.data[0].get("role", "MANAGER")
        else:
            role = payload.get("user_metadata", {}).get("role", "MANAGER")
    except Exception as ex:
        logger.warning(f"Failed to query profiles table: {ex}")
        role = payload.get("user_metadata", {}).get("role", "MANAGER")

    return UserProfile(id=user_id, email=user_email, role=role.upper())

async def require_owner(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if current_user.role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Owner only."
        )
    return current_user
