# app/routers/invoice.py
from fastapi import APIRouter, HTTPException, Request
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


def _parse_amount(value) -> float | None:
    """Some seeded invoice amounts use a comma decimal separator (e.g. '327845,70')
    instead of a period — try both before giving up, rather than letting a bad
    ValueError turn into a 500."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        pass
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _authorize_payment(invoice_amount, approver_email: str | None) -> None:
    """Raises HTTPException unless the requesting approver's approval_matrix
    range covers this invoice's amount. Only called for open -> paid."""
    if not approver_email:
        raise HTTPException(
            status_code=403,
            detail="Sign in with an approver account to mark an invoice as paid.",
        )

    approver_lookup = (
        supabase.table("approval_matrix")
        .select("approver_name, min_amount, max_amount")
        .ilike("approver_email", approver_email)
        .execute()
    )
    if not approver_lookup.data:
        raise HTTPException(
            status_code=403,
            detail=f"No approver profile found for {approver_email}.",
        )

    approver = approver_lookup.data[0]
    min_amount = approver.get("min_amount")
    max_amount = approver.get("max_amount")
    amount = _parse_amount(invoice_amount)

    if amount is None or min_amount is None or max_amount is None:
        raise HTTPException(
            status_code=403,
            detail="Unable to verify invoice amount against your approval limits.",
        )

    if not (float(min_amount) <= amount <= float(max_amount)):
        raise HTTPException(
            status_code=403,
            detail=(
                f"This invoice amount ({amount:,.2f}) is outside your approval range "
                f"({float(min_amount):,.2f} - {float(max_amount):,.2f})."
            ),
        )


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
    """Single invoice enriched with related master data. vendor_id is a real
    FK (embedded directly); po_id/gl_account_code/company_code_on_invoice are
    raw values extracted from the invoice document itself — not enforced
    FKs, since a mismatch against master data is exactly what can block an
    invoice — so those are looked up best-effort as separate queries."""
    try:
        response = (
            supabase.table("invoices")
            .select("*, vendor:vendor(vendor_name, tax_id, bank_country, bank_key, bank_account_number, country_code, email, is_blocked)")
            .eq("invoice_doc_no", invoice_doc_no)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        invoice = response.data[0]

        po_id = invoice.get("po_id")
        if po_id:
            po = supabase.table("purchase_order").select("*").eq("po_id", po_id).execute()
            invoice["purchase_order"] = po.data[0] if po.data else None
        else:
            invoice["purchase_order"] = None

        gl_account_code = invoice.get("gl_account_code")
        if gl_account_code:
            gl_account = supabase.table("gl_account").select("*").eq("gl_account_code", gl_account_code).execute()
            invoice["gl_account"] = gl_account.data[0] if gl_account.data else None
        else:
            invoice["gl_account"] = None

        company_code = invoice.get("company_code_on_invoice")
        if company_code:
            company = supabase.table("company").select("*").eq("company_code", company_code).execute()
            invoice["company"] = company.data[0] if company.data else None
        else:
            invoice["company"] = None

        return invoice
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
async def update_invoice(invoice_doc_no: int, payload: dict, request: Request):
    try:
        current_record = (
            supabase.table("invoices")
            .select("status, amount")
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

        if next_status and next_status.strip().lower() == "paid":
            approver_email = request.headers.get("x-approver-email")
            _authorize_payment(current_record.data[0].get("amount"), approver_email)

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