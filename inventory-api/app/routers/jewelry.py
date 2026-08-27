from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.auth import get_current_user, require_owner, UserProfile
from app.database import get_supabase
from app.models import (
    JewelryCreate, JewelryUpdate, JewelryResponse, redact_cost_for_manager
)
import logging

router = APIRouter(prefix="/jewelry", tags=["Jewelry Catalog & Recipes"])
logger = logging.getLogger("uvicorn")

@router.get("", response_model=List[JewelryResponse])
async def list_jewelry(
    sku_id: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user)
):
    """List active jewelry items with BOM recipes."""
    supabase = get_supabase()
    query = supabase.table("jewelry").select("*, jewelry_recipes(*, raw_materials(name, color, cost_per_unit))").eq("is_archived", False)
    
    if sku_id:
        query = query.ilike("sku_id", f"%{sku_id}%")
    if color:
        query = query.ilike("color", f"%{color}%")
        
    query = query.order("created_at", desc=True)
    res = query.execute()
    
    items = []
    for item in res.data or []:
        recipes = []
        for r in item.get("jewelry_recipes", []):
            rm = r.get("raw_materials", {})
            recipe_item = {
                "raw_material_id": r.get("raw_material_id"),
                "required_quantity": r.get("required_quantity"),
                "raw_material_name": rm.get("name"),
                "raw_material_color": rm.get("color"),
                "cost_per_unit": rm.get("cost_per_unit") if current_user.role == "OWNER" else None
            }
            recipes.append(recipe_item)
            
        item_dict = {
            "id": item["id"],
            "sku_id": item["sku_id"],
            "color": item["color"],
            "weight_before": item["weight_before"],
            "weight_after": item["weight_after"],
            "recipes": recipes,
            "created_at": item.get("created_at")
        }
        items.append(item_dict)
        
    return redact_cost_for_manager(items, current_user.role)

@router.get("/{jewelry_id}", response_model=JewelryResponse)
async def get_jewelry(
    jewelry_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("jewelry").select("*, jewelry_recipes(*, raw_materials(name, color, cost_per_unit))") \
        .eq("id", jewelry_id).eq("is_archived", False).execute()
        
    if not res.data:
        raise HTTPException(status_code=404, detail="Jewelry item not found.")
        
    item = res.data[0]
    recipes = []
    for r in item.get("jewelry_recipes", []):
        rm = r.get("raw_materials", {})
        recipes.append({
            "raw_material_id": r.get("raw_material_id"),
            "required_quantity": r.get("required_quantity"),
            "raw_material_name": rm.get("name"),
            "raw_material_color": rm.get("color"),
            "cost_per_unit": rm.get("cost_per_unit") if current_user.role == "OWNER" else None
        })
        
    result = {
        "id": item["id"],
        "sku_id": item["sku_id"],
        "color": item["color"],
        "weight_before": item["weight_before"],
        "weight_after": item["weight_after"],
        "recipes": recipes,
        "created_at": item.get("created_at")
    }
    return redact_cost_for_manager(result, current_user.role)

@router.post("", response_model=JewelryResponse, status_code=status.HTTP_201_CREATED)
async def create_jewelry(
    payload: JewelryCreate,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner setup: Add a new Jewelry item with BOM recipes."""
    supabase = get_supabase()
    
    # Check duplicate SKU_ID + Color
    check = supabase.table("jewelry").select("id, is_archived") \
        .ilike("sku_id", payload.sku_id.strip()) \
        .ilike("color", payload.color.strip()).execute()
        
    if check.data:
        existing = check.data[0]
        if existing.get("is_archived"):
            supabase.table("jewelry").update({"is_archived": False, "weight_before": payload.weight_before, "weight_after": payload.weight_after}).eq("id", existing["id"]).execute()
            jewelry_id = existing["id"]
            supabase.table("jewelry_recipes").delete().eq("jewelry_id", jewelry_id).execute()
        else:
            raise HTTPException(
                status_code=409, 
                detail=f"Jewelry SKU '{payload.sku_id}' with color '{payload.color}' already exists."
            )
    else:
        res = supabase.table("jewelry").insert({
            "sku_id": payload.sku_id.strip(),
            "color": payload.color.strip(),
            "weight_before": payload.weight_before,
            "weight_after": payload.weight_after
        }).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create jewelry item.")
        jewelry_id = res.data[0]["id"]

    # Insert recipes
    recipe_inserts = [
        {"jewelry_id": jewelry_id, "raw_material_id": r.raw_material_id, "required_quantity": r.required_quantity}
        for r in payload.recipes
    ]
    supabase.table("jewelry_recipes").insert(recipe_inserts).execute()
    
    return await get_jewelry(jewelry_id, current_user)

@router.put("/{jewelry_id}", response_model=JewelryResponse)
async def update_jewelry(
    jewelry_id: str,
    payload: JewelryUpdate,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner setup: Update Jewelry specs and/or BOM recipes."""
    supabase = get_supabase()
    
    if payload.weight_before is not None or payload.weight_after is not None:
        update_data = {}
        if payload.weight_before is not None:
            update_data["weight_before"] = payload.weight_before
        if payload.weight_after is not None:
            update_data["weight_after"] = payload.weight_after
        supabase.table("jewelry").update(update_data).eq("id", jewelry_id).execute()
        
    if payload.recipes is not None:
        supabase.table("jewelry_recipes").delete().eq("jewelry_id", jewelry_id).execute()
        recipe_inserts = [
            {"jewelry_id": jewelry_id, "raw_material_id": r.raw_material_id, "required_quantity": r.required_quantity}
            for r in payload.recipes
        ]
        supabase.table("jewelry_recipes").insert(recipe_inserts).execute()
        
    return await get_jewelry(jewelry_id, current_user)

@router.delete("/{jewelry_id}")
async def archive_jewelry(
    jewelry_id: str,
    current_user: UserProfile = Depends(require_owner)
):
    """Owner action: Soft-delete jewelry."""
    supabase = get_supabase()
    res = supabase.table("jewelry").update({"is_archived": True}).eq("id", jewelry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Jewelry item not found.")
    return {"message": "Jewelry archived successfully."}
