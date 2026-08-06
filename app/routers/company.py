# app/routers/company.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/company", tags=["Company"])


@router.get("/")
async def list_company():
    try:
        response = supabase.table("company").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{company_code}")
async def get_company(company_code: str):
    try:
        response = (
            supabase.table("company")
            .select("*")
            .eq("company_code", company_code)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Company not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
