from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.auth import get_current_user, require_owner, UserProfile
from app.database import get_supabase
from app.models import (
    RawMaterialCreate, RawMaterialUpdate, RawMaterialResponse, 
    RestockRequest, redact_cost_for_manager
)
import logging

router = APIRouter(prefix="/raw-materials", tags=["Raw Materials"])
logger = logging.getLogger("uvicorn")

@router.get("", response_model=List[RawMaterialResponse])
async def list_raw_materials(
    search: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user)
):
    """List active raw materials with flexible search by name or color."""
    supabase = get_supabase()
    query = supabase.table("raw_materials").select("*").eq("is_archived", False)
    
    if search:
        query = query.ilike("name", f"%{search}%")
    if color:
        query = query.ilike("color", f"%{color}%")
        
    query = query.order("name", desc=False)
    res = query.execute()
    
    items = res.data or []
    return redact_cost_for_manager(items, current_user.role)

@router.get("/{material_id}", response_model=RawMaterialResponse)
async def get_raw_material(
    material_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("raw_materials").select("*").eq("id", material_id).eq("is_archived", False).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Raw material not found.")
    return redact_cost_for_manager(res.data[0], current_user.role)

@router.post("", response_model=RawMaterialResponse, status_code=status.HTTP_201_CREATED)
async def create_raw_material(
    payload: RawMaterialCreate,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner setup: Add a new raw material."""
    supabase = get_supabase()
    
    # Check duplicate name + color
    check = supabase.table("raw_materials").select("id, is_archived") \
        .ilike("name", payload.name.strip()) \
        .ilike("color", payload.color.strip()).execute()
        
    if check.data:
        existing = check.data[0]
        if existing.get("is_archived"):
            # Unarchive and update
            update_data = payload.dict()
            update_data["is_archived"] = False
            res = supabase.table("raw_materials").update(update_data).eq("id", existing["id"]).execute()
            return res.data[0]
        else:
            raise HTTPException(
                status_code=409, 
                detail=f"Raw material '{payload.name}' with color '{payload.color}' already exists."
            )
            
    res = supabase.table("raw_materials").insert({
        "name": payload.name.strip(),
        "color": payload.color.strip(),
        "packets": payload.packets,
        "quantity_per_packet": payload.quantity_per_packet,
        "loose_units": payload.loose_units or 0,
        "cost_per_unit": payload.cost_per_unit or 0.0
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create raw material.")
    return res.data[0]

@router.put("/{material_id}", response_model=RawMaterialResponse)
async def update_raw_material(
    material_id: str,
    payload: RawMaterialUpdate,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner setup: Edit raw material attributes."""
    supabase = get_supabase()
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")
        
    res = supabase.table("raw_materials").update(update_data).eq("id", material_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Raw material not found.")
    return res.data[0]

@router.post("/{material_id}/restock")
async def restock_raw_material(
    material_id: str,
    payload: RestockRequest,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner action: Restock raw material packets or loose units."""
    supabase = get_supabase()
    res = supabase.rpc("restock_raw_material", {
        "p_raw_material_id": material_id,
        "p_add_packets": payload.add_packets,
        "p_add_loose": payload.add_loose
    }).execute()
    
    if not res.data or not res.data.get("success"):
        raise HTTPException(status_code=400, detail="Restock failed.")
    return res.data

@router.delete("/{material_id}")
async def archive_raw_material(
    material_id: str,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner action: Soft-delete raw material."""
    supabase = get_supabase()
    res = supabase.table("raw_materials").update({"is_archived": True}).eq("id", material_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Raw material not found.")
    return {"message": "Raw material archived successfully."}

@router.get("/{material_id}/history")
async def get_raw_material_history(
    material_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """Get history of all order transactions where this raw material was deducted."""
    supabase = get_supabase()
    res = supabase.table("order_transactions").select("*").order("created_at", desc=True).execute()
    
    history = []
    for tx in res.data or []:
        materials = tx.get("materials_summary", [])
        for mat in materials:
            if mat.get("raw_material_id") == material_id:
                history.append({
                    "transaction_id": tx["id"],
                    "created_at": tx["created_at"],
                    "sku_id": tx["sku_id"],
                    "color": tx["color"],
                    "order_quantity": tx["order_quantity"],
                    "placed_by_role": tx["placed_by_role"],
                    "units_used": mat.get("units_used"),
                    "stock_before": mat.get("stock_before"),
                    "stock_after": mat.get("stock_after"),
                    "line_cost": mat.get("line_cost") if current_user.role == "OWNER" else None
                })
    return history
