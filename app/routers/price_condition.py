# app/routers/price_condition.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/price_condition", tags=["PriceCondition"])


@router.get("/")
async def list_price_condition():
    try:
        response = supabase.table("price_condition").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{condition_record_no}/{condition_line}")
async def get_price_condition(condition_record_no: int, condition_line: int):
    try:
        response = (
            supabase.table("price_condition")
            .select("*")
            .eq("condition_record_no", condition_record_no)
            .eq("condition_line", condition_line)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Price condition not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_price_condition(payload: dict):
    try:
        response = supabase.table("price_condition").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{condition_record_no}/{condition_line}")
async def update_price_condition(condition_record_no: int, condition_line: int, payload: dict):
    try:
        response = (
            supabase.table("price_condition")
            .update(payload)
            .eq("condition_record_no", condition_record_no)
            .eq("condition_line", condition_line)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{condition_record_no}/{condition_line}")
async def delete_price_condition(condition_record_no: int, condition_line: int):
    try:
        response = (
            supabase.table("price_condition")
            .delete()
            .eq("condition_record_no", condition_record_no)
            .eq("condition_line", condition_line)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
