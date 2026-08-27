# Product Requirements Document (PRD)
## Jewelry & Raw Material Inventory System (BOM Accounting & Order Calculation)

---

## 1. Overview & Purpose
This system is a mobile-first inventory management, Bill of Materials (BOM) calculation, and order processing application tailored specifically for jewelry manufacturing and sales operations. 

Key Highlights:
- **Mobile-First UX**: Optimized for fast touch interaction, clean ledger views, and minimal input steps.
- **No Image Overhead**: Ultra-fast UI focused purely on mathematical accuracy and rapid order processing.
- **Jewelry Setup**: Each Jewelry item is identified uniquely by **`SKU_ID` + `Color`** (no unnecessary name field). When setting up jewelry, the Owner selects the required Raw Materials and inputs the exact quantity needed to produce 1 unit of that jewelry.
- **Order Book (Single Ledger Transaction)**: The user places an order by entering only **SKU ID, Color, and Quantity**. The system automatically fetches the jewelry's raw material recipe, calculates total materials needed, verifies stock, deducts stock atomically, and records everything in a single **`order_transactions`** table.
- **Packet + Optional Loose Units Math**: Raw materials track `packets` and optional `loose_units` (defaults to 0). Remaining stock displays as `"X packets (Y total units) and Z loose units"`.
- **Strict Stock Blocking**: Orders cannot be placed if any required raw material stock is insufficient; explicit alerts highlight missing quantities.
- **Role Access & Financial Privacy**: 
  - **OWNER**: Full administrative control, cost visibility across all screens, master setup (Raw Materials & Jewelry recipes), security logs, and exclusive access to financial Insights & PDF reporting.
  - **MANAGER**: Operational access restricted to placing orders in the Order Book, viewing read-only stock levels, and low stock alerts. **All cost/monetary data is completely redacted from both frontend UI and backend API responses for managers.**

---

## 2. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18+, TypeScript, Tailwind CSS, TanStack Query, Zustand, Recharts, jsPDF, html2canvas, Lucide React |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, Supabase Python Client |
| **Database** | PostgreSQL 15+ (Supabase) with PL/pgSQL stored procedures & RLS |
| **Auth** | Supabase Auth (Email/Password) with custom app roles (`OWNER`, `MANAGER`) |
| **Design System** | Hallmark Skill Standards (Mobile-first, anti-AI-slop, OKLCH design system, 8-state components) |

---

## 3. Role Access Control Matrix

| Feature / Action | Owner | Manager | Security / Redaction Rule |
| :--- | :---: | :---: | :--- |
| **Login Approval** | Automatic | Automatic | No manual owner approval needed for Manager registration/login. |
| **Order Book Execution** | ✅ Yes | ✅ Yes | Orders placed by Manager still calculate & store costs in DB, but cost is **omitted** from Manager API response. |
| **View Cost Data** | ✅ Yes | ❌ **Hidden** | `cost_per_unit`, `total_cost`, `cost_per_packet` are omitted from API payloads for Managers. |
| **Add / Edit / Delete Raw Materials** | ✅ Yes | ❌ Read-Only | Manager can only view raw material name, color, packets, and loose units. |
| **Add / Edit / Delete Jewelry & Recipes** | ✅ Yes | ❌ Read-Only | Manager can view SKU, color, weights, and raw material recipes (no cost). |
| **Restock Raw Materials** | ✅ Yes | ❌ No | Owner can add packets/quantity to existing raw materials. |
| **Insights & Reports Dashboard** | ✅ Yes | ❌ **No Access** | Insights route is restricted strictly to Owner (contains financial aggregations). |
| **PDF Report Generation** | ✅ Yes | ❌ **No Access** | Owner can generate 7-day, 30-day, or custom range PDF summary reports. |
| **Security & Active Session Control** | ✅ Yes | ❌ **No Access** | View active sessions, device info, IP logs, force logout. |

---

## 4. Simplified Database Schema (5 Tables Total)

### 4.1 Table Definitions

#### `profiles`
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `raw_materials`
```sql
CREATE TABLE raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    packets INTEGER NOT NULL DEFAULT 0 CHECK (packets >= 0),
    quantity_per_packet INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_packet > 0),
    loose_units INTEGER NOT NULL DEFAULT 0 CHECK (loose_units >= 0), -- Optional input (defaults to 0)
    total_units INTEGER GENERATED ALWAYS AS (packets * quantity_per_packet + loose_units) STORED,
    cost_per_unit DECIMAL(12, 4) DEFAULT 0.0000, -- Visible to OWNER only
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_raw_material_name_color UNIQUE (name, color)
);

CREATE INDEX idx_raw_materials_lookup ON raw_materials(name, color) WHERE is_archived = FALSE;
```

#### `jewelry`
```sql
CREATE TABLE jewelry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    weight_before DECIMAL(10, 3) DEFAULT 0.000, -- Grams (per 1 unit)
    weight_after DECIMAL(10, 3) DEFAULT 0.000,  -- Grams (per 1 unit)
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_jewelry_sku_color UNIQUE (sku_id, color)
);

CREATE INDEX idx_jewelry_sku_color ON jewelry(sku_id, color) WHERE is_archived = FALSE;
```

#### `jewelry_recipes` (BOM Bridge Table)
```sql
CREATE TABLE jewelry_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jewelry_id UUID NOT NULL REFERENCES jewelry(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    required_quantity INTEGER NOT NULL CHECK (required_quantity > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_jewelry_recipe_item UNIQUE (jewelry_id, raw_material_id)
);

CREATE INDEX idx_recipes_jewelry ON jewelry_recipes(jewelry_id);
```

#### `order_transactions` (Single Accounting Ledger Table)
```sql
CREATE TABLE order_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jewelry_id UUID NOT NULL REFERENCES jewelry(id) ON DELETE RESTRICT,
    sku_id VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    order_quantity INTEGER NOT NULL CHECK (order_quantity > 0),
    materials_summary JSONB NOT NULL, -- Detailed snapshot of all deducted raw materials (before, after, packets, loose, cost)
    total_order_cost DECIMAL(12, 2) DEFAULT 0.00, -- Stored DB side, hidden from Manager API
    placed_by_user_id UUID NOT NULL REFERENCES profiles(id),
    placed_by_role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_transactions_created_at ON order_transactions(created_at DESC);
CREATE INDEX idx_order_transactions_jewelry ON order_transactions(jewelry_id);
```

#### `settings`
```sql
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    low_stock_packet_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_packet_threshold >= 0),
    low_stock_unit_threshold INTEGER NOT NULL DEFAULT 100 CHECK (low_stock_unit_threshold >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Atomic PostgreSQL Stored Procedure (`process_order`)

```sql
CREATE OR REPLACE FUNCTION process_order(
    p_sku_id VARCHAR,
    p_color VARCHAR,
    p_order_quantity INTEGER,
    p_user_id UUID,
    p_user_role VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_jewelry RECORD;
    v_recipe RECORD;
    v_req_units INTEGER;
    v_units_before INTEGER;
    v_units_after INTEGER;
    v_pkts_before INTEGER;
    v_loose_before INTEGER;
    v_pkts_after INTEGER;
    v_loose_after INTEGER;
    v_line_cost DECIMAL(12,2);
    v_total_order_cost DECIMAL(12,2) := 0.00;
    v_materials_json JSONB := '[]'::jsonb;
    v_insufficient_list TEXT[] := ARRAY[]::TEXT[];
    v_order_id UUID;
BEGIN
    -- 1. Find Jewelry by SKU_ID and Color
    SELECT * INTO v_jewelry FROM jewelry 
    WHERE LOWER(sku_id) = LOWER(p_sku_id) AND LOWER(color) = LOWER(p_color) AND is_archived = FALSE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'JEWELRY_NOT_FOUND', 'message', 'Jewelry SKU and Color combination not found.');
    END IF;

    -- 2. Lock and Check Raw Materials Stock
    FOR v_recipe IN 
        SELECT r.*, rm.name as rm_name, rm.color as rm_color, rm.packets, rm.quantity_per_packet, rm.loose_units, rm.total_units, rm.cost_per_unit
        FROM jewelry_recipes r
        JOIN raw_materials rm ON r.raw_material_id = rm.id
        WHERE r.jewelry_id = v_jewelry.id AND rm.is_archived = FALSE
    LOOP
        v_req_units := v_recipe.required_quantity * p_order_quantity;
        
        -- Lock row for update
        SELECT total_units INTO v_units_before FROM raw_materials WHERE id = v_recipe.raw_material_id FOR UPDATE;
        
        IF v_units_before < v_req_units THEN
            v_insufficient_list := array_append(v_insufficient_list, 
                v_recipe.rm_name || ' (' || v_recipe.rm_color || '): Required ' || v_req_units || ', Available ' || v_units_before);
        END IF;
    END LOOP;

    -- If any material is short, block transaction
    IF array_length(v_insufficient_list, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error_code', 'INSUFFICIENT_STOCK', 
            'message', 'Order blocked due to insufficient raw material stock.',
            'shortages', to_jsonb(v_insufficient_list)
        );
    END IF;

    -- 3. Calculate Deductions & Update Raw Materials Stock
    FOR v_recipe IN 
        SELECT r.*, rm.name as rm_name, rm.color as rm_color, rm.packets, rm.quantity_per_packet, rm.loose_units, rm.total_units, rm.cost_per_unit
        FROM jewelry_recipes r
        JOIN raw_materials rm ON r.raw_material_id = rm.id
        WHERE r.jewelry_id = v_jewelry.id
    LOOP
        v_req_units := v_recipe.required_quantity * p_order_quantity;
        
        -- Current stock snapshot
        v_units_before := (v_recipe.packets * v_recipe.quantity_per_packet) + v_recipe.loose_units;
        v_pkts_before := v_recipe.packets;
        v_loose_before := v_recipe.loose_units;
        
        -- Remaining stock calculation
        v_units_after := v_units_before - v_req_units;
        v_pkts_after := v_units_after / v_recipe.quantity_per_packet;
        v_loose_after := v_units_after % v_recipe.quantity_per_packet;
        
        -- Cost calculation
        v_line_cost := v_req_units * v_recipe.cost_per_unit;
        v_total_order_cost := v_total_order_cost + v_line_cost;
        
        -- Update Raw Material Stock in DB
        UPDATE raw_materials
        SET packets = v_pkts_after,
            loose_units = v_loose_after,
            updated_at = now()
        WHERE id = v_recipe.raw_material_id;
        
        -- Append material summary snapshot
        v_materials_json := v_materials_json || jsonb_build_object(
            'raw_material_id', v_recipe.raw_material_id,
            'name', v_recipe.rm_name,
            'color', v_recipe.rm_color,
            'units_used', v_req_units,
            'stock_before', jsonb_build_object('packets', v_pkts_before, 'loose', v_loose_before, 'total_units', v_units_before),
            'stock_after', jsonb_build_object('packets', v_pkts_after, 'loose', v_loose_after, 'total_units', v_units_after),
            'line_cost', v_line_cost
        );
    END LOOP;

    -- 4. Record Single Order Transaction Ledger Row
    INSERT INTO order_transactions (
        jewelry_id, sku_id, color, order_quantity, materials_summary, total_order_cost, placed_by_user_id, placed_by_role
    ) VALUES (
        v_jewelry.id, v_jewelry.sku_id, v_jewelry.color, p_order_quantity, v_materials_json, v_total_order_cost, p_user_id, p_user_role
    ) RETURNING id INTO v_order_id;

    -- Sanitize cost fields if role is MANAGER before returning API payload
    RETURN jsonb_build_object(
        'success', true,
        'order_transaction_id', v_order_id,
        'sku_id', v_jewelry.sku_id,
        'color', v_jewelry.color,
        'order_quantity', p_order_quantity,
        'total_order_cost', CASE WHEN p_user_role = 'OWNER' THEN v_total_order_cost ELSE NULL END,
        'materials_used', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'raw_material_id', elem->'raw_material_id',
                    'name', elem->'name',
                    'color', elem->'color',
                    'units_used', elem->'units_used',
                    'stock_before', elem->'stock_before',
                    'stock_after', elem->'stock_after',
                    'line_cost', CASE WHEN p_user_role = 'OWNER' THEN (elem->>'line_cost')::decimal ELSE NULL END
                )
            ) FROM jsonb_array_elements(v_materials_json) elem
        )
    );
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Math & Loose Units Rules
1. **Inputs**: `packets` is required; `loose_units` is optional (defaults to `0`).
2. **Formula**: $\text{Total Units} = (\text{Packets} \times \text{Quantity Per Packet}) + \text{Loose Units}$.
3. **Display Output**: Always displays as `"X packets (Y total units) and Z loose units"`.

---

## 7. Security, Redaction & Roles
- **OWNER**: Full access, cost visibility, raw material setup, jewelry BOM setup, security log, Insights & PDF reports.
- **MANAGER**: Order Book input (`SKU_ID` + `Color` + `Order Quantity`), read-only product availability view. **Costs strictly stripped (`null`) from FastAPI backend response.**
