# app/routers/invoice.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/invoice", tags=["Invoice"])


def validate_invoice_status_transition(current_status: str | None, new_status: str | None) -> bool:
    if not current_status or not new_status:
        return False

    normalized_current = current_status.strip().lower()
    normalized_new = new_status.strip().lower()

    allowed_transitions = {
        "pending approval": {"open", "blocked"},
        "open": {"paid", "cancelled"},
    }

    return normalized_new in allowed_transitions.get(normalized_current, set())


@router.get("/")
async def list_invoice():
    try:
        response = (
            supabase.table("invoices")
            .select("*, vendor:vendor(vendor_name)")
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invoice_doc_no}")
async def get_invoice(invoice_doc_no: int):
    try:
        response = (
            supabase.table("invoices")
            .select("*")
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_invoice(payload: dict):
    try:
        response = supabase.table("invoices").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{invoice_doc_no}")
async def update_invoice(invoice_doc_no: int, payload: dict):
    try:
        current_record = (
            supabase.table("invoices")
            .select("status")
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )

        if not current_record.data:
            raise HTTPException(status_code=404, detail="Invoice not found")

        current_status = current_record.data[0].get("status")
        next_status = payload.get("status")
        if next_status and not validate_invoice_status_transition(current_status, next_status):
            raise HTTPException(
                status_code=400,
                detail="Invalid status transition. Allowed transitions are pending approval -> open/blocked and open -> paid/cancelled.",
            )

        response = (
            supabase.table("invoices")
            .update(payload)
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{invoice_doc_no}")
async def delete_invoice(invoice_doc_no: int):
    try:
        response = (
            supabase.table("invoices")
            .delete()
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))