from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
from app.auth import get_current_user, require_owner, UserProfile
from app.database import get_supabase
import logging

router = APIRouter(prefix="/backup", tags=["System Backup & Data Export"])
logger = logging.getLogger("uvicorn")

@router.get("/summary")
async def get_backup_summary(current_user: UserProfile = Depends(require_owner)) -> Dict[str, Any]:
    """Provides high-level database metrics and counts for the backup interface."""
    supabase = get_supabase()
    try:
        rm_res = supabase.table("raw_materials").select("id, total_units, cost_per_unit, is_archived").execute()
        rm_data = rm_res.data or []
        active_rm = [r for r in rm_data if not r.get("is_archived")]
        total_rm_valuation = sum(
            float(r.get("total_units", 0) or 0) * float(r.get("cost_per_unit", 0) or 0)
            for r in active_rm
        )

        j_res = supabase.table("jewelry").select("id, is_archived").execute()
        j_data = j_res.data or []
        active_j = [j for j in j_data if not j.get("is_archived")]

        recipes_res = supabase.table("jewelry_recipes").select("id").execute()
        recipes_count = len(recipes_res.data or [])

        orders_res = supabase.table("order_transactions").select("id, total_order_cost").execute()
        orders_data = orders_res.data or []
        total_orders_cost = sum(float(o.get("total_order_cost", 0) or 0) for o in orders_data)

        return {
            "raw_materials_count": len(rm_data),
            "raw_materials_active": len(active_rm),
            "raw_materials_valuation": round(total_rm_valuation, 2),
            "jewelry_count": len(j_data),
            "jewelry_active": len(active_j),
            "recipes_count": recipes_count,
            "orders_count": len(orders_data),
            "total_orders_cost": round(total_orders_cost, 2),
        }
    except Exception as e:
        logger.error(f"Failed to fetch backup summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve backup statistics: {str(e)}")

@router.get("/data")
async def get_all_backup_data(current_user: UserProfile = Depends(require_owner)) -> Dict[str, Any]:
    """
    Fetches full, comprehensive datasets for Raw Materials, Jewelry with BOM Recipes,
    and Order Transactions ledger for complete Excel export.
    """
    supabase = get_supabase()
    try:
        # 1. Fetch Raw Materials
        rm_res = supabase.table("raw_materials").select("*").order("name", desc=False).execute()
        raw_materials = []
        for r in rm_res.data or []:
            total_units = int(r.get("total_units") or (r.get("packets", 0) * r.get("quantity_per_packet", 1) + (r.get("loose_units") or 0)))
            cost_per_unit = float(r.get("cost_per_unit") or 0.0)
            valuation = round(total_units * cost_per_unit, 2)
            raw_materials.append({
                "id": r.get("id"),
                "name": r.get("name"),
                "color": r.get("color"),
                "packets": r.get("packets", 0),
                "quantity_per_packet": r.get("quantity_per_packet", 1),
                "loose_units": r.get("loose_units", 0),
                "total_units": total_units,
                "cost_per_unit": cost_per_unit,
                "total_valuation": valuation,
                "is_archived": r.get("is_archived", False),
                "status": "Archived" if r.get("is_archived") else "Active",
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at")
            })

        # 2. Fetch Jewelry & Recipes
        j_res = supabase.table("jewelry")\
            .select("*, jewelry_recipes(*, raw_materials(id, name, color, cost_per_unit))")\
            .order("sku_id", desc=False)\
            .execute()

        jewelry_list = []
        recipes_flattened = []

        for j in j_res.data or []:
            recipe_items = []
            calculated_jewelry_cost = 0.0

            for r in j.get("jewelry_recipes", []):
                rm = r.get("raw_materials") or {}
                rm_name = rm.get("name", "Unknown")
                rm_color = rm.get("color", "")
                rm_cost = float(rm.get("cost_per_unit") or 0.0)
                req_qty = int(r.get("required_quantity") or 0)
                line_cost = round(req_qty * rm_cost, 4)
                calculated_jewelry_cost += line_cost

                recipe_items.append({
                    "recipe_id": r.get("id"),
                    "raw_material_id": r.get("raw_material_id"),
                    "raw_material_name": rm_name,
                    "raw_material_color": rm_color,
                    "required_quantity": req_qty,
                    "raw_material_unit_cost": rm_cost,
                    "line_cost": line_cost
                })

                recipes_flattened.append({
                    "jewelry_sku_id": j.get("sku_id"),
                    "jewelry_color": j.get("color"),
                    "jewelry_weight_before": float(j.get("weight_before") or 0.0),
                    "jewelry_weight_after": float(j.get("weight_after") or 0.0),
                    "raw_material_name": rm_name,
                    "raw_material_color": rm_color,
                    "required_quantity_per_piece": req_qty,
                    "material_cost_per_unit": rm_cost,
                    "recipe_line_cost": line_cost,
                    "is_archived": "Archived" if j.get("is_archived") else "Active",
                    "created_at": j.get("created_at")
                })

            jewelry_list.append({
                "id": j.get("id"),
                "sku_id": j.get("sku_id"),
                "color": j.get("color"),
                "weight_before": float(j.get("weight_before") or 0.0),
                "weight_after": float(j.get("weight_after") or 0.0),
                "total_recipe_cost": round(calculated_jewelry_cost, 2),
                "recipe_count": len(recipe_items),
                "recipes": recipe_items,
                "is_archived": j.get("is_archived", False),
                "status": "Archived" if j.get("is_archived") else "Active",
                "created_at": j.get("created_at"),
                "updated_at": j.get("updated_at")
            })

        # 3. Fetch Orders History Ledger
        orders_res = supabase.table("order_transactions")\
            .select("*")\
            .order("created_at", desc=True)\
            .execute()

        orders_list = []
        for o in orders_res.data or []:
            # Format materials summary into human-readable string and parsed objects
            raw_summary = o.get("materials_summary")
            summary_str_list = []
            if isinstance(raw_summary, list):
                for m in raw_summary:
                    name = m.get("name", "Item")
                    color = m.get("color", "")
                    units = m.get("units_used") or m.get("units_required") or m.get("total_units") or 0
                    pkts = m.get("packets_deducted") or m.get("packets_used") or 0
                    loose = m.get("loose_deducted") or m.get("loose_used") or 0
                    line_cost = m.get("line_cost")
                    
                    details = f"{name} ({color}): {units} units"
                    if pkts or loose:
                        details += f" [{pkts} pkts, {loose} loose]"
                    if line_cost is not None:
                        details += f" (Cost: {line_cost:.2f})"
                    summary_str_list.append(details)

            orders_list.append({
                "id": o.get("id"),
                "batch_id": o.get("batch_id") or o.get("id"),
                "created_at": o.get("created_at"),
                "sku_id": o.get("sku_id"),
                "color": o.get("color"),
                "order_quantity": o.get("order_quantity", 0),
                "total_order_cost": float(o.get("total_order_cost") or 0.0),
                "placed_by_role": o.get("placed_by_role"),
                "placed_by_user_id": o.get("placed_by_user_id"),
                "materials_summary_text": " | ".join(summary_str_list),
                "materials_summary_raw": raw_summary
            })

        return {
            "raw_materials": raw_materials,
            "jewelry": jewelry_list,
            "jewelry_recipes_flattened": recipes_flattened,
            "order_transactions": orders_list
        }
    except Exception as e:
        logger.error(f"Error compiling backup export data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate backup dataset: {str(e)}")
