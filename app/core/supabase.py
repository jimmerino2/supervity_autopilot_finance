# app/core/supabase.py
import os
from supabase import create_client, Client

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.")

# Create single client instance
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SUPABASE_USERNAME: str = os.getenv("SUPABASE_USERNAME", "")
SUPABASE_PASSWORD: str = os.getenv("SUPABASE_PASSWORD", "")

if SUPABASE_USERNAME or SUPABASE_PASSWORD:
    if not SUPABASE_USERNAME or not SUPABASE_PASSWORD:
        raise ValueError(
            "Both SUPABASE_USERNAME and SUPABASE_PASSWORD must be set to authenticate with Supabase login."
        )

    login_payload = {"email": SUPABASE_USERNAME, "password": SUPABASE_PASSWORD}

    try:
        supabase.auth.sign_in_with_password(login_payload)
    except AttributeError:
        supabase.auth.sign_in(**login_payload)
    except Exception as e:
        raise ValueError(f"Supabase login failed: {e}")