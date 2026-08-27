import sys
import os
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import get_supabase

supabase = get_supabase()

print("Testing sign in for owner_test@example.com...")
try:
    res = supabase.auth.sign_in_with_password({
        "email": "owner_test@example.com",
        "password": "TestPassword123!"
    })
    print(f"✓ Owner Sign-in Success! Token prefix: {res.session.access_token[:20]}...")
except Exception as e:
    print(f"❌ Owner Sign-in Failed: {e}")

print("\nTesting sign in for manager_test@example.com...")
try:
    res_m = supabase.auth.sign_in_with_password({
        "email": "manager_test@example.com",
        "password": "TestPassword123!"
    })
    print(f"✓ Manager Sign-in Success! Token prefix: {res_m.session.access_token[:20]}...")
except Exception as e:
    print(f"❌ Manager Sign-in Failed: {e}")
