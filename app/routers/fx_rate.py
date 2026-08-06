# app/routers/fx_rate.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/fx_rate", tags=["FxRate"])


@router.get("/")
async def list_fx_rate(from_currency: str | None = None, to_currency: str | None = None):
    try:
        query = supabase.table("fx_rate").select("*")
        if from_currency:
            query = query.eq("from_currency", from_currency)
        if to_currency:
            query = query.eq("to_currency", to_currency)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
