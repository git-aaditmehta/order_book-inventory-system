from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from app.auth import get_current_user, UserProfile
from app.database import get_supabase
from app.models import (
    OrderPreviewRequest, OrderProcessRequest, OrderProcessResponse,
    OrderItemInput, redact_cost_for_manager
)
import logging

router = APIRouter(prefix="/orders", tags=["Order Book Ledger"])
logger = logging.getLogger("uvicorn")

@router.post("/preview")
async def preview_order(
    payload: OrderPreviewRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Calculates combined required raw materials across multiple jewelry items
    in a batch order and previews stock sufficiency before placing the order.
    """
    supabase = get_supabase()
    
    # Normalize input items (support both batch array and single item payload)
    items: List[OrderItemInput] = []
    if payload.items and len(payload.items) > 0:
        items = payload.items
    elif payload.sku_id and payload.color and payload.order_quantity:
        items = [OrderItemInput(
            sku_id=payload.sku_id,
            color=payload.color,
            order_quantity=payload.order_quantity
        )]
    else:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least one jewelry item in the order batch."
        )

    # 1. Fetch and validate all jewelry items & aggregate raw materials
    # aggregated_map: { raw_material_id: { "rm": raw_material_dict, "total_req": int } }
    aggregated_map: Dict[str, Dict[str, Any]] = {}
    validated_items = []

    for item in items:
        sku = item.sku_id.strip()
        color = item.color.strip()
        qty = item.order_quantity

        # Find Jewelry
        j_res = supabase.table("jewelry").select("id, sku_id, color, weight_before, weight_after") \
            .ilike("sku_id", sku) \
            .ilike("color", color) \
            .eq("is_archived", False).execute()

        if not j_res.data:
            raise HTTPException(
                status_code=404,
                detail=f"Jewelry SKU '{sku}' with color '{color}' not found in catalog."
            )

        jewelry = j_res.data[0]
        validated_items.append({
            "jewelry_id": jewelry["id"],
            "sku_id": jewelry["sku_id"],
            "color": jewelry["color"],
            "order_quantity": qty,
            "weight_before": jewelry["weight_before"],
            "weight_after": jewelry["weight_after"]
        })

        # Fetch BOM Recipes for this Jewelry
        r_res = supabase.table("jewelry_recipes") \
            .select("required_quantity, raw_materials(id, name, color, packets, quantity_per_packet, loose_units, total_units, cost_per_unit)") \
            .eq("jewelry_id", jewelry["id"]).execute()

        if not r_res.data:
            raise HTTPException(
                status_code=400,
                detail=f"Jewelry '{sku}' ({color}) has no raw material BOM recipe configured."
            )

        for r in r_res.data:
            rm = r.get("raw_materials") or {}
            rm_id = rm.get("id")
            if not rm_id:
                continue

            req_units_for_item = r.get("required_quantity", 0) * qty

            if rm_id in aggregated_map:
                aggregated_map[rm_id]["total_req"] += req_units_for_item
            else:
                aggregated_map[rm_id] = {
                    "rm": rm,
                    "total_req": req_units_for_item
                }

    # 2. Build aggregated preview items list and evaluate stock sufficiency
    preview_materials = []
    shortages = []
    total_batch_cost = 0.0

    for rm_id, data in aggregated_map.items():
        rm = data["rm"]
        total_req = data["total_req"]
        avail_units = rm.get("total_units", 0)
        qty_per_packet = rm.get("quantity_per_packet", 1) or 1

        is_sufficient = avail_units >= total_req
        if not is_sufficient:
            shortages.append(
                f"{rm.get('name')} ({rm.get('color')}): Required {total_req}, Available {avail_units}"
            )

        line_cost = total_req * float(rm.get("cost_per_unit", 0.0) or 0.0)
        total_batch_cost += line_cost

        preview_materials.append({
            "raw_material_id": rm_id,
            "name": rm.get("name"),
            "color": rm.get("color"),
            "units_required": total_req,
            "packets_current": rm.get("packets", 0),
            "quantity_per_packet": qty_per_packet,
            "loose_current": rm.get("loose_units", 0),
            "total_available": avail_units,
            "is_sufficient": is_sufficient,
            "line_cost": line_cost if current_user.role == "OWNER" else None
        })

    response = {
        "items": validated_items,
        # Backward-compatibility fields if single item
        "jewelry": validated_items[0] if len(validated_items) == 1 else None,
        "order_quantity": sum(i["order_quantity"] for i in validated_items),
        "is_executable": len(shortages) == 0,
        "shortages": shortages,
        "materials_required": preview_materials,
        "total_order_cost": total_batch_cost if current_user.role == "OWNER" else None
    }
    return redact_cost_for_manager(response, current_user.role)

@router.post("/process", response_model=OrderProcessResponse)
async def process_order_endpoint(
    payload: OrderProcessRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """Executes multi-jewelry batch order transaction atomically in PostgreSQL."""
    supabase = get_supabase()

    # Normalize input items
    items: List[OrderItemInput] = []
    if payload.items and len(payload.items) > 0:
        items = payload.items
    elif payload.sku_id and payload.color and payload.order_quantity:
        items = [OrderItemInput(
            sku_id=payload.sku_id,
            color=payload.color,
            order_quantity=payload.order_quantity
        )]
    else:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least one jewelry item in the order batch."
        )

    items_payload = [
        {
            "sku_id": item.sku_id.strip(),
            "color": item.color.strip(),
            "order_quantity": item.order_quantity
        }
        for item in items
    ]

    try:
        res = supabase.rpc("process_batch_order", {
            "p_items": items_payload,
            "p_user_id": current_user.id,
            "p_user_role": current_user.role
        }).execute()

        data = res.data
        if not data:
            raise HTTPException(status_code=500, detail="Database procedure returned empty response.")

        if not data.get("success"):
            err_msg = data.get("message", "Batch order failed.")
            shortages = data.get("shortages")
            if shortages and isinstance(shortages, list):
                err_msg = f"{err_msg} Shortages: {', '.join(shortages)}"
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=err_msg,
                headers={"X-Error-Code": data.get("error_code", "ORDER_FAILED")}
            )

        return redact_cost_for_manager(data, current_user.role)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing batch order: {e}")
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
