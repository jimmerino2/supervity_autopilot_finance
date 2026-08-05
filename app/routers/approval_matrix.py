# app/routers/approval_matrix.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/approval_matrix", tags=["ApprovalMatrix"])

@router.get("/")
async def list_approval_matrix():
    try:
        # Fetch all rows from the 'approval_matrix' table
        response = supabase.table("approval_matrix").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{approval_matrix_id}")
async def update_approval_matrix(approval_matrix_id: int, payload: dict):
    try:
        response = (
            supabase.table("approval_matrix")
            .update(payload)
            .eq("approval_matrix_id", approval_matrix_id)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{approval_matrix_id}")
async def delete_approval_matrix(approval_matrix_id: int):
    try:
        response = (
            supabase.table("approval_matrix")
            .delete()
            .eq("approval_matrix_id", approval_matrix_id)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/")
async def create_approval_matrix(payload: dict):
    try:
        # Insert a new record into the 'approval_matrix' table
        response = supabase.table("approval_matrix").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))