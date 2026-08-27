import sys
import os
import jwt
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import get_supabase
from app.config import settings

supabase = get_supabase()

# Sign in to get real Supabase token
res = supabase.auth.sign_in_with_password({
    "email": "owner_test@example.com",
    "password": "TestPassword123!"
})
token = res.session.access_token

print(f"Token obtained from Supabase Auth: {token[:30]}...")

# Unverified decode
try:
    unverified = jwt.decode(token, options={"verify_signature": False})
    print(f"✓ Unverified claims: sub={unverified.get('sub')}, email={unverified.get('email')}, role={unverified.get('role')}")
except Exception as e:
    print(f"❌ Unverified decode failed: {e}")

# Try Supabase API get_user(token)
try:
    u_res = supabase.auth.get_user(token)
    print(f"✓ Supabase auth.get_user(token) succeeded! User ID: {u_res.user.id}, Email: {u_res.user.email}")
except Exception as e:
    print(f"❌ Supabase auth.get_user(token) failed: {e}")
