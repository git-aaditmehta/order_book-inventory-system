import sys
import os
import json
import traceback

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import get_supabase
from app.config import settings

def test_supabase_and_seed():
    print("=== STEP 1: Testing Supabase Credentials & Connection ===")
    print(f"URL: {settings.SUPABASE_URL}")
    print(f"Service Role Key present: {bool(settings.SUPABASE_SERVICE_ROLE_KEY)}")
    
    try:
        supabase = get_supabase()
        print("✓ Supabase Client initialized successfully.")
    except Exception as e:
        print(f"❌ Failed to initialize Supabase client: {e}")
        return False, str(e)

    print("\n=== STEP 2: Checking Database Tables ===")
    tables = ["profiles", "raw_materials", "jewelry", "jewelry_recipes", "order_transactions", "settings"]
    table_status = {}
    
    for table in tables:
        try:
            res = supabase.table(table).select("count", count="exact").limit(1).execute()
            count = res.count if hasattr(res, "count") and res.count is not None else len(res.data or [])
            table_status[table] = {"ok": True, "count": count}
            print(f"✓ Table '{table}': OK (Current row count: {count})")
        except Exception as e:
            table_status[table] = {"ok": False, "error": str(e)}
            print(f"❌ Table '{table}': ERROR -> {e}")

    failed_tables = [t for t, s in table_status.items() if not s["ok"]]
    if failed_tables:
        print(f"\n⚠️ Some tables are missing or inaccessible: {failed_tables}")
        print("Possible reason: Database migrations/init.sql might not have been executed on Supabase yet.")
        return False, f"Missing/Inaccessible tables: {failed_tables}"

    print("\n=== STEP 3: Inserting Seed Data into Supabase ===")
    
    # 1. Raw Materials Seed Data
    sample_raw_materials = [
        {"name": "Ruby Bead 5mm", "color": "Red", "packets": 10, "quantity_per_packet": 100, "loose_units": 25, "cost_per_unit": 2.50},
        {"name": "Gold Wire 18K", "color": "Gold", "packets": 5, "quantity_per_packet": 50, "loose_units": 10, "cost_per_unit": 15.00},
        {"name": "Freshwater Pearl", "color": "White", "packets": 8, "quantity_per_packet": 200, "loose_units": 50, "cost_per_unit": 1.75},
        {"name": "Silver Clasp 925", "color": "Silver", "packets": 15, "quantity_per_packet": 30, "loose_units": 5, "cost_per_unit": 0.80},
        {"name": "Emerald Gem Cut", "color": "Green", "packets": 4, "quantity_per_packet": 20, "loose_units": 2, "cost_per_unit": 45.00},
        {"name": "Silk Thread Roll", "color": "Black", "packets": 20, "quantity_per_packet": 500, "loose_units": 100, "cost_per_unit": 0.10},
    ]

    inserted_materials = []
    for rm in sample_raw_materials:
        try:
            # Check if exists
            existing = supabase.table("raw_materials").select("*").eq("name", rm["name"]).eq("color", rm["color"]).execute()
            if existing.data and len(existing.data) > 0:
                print(f"  - Raw Material '{rm['name']} ({rm['color']})' already exists (ID: {existing.data[0]['id']})")
                inserted_materials.append(existing.data[0])
            else:
                res = supabase.table("raw_materials").insert(rm).execute()
                if res.data:
                    mat = res.data[0]
                    inserted_materials.append(mat)
                    print(f"  + Inserted Raw Material: {mat['name']} ({mat['color']}) - ID: {mat['id']}")
        except Exception as e:
            print(f"❌ Error inserting Raw Material '{rm['name']}': {e}")

    # Map name -> id
    rm_map = {f"{mat['name']}_{mat['color']}": mat['id'] for mat in inserted_materials}

    # 2. Jewelry Seed Data
    sample_jewelry = [
        {
            "sku_id": "JW-101",
            "color": "Red",
            "weight_before": 25.5,
            "weight_after": 24.8,
            "recipes": [
                {"rm_key": "Ruby Bead 5mm_Red", "qty": 15},
                {"rm_key": "Gold Wire 18K_Gold", "qty": 2},
                {"rm_key": "Silver Clasp 925_Silver", "qty": 1}
            ]
        },
        {
            "sku_id": "JW-102",
            "color": "White",
            "weight_before": 18.0,
            "weight_after": 17.5,
            "recipes": [
                {"rm_key": "Freshwater Pearl_White", "qty": 20},
                {"rm_key": "Silk Thread Roll_Black", "qty": 5},
                {"rm_key": "Silver Clasp 925_Silver", "qty": 1}
            ]
        },
        {
            "sku_id": "JW-103",
            "color": "Green",
            "weight_before": 12.0,
            "weight_after": 11.8,
            "recipes": [
                {"rm_key": "Emerald Gem Cut_Green", "qty": 2},
                {"rm_key": "Gold Wire 18K_Gold", "qty": 3}
            ]
        }
    ]

    for j in sample_jewelry:
        try:
            existing_j = supabase.table("jewelry").select("*").eq("sku_id", j["sku_id"]).eq("color", j["color"]).execute()
            if existing_j.data and len(existing_j.data) > 0:
                j_id = existing_j.data[0]["id"]
                print(f"  - Jewelry '{j['sku_id']} ({j['color']})' already exists (ID: {j_id})")
            else:
                res_j = supabase.table("jewelry").insert({
                    "sku_id": j["sku_id"],
                    "color": j["color"],
                    "weight_before": j["weight_before"],
                    "weight_after": j["weight_after"]
                }).execute()
                j_id = res_j.data[0]["id"]
                print(f"  + Inserted Jewelry: {j['sku_id']} ({j['color']}) - ID: {j_id}")

                # Insert recipes
                for rec in j["recipes"]:
                    rm_id = rm_map.get(rec["rm_key"])
                    if rm_id:
                        supabase.table("jewelry_recipes").insert({
                            "jewelry_id": j_id,
                            "raw_material_id": rm_id,
                            "required_quantity": rec["qty"]
                        }).execute()
                        print(f"    └ Recipe item: RM ID {rm_id} x {rec['qty']}")
        except Exception as e:
            print(f"❌ Error inserting Jewelry '{j['sku_id']}': {e}")

    # 3. Verify Settings Row
    try:
        settings_res = supabase.table("settings").select("*").execute()
        if not settings_res.data:
            supabase.table("settings").insert({"low_stock_packet_threshold": 5, "low_stock_unit_threshold": 100}).execute()
            print("  + Created default Settings row.")
        else:
            print("  - Settings row already present.")
    except Exception as e:
        print(f"❌ Error verifying Settings: {e}")

    print("\n=== STEP 4: Verification Summary ===")
    for table in tables:
        try:
            res = supabase.table(table).select("count", count="exact").execute()
            count = res.count if hasattr(res, "count") and res.count is not None else len(res.data or [])
            print(f"  Table '{table}': {count} rows")
        except Exception as e:
            print(f"  Table '{table}': Error - {e}")

    return True, "Seed completed successfully!"

if __name__ == "__main__":
    success, msg = test_supabase_and_seed()
    if success:
        print("\n✅ SUCCESS: Supabase connection and seed data verification complete!")
    else:
        print(f"\n❌ FAILED: {msg}")
        sys.exit(1)
