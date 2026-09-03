from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- Auth Models ---
class UserProfileResponse(BaseModel):
    id: str
    email: str
    role: str

# --- Raw Material Models ---
class RawMaterialCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(..., min_length=1, max_length=50)
    packets: int = Field(0, ge=0)
    quantity_per_packet: int = Field(1, ge=1)
    loose_units: Optional[int] = Field(0, ge=0)
    cost_per_unit: Optional[float] = Field(0.0, ge=0.0)

class RawMaterialUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, min_length=1, max_length=50)
    packets: Optional[int] = Field(None, ge=0)
    quantity_per_packet: Optional[int] = Field(None, ge=1)
    loose_units: Optional[int] = Field(None, ge=0)
    cost_per_unit: Optional[float] = Field(None, ge=0.0)

class RestockRequest(BaseModel):
    add_packets: int = Field(0, ge=0)
    add_loose: int = Field(0, ge=0)

class RawMaterialResponse(BaseModel):
    id: str
    name: str
    color: str
    packets: int
    quantity_per_packet: int
    loose_units: int
    total_units: int
    cost_per_unit: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Jewelry & BOM Recipe Models ---
class JewelryRecipeItem(BaseModel):
    raw_material_id: str
    required_quantity: int = Field(..., ge=1)

class JewelryCreate(BaseModel):
    sku_id: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., min_length=1, max_length=50)
    weight_before: float = Field(0.0, ge=0.0)
    weight_after: float = Field(0.0, ge=0.0)
    recipes: List[JewelryRecipeItem] = Field(..., min_items=1)

class JewelryUpdate(BaseModel):
    weight_before: Optional[float] = Field(None, ge=0.0)
    weight_after: Optional[float] = Field(None, ge=0.0)
    recipes: Optional[List[JewelryRecipeItem]] = None

class JewelryResponse(BaseModel):
    id: str
    sku_id: str
    color: str
    weight_before: float
    weight_after: float
    recipes: List[Dict[str, Any]] = []
    created_at: Optional[datetime] = None

# --- Order Book Models (Batch & Multi-Jewelry Supported) ---
class OrderItemInput(BaseModel):
    sku_id: str = Field(..., min_length=1)
    color: str = Field(..., min_length=1)
    order_quantity: int = Field(..., ge=1)

class OrderPreviewRequest(BaseModel):
    items: Optional[List[OrderItemInput]] = None
    # Backward compatibility for single item payload
    sku_id: Optional[str] = None
    color: Optional[str] = None
    order_quantity: Optional[int] = None

class OrderProcessRequest(BaseModel):
    items: Optional[List[OrderItemInput]] = None
    # Backward compatibility for single item payload
    sku_id: Optional[str] = None
    color: Optional[str] = None
    order_quantity: Optional[int] = None

class OrderProcessResponse(BaseModel):
    success: bool
    batch_id: Optional[str] = None
    order_transaction_id: Optional[str] = None
    sku_id: Optional[str] = None
    color: Optional[str] = None
    order_quantity: Optional[int] = None
    items_processed: Optional[List[Dict[str, Any]]] = None
    total_order_cost: Optional[float] = None
    materials_used: Optional[List[Dict[str, Any]]] = None
    error_code: Optional[str] = None
    message: Optional[str] = None
    shortages: Optional[List[str]] = None

# --- Low Stock Models ---
class LowStockItem(BaseModel):
    id: str
    name: str
    color: str
    packets: int
    quantity_per_packet: int
    loose_units: int
    total_units: int
    cost_per_unit: Optional[float] = None

# --- Settings Model ---
class SettingsResponse(BaseModel):
    low_stock_packet_threshold: int
    low_stock_unit_threshold: int

class SettingsUpdate(BaseModel):
    low_stock_packet_threshold: Optional[int] = Field(None, ge=0)
    low_stock_unit_threshold: Optional[int] = Field(None, ge=0)

# --- Role-based Redaction Helper ---
def redact_cost_for_manager(data: Any, role: str) -> Any:
    """Recursively redacts cost fields if role is MANAGER."""
    if role == "OWNER":
        return data
        
    if isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            if key in ("cost_per_unit", "total_order_cost", "total_line_cost", "line_cost", "unit_cost"):
                new_dict[key] = None
            else:
                new_dict[key] = redact_cost_for_manager(value, role)
        return new_dict
    elif isinstance(data, list):
        return [redact_cost_for_manager(item, role) for item in data]
    return data
