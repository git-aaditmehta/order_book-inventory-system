import sys
import os
import json
import time
import jwt
from datetime import datetime, timezone, timedelta

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_supabase
from app.config import settings

client = TestClient(app)

def create_mock_jwt(user_id: str, email: str, role: str) -> str:
    """Generates a valid JWT signed with SUPABASE_JWT_SECRET for testing."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "user_metadata": {"role": role},
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

def run_all_tests():
    print("==========================================================")
    print("🚀 SYSTEM INTEGRATION TEST: Supabase <-> Backend <-> Frontend")
    print("==========================================================")

    errors = []

    # ---------------------------------------------------------
    # TEST 1: Supabase Direct Connectivity & User Setup
    # ---------------------------------------------------------
    print("\n[TEST 1] Testing Direct Supabase Connection & Authentic User Setup...")
    supabase = get_supabase()

    # Get or Create Owner User via Supabase Auth Admin
    owner_email = "owner_test@example.com"
    manager_email = "manager_test@example.com"

    def get_or_create_user(email: str, role: str):
        try:
            # Check existing users in profiles
            p_res = supabase.table("profiles").select("*").eq("email", email).execute()
            if p_res.data and len(p_res.data) > 0:
                uid = p_res.data[0]["id"]
                print(f"  ✓ Found existing test user '{email}' (ID: {uid})")
                return uid
        except Exception as e:
            pass

        try:
            # Create user in auth.users
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": "TestPassword123!",
                "user_metadata": {"role": role},
                "email_confirm": True
            })
            uid = res.user.id
            print(f"  + Created new test user '{email}' in auth.users (ID: {uid})")
            
            # Ensure profile exists and has correct role
            time.sleep(0.5)
            supabase.table("profiles").upsert({
                "id": uid,
                "email": email,
                "role": role
            }).execute()
            return uid
        except Exception as e:
            print(f"  ⚠️ Error setting up auth user '{email}': {e}")
            # Try fetching from auth users list as fallback
            try:
                users_list = supabase.auth.admin.list_users()
                for u in users_list:
                    if u.email == email:
                        supabase.table("profiles").upsert({
                            "id": u.id,
                            "email": email,
                            "role": role
                        }).execute()
                        return u.id
            except Exception as ex:
                print(f"  ❌ Fallback user list failed: {ex}")
            raise e

    try:
        owner_id = get_or_create_user(owner_email, "OWNER")
        manager_id = get_or_create_user(manager_email, "MANAGER")
        print("  ✓ Owner & Manager users successfully setup in Supabase auth + profiles.")
    except Exception as e:
        err_msg = f"Failed setting up test users in Supabase: {e}"
        print(f"  ❌ {err_msg}")
        errors.append(err_msg)
        return False, errors

    # Check seeded raw materials
    rm_res = supabase.table("raw_materials").select("*").eq("is_archived", False).execute()
    rm_count = len(rm_res.data or [])
    print(f"  ✓ Raw Materials in DB: {rm_count}")
    if rm_count == 0:
        errors.append("Supabase 'raw_materials' table is empty. Seed data missing.")

    # Check seeded jewelry
    j_res = supabase.table("jewelry").select("*").eq("is_archived", False).execute()
    j_count = len(j_res.data or [])
    print(f"  ✓ Jewelry Items in DB: {j_count}")
    if j_count == 0:
        errors.append("Supabase 'jewelry' table is empty. Seed data missing.")

    # Generate test tokens with REAL user IDs
    owner_token = create_mock_jwt(owner_id, owner_email, "OWNER")
    manager_token = create_mock_jwt(manager_id, manager_email, "MANAGER")
    
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    # ---------------------------------------------------------
    # TEST 2: FastAPI Health Endpoints
    # ---------------------------------------------------------
    print("\n[TEST 2] Testing FastAPI Health Endpoints...")
    try:
        res = client.get("/health")
        if res.status_code == 200 and res.json().get("status") == "ok":
            print(f"  ✓ Backend /health API: OK")
        else:
            errors.append(f"/health API failed: {res.status_code} {res.text}")
    except Exception as e:
        errors.append(f"FastAPI /health exception: {e}")

    try:
        res = client.get("/health/db")
        if res.status_code == 200 and res.json().get("status") == "connected":
            print(f"  ✓ Backend /health/db (Backend -> Supabase DB link): OK")
        else:
            errors.append(f"/health/db API failed: {res.status_code} {res.text}")
    except Exception as e:
        errors.append(f"FastAPI /health/db exception: {e}")

    # ---------------------------------------------------------
    # TEST 3: Auth & Profile Endpoint
    # ---------------------------------------------------------
    print("\n[TEST 3] Testing Authentication & Role Profile API...")
    try:
        res = client.get("/auth/me", headers=owner_headers)
        if res.status_code == 200 and res.json().get("role") == "OWNER":
            print(f"  ✓ Auth Profile (/auth/me) returned role: OWNER")
        else:
            errors.append(f"/auth/me Owner failed: {res.status_code} {res.text}")
            
        res_m = client.get("/auth/me", headers=manager_headers)
        if res_m.status_code == 200 and res_m.json().get("role") == "MANAGER":
            print(f"  ✓ Auth Profile (/auth/me) returned role: MANAGER")
        else:
            errors.append(f"/auth/me Manager failed: {res_m.status_code} {res_m.text}")
    except Exception as e:
        errors.append(f"Auth testing exception: {e}")

    # ---------------------------------------------------------
    # TEST 4: Raw Materials Endpoint & Role Cost Redaction
    # ---------------------------------------------------------
    print("\n[TEST 4] Testing Raw Materials API & Cost Redaction...")
    try:
        # Owner sees cost_per_unit
        res_owner = client.get("/raw-materials", headers=owner_headers)
        if res_owner.status_code == 200 and len(res_owner.json()) > 0:
            sample_item = res_owner.json()[0]
            if sample_item.get("cost_per_unit") is not None:
                print(f"  ✓ OWNER sees cost_per_unit: ${sample_item.get('cost_per_unit')}")
            else:
                errors.append("OWNER cost_per_unit is unexpectedly None!")
        else:
            errors.append(f"GET /raw-materials (Owner) failed: {res_owner.status_code} {res_owner.text}")

        # Manager gets cost_per_unit redacted (None)
        res_manager = client.get("/raw-materials", headers=manager_headers)
        if res_manager.status_code == 200 and len(res_manager.json()) > 0:
            sample_m_item = res_manager.json()[0]
            if sample_m_item.get("cost_per_unit") is None:
                print(f"  ✓ MANAGER has cost_per_unit correctly REDACTED (None)")
            else:
                errors.append(f"MANAGER cost_per_unit is NOT redacted: {sample_m_item.get('cost_per_unit')}")
        else:
            errors.append(f"GET /raw-materials (Manager) failed: {res_manager.status_code} {res_manager.text}")

    except Exception as e:
        errors.append(f"Raw materials test exception: {e}")

    # ---------------------------------------------------------
    # TEST 5: Jewelry Catalog API
    # ---------------------------------------------------------
    print("\n[TEST 5] Testing Jewelry Catalog API...")
    try:
        res = client.get("/jewelry", headers=owner_headers)
        if res.status_code == 200 and len(res.json()) > 0:
            jewelry_list = res.json()
            print(f"  ✓ GET /jewelry returned {len(jewelry_list)} items.")
            sample_j = jewelry_list[0]
            print(f"    Sample Jewelry SKU: {sample_j.get('sku_id')} ({sample_j.get('color')}) with {len(sample_j.get('recipes', []))} recipe items.")
        else:
            errors.append(f"GET /jewelry failed: {res.status_code} {res.text}")
    except Exception as e:
        errors.append(f"Jewelry API exception: {e}")

    # ---------------------------------------------------------
    # TEST 6: Order Preview & Process Order (Atomic Deduction SQL procedure)
    # ---------------------------------------------------------
    print("\n[TEST 6] Testing Order Preview & Atomic Stock Deduction Order Processing...")
    try:
        preview_payload = {"sku_id": "JW-101", "color": "Red", "order_quantity": 2}
        res_prev = client.post("/orders/preview", json=preview_payload, headers=owner_headers)
        if res_prev.status_code == 200 and res_prev.json().get("is_executable") is True:
            print(f"  ✓ Order Preview for JW-101 (Red) Qty=2: EXECUTABLE (Total Order Cost: ${res_prev.json().get('total_order_cost')})")
        else:
            errors.append(f"POST /orders/preview failed: {res_prev.status_code} {res_prev.text}")

        # Process the order
        process_payload = {"sku_id": "JW-101", "color": "Red", "order_quantity": 2}
        res_proc = client.post("/orders/process", json=process_payload, headers=owner_headers)
        if res_proc.status_code == 200 and res_proc.json().get("success") is True:
            order_data = res_proc.json()
            print(f"  ✓ Process Order SUCCESS! Order Transaction ID: {order_data.get('order_transaction_id')}")
            print(f"    Materials auto-deducted in Supabase DB: {len(order_data.get('materials_used', []))} items updated.")
        else:
            errors.append(f"POST /orders/process failed: {res_proc.status_code} {res_proc.text}")

    except Exception as e:
        errors.append(f"Order Processing exception: {e}")

    # ---------------------------------------------------------
    # TEST 7: Low Stock & Insights API
    # ---------------------------------------------------------
    print("\n[TEST 7] Testing Insights & Low Stock API...")
    try:
        res_low = client.get("/low-stock", headers=owner_headers)
        if res_low.status_code == 200:
            print(f"  ✓ GET /low-stock returned {len(res_low.json())} items.")
        else:
            errors.append(f"GET /low-stock failed: {res_low.status_code} {res_low.text}")

        res_ins = client.get("/insights/summary", headers=owner_headers)
        if res_ins.status_code == 200:
            summary = res_ins.json()
            print(f"  ✓ GET /insights/summary OK (Total raw materials: {summary.get('total_raw_materials')}, Total orders: {summary.get('total_orders')})")
        else:
            errors.append(f"GET /insights/summary failed: {res_ins.status_code} {res_ins.text}")
    except Exception as e:
        errors.append(f"Insights API exception: {e}")

    # ---------------------------------------------------------
    # TEST 8: Frontend Integration Check
    # ---------------------------------------------------------
    print("\n[TEST 8] Checking Frontend Environment & Configuration...")
    web_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "inventory-web", ".env"))
    if os.path.exists(web_env_path):
        with open(web_env_path, "r", encoding="utf-8") as f:
            content = f.read()
        print(f"  ✓ Frontend .env exists at {web_env_path}")
        if "VITE_SUPABASE_URL" in content and "VITE_API_BASE_URL" in content:
            print("  ✓ Frontend .env has VITE_SUPABASE_URL and VITE_API_BASE_URL set correctly.")
        else:
            errors.append("Frontend .env missing VITE_SUPABASE_URL or VITE_API_BASE_URL variables.")
    else:
        errors.append(f"Frontend .env not found at {web_env_path}")

    # ---------------------------------------------------------
    # SUMMARY REPORT
    # ---------------------------------------------------------
    print("\n==========================================================")
    print("📊 INTEGRATION TEST SUMMARY RESULT")
    print("==========================================================")
    if not errors:
        print("🎉 PERFECT SUCCESS! ALL THREE (SUPABASE + BACKEND + FRONTEND) ARE CONNECTED AND WORKING 100% WITHOUT ERROR!")
        return True, []
    else:
        print(f"❌ DETECTED {len(errors)} ERROR(S):")
        for idx, err in enumerate(errors, 1):
            print(f"  {idx}. {err}")
        return False, errors

if __name__ == "__main__":
    success, errors = run_all_tests()
    if not success:
        sys.exit(1)
