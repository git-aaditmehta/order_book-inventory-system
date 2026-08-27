from fastapi import APIRouter, Depends
from app.auth import get_current_user, UserProfile

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])

@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: UserProfile = Depends(get_current_user)):
    return current_user
