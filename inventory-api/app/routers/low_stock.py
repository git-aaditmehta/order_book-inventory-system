from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.auth import get_current_user, UserProfile
from app.database import get_supabase
from app.models import LowStockItem, SettingsResponse, SettingsUpdate, redact_cost_for_manager
import logging

router = APIRouter(prefix="/low-stock", tags=["Low Stock Alerts"])
logger = logging.getLogger("uvicorn")

@router.get("", response_model=List[LowStockItem])
async def get_low_stock_materials(
    threshold_type: str = Query("packets", regex="^(packets|units)$"),
    threshold_value: Optional[int] = Query(None, ge=0),
    current_user: UserProfile = Depends(get_current_user)
):
    """Retrieve raw materials that have fallen below the packet or unit threshold."""
    supabase = get_supabase()
    
    # If threshold_value is not passed, use defaults from settings table
    if threshold_value is None:
        settings_res = supabase.table("settings").select("*").limit(1).execute()
        if settings_res.data:
            s = settings_res.data[0]
            threshold_value = s.get("low_stock_packet_threshold") if threshold_type == "packets" else s.get("low_stock_unit_threshold")
        else:
            threshold_value = 5 if threshold_type == "packets" else 100

    query = supabase.table("raw_materials").select("*").eq("is_archived", False)
    if threshold_type == "packets":
        query = query.lte("packets", threshold_value)
    else:
        query = query.lte("total_units", threshold_value)
        
    query = query.order("packets", desc=False)
    res = query.execute()
    
    items = res.data or []
    return redact_cost_for_manager(items, current_user.role)

@router.get("/settings", response_model=SettingsResponse)
async def get_low_stock_settings(
    current_user: UserProfile = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("settings").select("*").limit(1).execute()
    if res.data:
        return res.data[0]
    return {"low_stock_packet_threshold": 5, "low_stock_unit_threshold": 100}

@router.put("/settings", response_model=SettingsResponse)
async def update_low_stock_settings(
    payload: SettingsUpdate,
    current_user: UserProfile = Depends(get_current_user)
):
    supabase = get_supabase()
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No setting values provided.")
        
    res = supabase.table("settings").select("id").limit(1).execute()
    if res.data:
        setting_id = res.data[0]["id"]
        out = supabase.table("settings").update(update_data).eq("id", setting_id).execute()
    else:
        out = supabase.table("settings").insert(update_data).execute()
        
    return out.data[0]
