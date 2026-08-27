-- Migration Script: Jewelry & Raw Material Inventory System
-- Run this complete script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Raw Materials Table
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    packets INTEGER NOT NULL DEFAULT 0 CHECK (packets >= 0),
    quantity_per_packet INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_packet > 0),
    loose_units INTEGER NOT NULL DEFAULT 0 CHECK (loose_units >= 0),
    total_units INTEGER GENERATED ALWAYS AS (packets * quantity_per_packet + loose_units) STORED,
    cost_per_unit DECIMAL(12, 4) DEFAULT 0.0000,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_raw_material_name_color UNIQUE (name, color)
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_lookup ON public.raw_materials(name, color) WHERE is_archived = FALSE;

-- 3. Jewelry Master Table
CREATE TABLE IF NOT EXISTS public.jewelry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    weight_before DECIMAL(10, 3) DEFAULT 0.000,
    weight_after DECIMAL(10, 3) DEFAULT 0.000,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_jewelry_sku_color UNIQUE (sku_id, color)
);

CREATE INDEX IF NOT EXISTS idx_jewelry_sku_color ON public.jewelry(sku_id, color) WHERE is_archived = FALSE;

-- 4. Jewelry Recipes Table (Bill of Materials)
CREATE TABLE IF NOT EXISTS public.jewelry_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jewelry_id UUID NOT NULL REFERENCES public.jewelry(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    required_quantity INTEGER NOT NULL CHECK (required_quantity > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_jewelry_recipe_item UNIQUE (jewelry_id, raw_material_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_jewelry ON public.jewelry_recipes(jewelry_id);

-- 5. Order Transactions Table (Single Ledger)
CREATE TABLE IF NOT EXISTS public.order_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jewelry_id UUID NOT NULL REFERENCES public.jewelry(id) ON DELETE RESTRICT,
    sku_id VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    order_quantity INTEGER NOT NULL CHECK (order_quantity > 0),
    materials_summary JSONB NOT NULL,
    total_order_cost DECIMAL(12, 2) DEFAULT 0.00,
    placed_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
    placed_by_role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_transactions_created_at ON public.order_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_transactions_jewelry ON public.order_transactions(jewelry_id);

-- 6. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    low_stock_packet_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_packet_threshold >= 0),
    low_stock_unit_threshold INTEGER NOT NULL DEFAULT 100 CHECK (low_stock_unit_threshold >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Default Settings Row if empty
INSERT INTO public.settings (low_stock_packet_threshold, low_stock_unit_threshold)
SELECT 5, 100
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- 7. Trigger Function to Create User Profile Automatically on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'MANAGER')
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Atomic Stored Procedure: process_order
CREATE OR REPLACE FUNCTION public.process_order(
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
    SELECT * INTO v_jewelry FROM public.jewelry 
    WHERE LOWER(sku_id) = LOWER(p_sku_id) AND LOWER(color) = LOWER(p_color) AND is_archived = FALSE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'JEWELRY_NOT_FOUND', 'message', 'Jewelry SKU and Color combination not found.');
    END IF;

    -- 2. Lock and Check Raw Materials Stock
    FOR v_recipe IN 
        SELECT r.*, rm.name as rm_name, rm.color as rm_color, rm.packets, rm.quantity_per_packet, rm.loose_units, rm.total_units, rm.cost_per_unit
        FROM public.jewelry_recipes r
        JOIN public.raw_materials rm ON r.raw_material_id = rm.id
        WHERE r.jewelry_id = v_jewelry.id AND rm.is_archived = FALSE
    LOOP
        v_req_units := v_recipe.required_quantity * p_order_quantity;
        
        -- Lock row for update
        SELECT total_units INTO v_units_before FROM public.raw_materials WHERE id = v_recipe.raw_material_id FOR UPDATE;
        
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
        FROM public.jewelry_recipes r
        JOIN public.raw_materials rm ON r.raw_material_id = rm.id
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
        UPDATE public.raw_materials
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
    INSERT INTO public.order_transactions (
        jewelry_id, sku_id, color, order_quantity, materials_summary, total_order_cost, placed_by_user_id, placed_by_role
    ) VALUES (
        v_jewelry.id, v_jewelry.sku_id, v_jewelry.color, p_order_quantity, v_materials_json, v_total_order_cost, p_user_id, p_user_role
    ) RETURNING id INTO v_order_id;

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

-- 9. Atomic Stored Procedure: restock_raw_material
CREATE OR REPLACE FUNCTION public.restock_raw_material(
    p_raw_material_id UUID,
    p_add_packets INTEGER DEFAULT 0,
    p_add_loose INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_rm RECORD;
    v_new_units INTEGER;
    v_new_pkts INTEGER;
    v_new_loose INTEGER;
BEGIN
    SELECT * INTO v_rm FROM public.raw_materials WHERE id = p_raw_material_id AND is_archived = FALSE FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'RAW_MATERIAL_NOT_FOUND');
    END IF;
    
    v_new_units := (v_rm.packets * v_rm.quantity_per_packet) + v_rm.loose_units + (p_add_packets * v_rm.quantity_per_packet) + p_add_loose;
    v_new_pkts := v_new_units / v_rm.quantity_per_packet;
    v_new_loose := v_new_units % v_rm.quantity_per_packet;
    
    UPDATE public.raw_materials 
    SET packets = v_new_pkts, loose_units = v_new_loose, updated_at = now()
    WHERE id = p_raw_material_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'raw_material_id', p_raw_material_id,
        'new_packets', v_new_pkts,
        'new_loose_units', v_new_loose,
        'total_units', v_new_units
    );
END;
$$ LANGUAGE plpgsql;

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jewelry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jewelry_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Full Access for Authenticated Users (API enforces role checks and field redaction)
CREATE POLICY "authenticated_full_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.raw_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.jewelry FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.jewelry_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.order_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
