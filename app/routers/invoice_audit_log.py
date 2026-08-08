# app/routers/invoice_audit_log.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/invoice_audit_log", tags=["InvoiceAuditLog"])

_SELECT = "*, invoices(vendor_invoice_no, vendor_id)"


@router.get("/")
async def list_invoice_audit_log():
    try:
        response = (
            supabase.table("invoice_audit_log")
            .select(_SELECT)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
