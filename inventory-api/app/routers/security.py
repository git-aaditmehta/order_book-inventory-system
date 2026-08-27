from fastapi import APIRouter, Depends, Request
from typing import List, Dict, Any
from app.auth import require_owner, UserProfile
from datetime import datetime
import logging

router = APIRouter(prefix="/security", tags=["Owner Security Control"])
logger = logging.getLogger("uvicorn")

@router.get("/sessions")
async def get_active_sessions(
    request: Request,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner endpoint: View current active user sessions and device info."""
    client_ip = request.client.host if request.client else "Unknown"
    user_agent = request.headers.get("user-agent", "Unknown Browser/Device")
    
    return {
        "owner_email": current_user.email,
        "current_request_ip": client_ip,
        "current_device": user_agent,
        "active_sessions": [
            {
                "user_id": current_user.id,
                "email": current_user.email,
                "role": current_user.role,
                "ip_address": client_ip,
                "device": user_agent,
                "last_active": datetime.utcnow().isoformat(),
                "status": "Active"
            }
        ]
    }
