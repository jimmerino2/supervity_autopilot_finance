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


@router.get("/automation-stats")
async def get_automation_stats():
    """Automated vs manual operations, grouped by created_by: 'automatic'
    counts as automated, anything else (a real reviewer's name/email) counts
    as manual."""
    try:
        total = (
            supabase.table("invoice_audit_log").select("id", count="exact").execute()
        ).count or 0
        automated = (
            supabase.table("invoice_audit_log")
            .select("id", count="exact")
            .eq("created_by", "automatic")
            .execute()
        ).count or 0
        manual = total - automated
        automated_percentage = round((automated / total) * 100, 1) if total > 0 else None
        return {
            "automated": automated,
            "manual": manual,
            "total": total,
            "automatedPercentage": automated_percentage,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
