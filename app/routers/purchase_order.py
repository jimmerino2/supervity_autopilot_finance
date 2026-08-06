# app/routers/purchase_order.py
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase

router = APIRouter(prefix="/purchase_order", tags=["PurchaseOrder"])

# purchase_order.vendor_id -> vendor and purchase_order.company_code -> company
# are real FKs, as is purchase_order_line.po_id -> purchase_order and
# goods_receipt's composite FK into purchase_order_line, so all can be embedded
# in a single PostgREST query.
_LIST_SELECT = "*, vendor:vendor(vendor_name), company:company(company_name)"
_DETAIL_SELECT = (
    "*, vendor:vendor(vendor_name), company:company(company_name), "
    "purchase_order_line:purchase_order_line(*, goods_receipt:goods_receipt(*))"
)


@router.get("/")
async def list_purchase_order():
    try:
        response = supabase.table("purchase_order").select(_LIST_SELECT).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{po_id}")
async def get_purchase_order(po_id: int):
    try:
        response = (
            supabase.table("purchase_order")
            .select(_DETAIL_SELECT)
            .eq("po_id", po_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
