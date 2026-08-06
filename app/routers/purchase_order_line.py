# app/routers/purchase_order_line.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/purchase_order_line", tags=["PurchaseOrderLine"])


@router.get("/")
async def list_purchase_order_line(po_id: int | None = None):
    try:
        query = supabase.table("purchase_order_line").select("*, goods_receipt:goods_receipt(*)")
        if po_id is not None:
            query = query.eq("po_id", po_id)
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{po_id}/{line_no}")
async def get_purchase_order_line(po_id: int, line_no: int):
    try:
        response = (
            supabase.table("purchase_order_line")
            .select("*, goods_receipt:goods_receipt(*)")
            .eq("po_id", po_id)
            .eq("line_no", line_no)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Purchase order line not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
