# app/routers/goods_receipt.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/goods_receipt", tags=["GoodsReceipt"])


@router.get("/")
async def list_goods_receipt(po_id: int | None = None):
    try:
        query = supabase.table("goods_receipt").select("*")
        if po_id is not None:
            query = query.eq("po_id", po_id)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{material_doc_no}/{material_doc_line}")
async def get_goods_receipt(material_doc_no: int, material_doc_line: int):
    try:
        response = (
            supabase.table("goods_receipt")
            .select("*")
            .eq("material_doc_no", material_doc_no)
            .eq("material_doc_line", material_doc_line)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Goods receipt not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
