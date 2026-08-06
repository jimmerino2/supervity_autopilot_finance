# app/routers/invoices_log.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/invoices_log", tags=["InvoicesLog"])

# vendor_id -> vendor, po_id -> purchase_order, and company_code_on_invoice -> company
# are real FKs. gl_account_code has no FK and stays a plain extracted value.
_SELECT = (
    "*, vendor:vendor(vendor_name), "
    "purchase_order:purchase_order(po_id, doc_type, net_value, currency_code), "
    "company:company(company_name)"
)


@router.get("/")
async def list_invoices_log():
    try:
        response = supabase.table("invoices_log").select(_SELECT).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invoice_doc_no}")
async def get_invoices_log(invoice_doc_no: int):
    try:
        response = (
            supabase.table("invoices_log")
            .select(_SELECT)
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice log entry not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
