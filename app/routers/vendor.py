# app/routers/vendor.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/vendor", tags=["Vendor"])

_MISSING_HISTORY = object()


def _split_vendor_payload(payload: dict):
    vendor_payload = dict(payload)
    history_entries = vendor_payload.pop("bank_account_history", _MISSING_HISTORY)
    return vendor_payload, history_entries if history_entries is not _MISSING_HISTORY else None


def _sync_bank_history(vendor_id: int, history_entries: list[dict] | None):
    if history_entries is None:
        return

    supabase.table("bank_account_history").delete().eq("vendor_id", vendor_id).execute()

    for entry in history_entries:
        if not isinstance(entry, dict):
            continue
        row = dict(entry)
        row["vendor_id"] = vendor_id
        supabase.table("bank_account_history").insert(row).execute()


@router.get("/")
async def list_vendor():
    try:
        response = supabase.table("vendor").select("*, bank_account_history:bank_account_history(*)").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{vendor_id}")
async def update_vendor(vendor_id: int, payload: dict):
    try:
        vendor_payload, history_entries = _split_vendor_payload(payload)
        response = (
            supabase.table("vendor")
            .update(vendor_payload)
            .eq("vendor_id", vendor_id)
            .execute()
        )

        if response.data is not None:
            _sync_bank_history(vendor_id, history_entries)

        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: int):
    try:
        response = (
            supabase.table("vendor")
            .delete()
            .eq("vendor_id", vendor_id)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_vendor(payload: dict):
    try:
        vendor_payload, history_entries = _split_vendor_payload(payload)
        response = supabase.table("vendor").insert(vendor_payload).execute()

        if response.data:
            vendor_record = response.data[0]
            vendor_id = vendor_record.get("vendor_id")
            if vendor_id:
                _sync_bank_history(vendor_id, history_entries)

        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))