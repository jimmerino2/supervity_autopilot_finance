# app/routers/gl_account.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/gl_account", tags=["GlAccount"])


@router.get("/")
async def list_gl_account():
    try:
        response = supabase.table("gl_account").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{gl_account_code}")
async def get_gl_account(gl_account_code: int):
    try:
        response = (
            supabase.table("gl_account")
            .select("*")
            .eq("gl_account_code", gl_account_code)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="GL account not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_gl_account(payload: dict):
    try:
        response = supabase.table("gl_account").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{gl_account_code}")
async def update_gl_account(gl_account_code: int, payload: dict):
    try:
        response = (
            supabase.table("gl_account")
            .update(payload)
            .eq("gl_account_code", gl_account_code)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{gl_account_code}")
async def delete_gl_account(gl_account_code: int):
    try:
        response = (
            supabase.table("gl_account")
            .delete()
            .eq("gl_account_code", gl_account_code)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
