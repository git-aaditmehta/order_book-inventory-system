from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from app.auth import require_owner, UserProfile
from app.database import get_supabase
import logging

router = APIRouter(prefix="/insights", tags=["Insights & Reports (Owner Only)"])
logger = logging.getLogger("uvicorn")

@router.get("/summary")
async def get_insights_summary(
    period: str = Query("7d", regex="^(7d|30d|custom)$"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UserProfile = Depends(require_owner)
):
    """Owner endpoint: Computes aggregate statistics for the specified timeframe."""
    supabase = get_supabase()
    
    now = datetime.utcnow()
    if period == "7d":
        start_time = now - timedelta(days=7)
    elif period == "30d":
        start_time = now - timedelta(days=30)
    elif period == "custom" and start_date:
        start_time = datetime.fromisoformat(start_date)
    else:
        start_time = now - timedelta(days=7)

    query = supabase.table("order_transactions").select("*").gte("created_at", start_time.isoformat())
    if period == "custom" and end_date:
        end_time = datetime.fromisoformat(end_date)
        query = query.lte("created_at", end_time.isoformat())
        
    res = query.execute()
    transactions = res.data or []
    
    total_orders = len(transactions)
    total_revenue_cost = 0.0
    material_usage: Dict[str, Dict[str, Any]] = {}
    jewelry_orders: Dict[str, int] = {}
    
    for tx in transactions:
        total_revenue_cost += float(tx.get("total_order_cost") or 0.0)
        sku_color = f"{tx.get('sku_id')} ({tx.get('color')})"
        jewelry_orders[sku_color] = jewelry_orders.get(sku_color, 0) + tx.get("order_quantity", 0)
        
        materials = tx.get("materials_summary") or []
        for mat in materials:
            name_color = f"{mat.get('name')} - {mat.get('color')}"
            units = mat.get("units_used", 0)
            cost = float(mat.get("line_cost") or 0.0)
            
            if name_color not in material_usage:
                material_usage[name_color] = {
                    "name": mat.get("name"),
                    "color": mat.get("color"),
                    "total_units_used": 0,
                    "total_line_cost": 0.0
                }
            material_usage[name_color]["total_units_used"] += units
            material_usage[name_color]["total_line_cost"] += cost

    # Sort top materials used
    sorted_materials = sorted(
        material_usage.values(), 
        key=lambda x: x["total_units_used"], 
        reverse=True
    )
    
    # Sort top ordered jewelry
    sorted_jewelry = sorted(
        [{"sku_color": k, "quantity": v} for k, v in jewelry_orders.items()],
        key=lambda x: x["quantity"],
        reverse=True
    )

    return {
        "period": period,
        "start_time": start_time.isoformat(),
        "total_orders_placed": total_orders,
        "total_order_cost": round(total_revenue_cost, 2),
        "top_materials_used": sorted_materials[:10],
        "top_jewelry_ordered": sorted_jewelry[:10],
        "raw_material_summary_count": len(sorted_materials)
    }
