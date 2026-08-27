import sys
import os
import json
import urllib.request

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import get_supabase

supabase = get_supabase()

# Sign in to get real ES256 Supabase JWT token
res = supabase.auth.sign_in_with_password({
    "email": "owner_test@example.com",
    "password": "TestPassword123!"
})
token = res.session.access_token

headers = {"Authorization": f"Bearer {token}"}

def make_req(url):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("Testing live http://127.0.0.1:8000/auth/me...")
s1, r1 = make_req("http://127.0.0.1:8000/auth/me")
print(f"Status: {s1}, Response: {r1}")

print("\nTesting live http://127.0.0.1:8000/jewelry...")
s2, r2 = make_req("http://127.0.0.1:8000/jewelry")
print(f"Status: {s2}, Items count: {len(r2) if s2 == 200 else r2}")

print("\nTesting live http://127.0.0.1:8000/raw-materials...")
s3, r3 = make_req("http://127.0.0.1:8000/raw-materials")
print(f"Status: {s3}, Items count: {len(r3) if s3 == 200 else r3}")
