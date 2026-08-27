export type UserRole = 'OWNER' | 'MANAGER';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
}

export interface RawMaterial {
  id: string;
  name: string;
  color: string;
  packets: number;
  quantity_per_packet: number;
  loose_units: number;
  total_units: number;
  cost_per_unit?: number | null; // Null for Manager
  created_at?: string;
  updated_at?: string;
}

export interface RecipeItem {
  raw_material_id: string;
  required_quantity: number;
  raw_material_name?: string;
  raw_material_color?: string;
  cost_per_unit?: number | null;
}

export interface Jewelry {
  id: string;
  sku_id: string;
  color: string;
  weight_before: number;
  weight_after: number;
  recipes: RecipeItem[];
  created_at?: string;
}

export interface MaterialUsageSnapshot {
  raw_material_id: string;
  name: string;
  color: string;
  units_used: number;
  stock_before: { packets: number; loose: number; total_units: number };
  stock_after: { packets: number; loose: number; total_units: number };
  line_cost?: number | null; // Null for Manager
}

export interface OrderTransaction {
  id: string;
  sku_id: string;
  color: string;
  order_quantity: number;
  materials_summary: MaterialUsageSnapshot[];
  total_order_cost?: number | null; // Null for Manager
  placed_by_user_id: string;
  placed_by_role: UserRole;
  created_at: string;
}

export interface OrderPreviewResponse {
  jewelry: {
    id: string;
    sku_id: string;
    color: string;
    weight_before: number;
    weight_after: number;
  };
  order_quantity: number;
  is_executable: boolean;
  shortages: string[];
  materials_required: Array<{
    raw_material_id: string;
    name: string;
    color: string;
    units_required: number;
    packets_current: number;
    quantity_per_packet: number;
    loose_current: number;
    total_available: number;
    is_sufficient: boolean;
    line_cost?: number | null;
  }>;
  total_order_cost?: number | null;
}

export interface InsightsSummary {
  period: string;
  start_time: string;
  total_orders_placed: number;
  total_order_cost: number;
  top_materials_used: Array<{
    name: string;
    color: string;
    total_units_used: number;
    total_line_cost: number;
  }>;
  top_jewelry_ordered: Array<{
    sku_color: string;
    quantity: number;
  }>;
  raw_material_summary_count: number;
}
