# app/routers/email_log.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/email_log", tags=["EmailLog"])

# vendor_id -> vendor is a real FK. invoice_doc_no has no FK and stays a plain
# extracted value.
_SELECT = "*, vendor:vendor(vendor_name)"


@router.get("/")
async def list_email_log():
    try:
        response = supabase.table("email_log").select(_SELECT).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{email_id}")
async def get_email_log(email_id: str):
    try:
        response = (
            supabase.table("email_log")
            .select(_SELECT)
            .eq("email_id", email_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Email log entry not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
