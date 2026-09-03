# Product Requirements Document (PRD)
## Jewelry & Raw Material Inventory System (BOM Accounting & Order Calculation)

---

## 1. Overview & Purpose
This system is a mobile-first inventory management, Bill of Materials (BOM) calculation, and order processing application tailored specifically for jewelry manufacturing and sales operations. 

Key Highlights:
- **Mobile-First UX**: Optimized for fast touch interaction, clean ledger views, and minimal input steps.
- **No Image Overhead**: Ultra-fast UI focused purely on mathematical accuracy and rapid order processing.
- **Jewelry Setup**: Each Jewelry item is identified uniquely by **`SKU_ID` + `Color`** (no unnecessary name field). When setting up jewelry, the Owner selects the required Raw Materials and inputs the exact quantity needed to produce 1 unit of that jewelry.
- **Multi-Jewelry Batch Ordering (Order Book)**: The user can place an order for **multiple jewelry items at the same time** (e.g., 2, 5, 10 items in a single batch). The system automatically fetches the raw material recipes for all items, **aggregates coincident raw materials**, calculates total required units, packets needed (`X pkts (Y loose)`), checks against current stock, verifies sufficiency, and executes an atomic batch deduction recorded in `order_transactions` with a shared `batch_id`.
- **Packet + Optional Loose Units Math**: Raw materials track `packets` and optional `loose_units` (defaults to 0). Remaining stock displays as `"X packets (Y total units) and Z loose units"`.
- **Strict Stock Blocking**: Orders cannot be placed if any required raw material stock is insufficient across the batch; explicit alerts highlight missing quantities.
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
    batch_id UUID, -- Shared UUID for multi-jewelry batch orders
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
CREATE INDEX idx_order_transactions_batch_id ON order_transactions(batch_id);
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

## 5. Multi-Jewelry Batch Ordering Business Logic

### 5.1 Batch Preview & Aggregation
When the user adds multiple jewelry items to an order batch:
$$\text{Items} = [(\text{SKU}_1, \text{Color}_1, Q_1), (\text{SKU}_2, \text{Color}_2, Q_2), \dots]$$

For each distinct raw material $m$:
$$\text{Total Required Units}_m = \sum_{i} \left( Q_i \times \text{RecipeQuantity}_{i, m} \right)$$
$$\text{Packets Needed}_m = \lfloor \text{Total Required Units}_m / \text{QuantityPerPacket}_m \rfloor$$
$$\text{Loose Needed}_m = \text{Total Required Units}_m \pmod{\text{QuantityPerPacket}_m}$$

### 5.2 Stock Sufficiency Check
$$\text{IsSufficient}_m = (\text{Total Available Units}_m \ge \text{Total Required Units}_m)$$
If $\text{IsSufficient}_m = \text{False}$ for **any** material $m$, the entire batch order is blocked.

### 5.3 Stored Procedure: `process_batch_order`
- Atomically locks all distinct raw material rows (`FOR UPDATE`).
- Verifies stock sufficiency across all batch items simultaneously.
- If any material is short: rolls back cleanly and returns a list of missing materials.
- If all materials are available:
  - Deducts total required units from each raw material.
  - Normalizes remaining stock into full packets and loose units.
  - Inserts individual order line items into `order_transactions` linked by `batch_id`.
  - Returns complete execution summary and material deduction snapshots.
