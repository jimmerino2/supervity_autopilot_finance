# app/routers/approval_log.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/approval_log", tags=["ApprovalLog"])

# invoice_doc_no -> invoices is a real FK.
_SELECT = "*, invoice:invoices(vendor_invoice_no, amount, currency_code, status)"


@router.get("/")
async def list_approval_log():
    try:
        # Fetch all rows from the 'approval_log' table
        response = supabase.table("approval_log").select(_SELECT).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_approval_log(payload: dict):
    try:
        # Insert a new record into the 'approval_log' table
        response = supabase.table("approval_log").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))