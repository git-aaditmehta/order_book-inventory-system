from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.auth import get_current_user, UserProfile
from app.database import get_supabase
from app.models import (
    OrderPreviewRequest, OrderProcessRequest, OrderProcessResponse, 
    redact_cost_for_manager
)
import logging

router = APIRouter(prefix="/orders", tags=["Order Book Ledger"])
logger = logging.getLogger("uvicorn")

@router.post("/preview")
async def preview_order(
    payload: OrderPreviewRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """Calculates required raw materials and previews stock availability before placing order."""
    supabase = get_supabase()
    
    # 1. Find Jewelry
    j_res = supabase.table("jewelry").select("id, sku_id, color, weight_before, weight_after") \
        .ilike("sku_id", payload.sku_id.strip()) \
        .ilike("color", payload.color.strip()) \
        .eq("is_archived", False).execute()
        
    if not j_res.data:
        raise HTTPException(
            status_code=404, 
            detail=f"Jewelry SKU '{payload.sku_id}' with color '{payload.color}' not found."
        )
        
    jewelry = j_res.data[0]
    
    # 2. Fetch BOM Recipes & Raw Materials
    r_res = supabase.table("jewelry_recipes") \
        .select("required_quantity, raw_materials(id, name, color, packets, quantity_per_packet, loose_units, total_units, cost_per_unit)") \
        .eq("jewelry_id", jewelry["id"]).execute()
        
    if not r_res.data:
        raise HTTPException(
            status_code=400,
            detail=f"Jewelry '{payload.sku_id}' has no raw materials configured in its recipe."
        )
        
    preview_items = []
    shortages = []
    total_cost = 0.0
    
    for r in r_res.data:
        rm = r.get("raw_materials") or {}
        req_per_unit = r.get("required_quantity", 0)
        total_req = req_per_unit * payload.order_quantity
        avail_units = rm.get("total_units", 0)
        
        is_sufficient = avail_units >= total_req
        if not is_sufficient:
            shortages.append(f"{rm.get('name')} ({rm.get('color')}): Required {total_req}, Available {avail_units}")
            
        line_cost = total_req * float(rm.get("cost_per_unit", 0.0))
        total_cost += line_cost
        
        preview_items.append({
            "raw_material_id": rm.get("id"),
            "name": rm.get("name"),
            "color": rm.get("color"),
            "units_required": total_req,
            "packets_current": rm.get("packets"),
            "quantity_per_packet": rm.get("quantity_per_packet"),
            "loose_current": rm.get("loose_units"),
            "total_available": avail_units,
            "is_sufficient": is_sufficient,
            "line_cost": line_cost if current_user.role == "OWNER" else None
        })
        
    response = {
        "jewelry": jewelry,
        "order_quantity": payload.order_quantity,
        "is_executable": len(shortages) == 0,
        "shortages": shortages,
        "materials_required": preview_items,
        "total_order_cost": total_cost if current_user.role == "OWNER" else None
    }
    return redact_cost_for_manager(response, current_user.role)

@router.post("/process", response_model=OrderProcessResponse)
async def process_order_endpoint(
    payload: OrderProcessRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """Executes order transaction atomically in PostgreSQL."""
    supabase = get_supabase()
    
    try:
        res = supabase.rpc("process_order", {
            "p_sku_id": payload.sku_id.strip(),
            "p_color": payload.color.strip(),
            "p_order_quantity": payload.order_quantity,
            "p_user_id": current_user.id,
            "p_user_role": current_user.role
        }).execute()
        
        data = res.data
        if not data:
            raise HTTPException(status_code=500, detail="Database procedure returned empty response.")
            
        if not data.get("success"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=data.get("message", "Order failed."),
                headers={"X-Error-Code": data.get("error_code", "ORDER_FAILED")}
            )
            
        return redact_cost_for_manager(data, current_user.role)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_order_history(
    sku_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: UserProfile = Depends(get_current_user)
):
    """Retrieve list of placed order transactions."""
    supabase = get_supabase()
    query = supabase.table("order_transactions").select("*").order("created_at", desc=True).limit(limit)
    
    if sku_id:
        query = query.ilike("sku_id", f"%{sku_id}%")
        
    res = query.execute()
    items = res.data or []
    return redact_cost_for_manager(items, current_user.role)
