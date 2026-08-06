# app/routers/vendor.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/vendor", tags=["Vendor"])

@router.get("/")
async def list_vendor():
    try:
        # Fetch all rows from the 'vendor' table
        response = supabase.table("vendor").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{vendor_id}")
async def update_vendor(vendor_id: int, payload: dict):
    try:
        response = (
            supabase.table("vendor")
            .update(payload)
            .eq("vendor_id", vendor_id)
            .execute()
        )
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
        # Insert a new record into the 'vendor' table
        response = supabase.table("vendor").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))