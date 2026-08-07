# app/routers/orchestrator.py
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import httpx

from app.core.supabase import supabase
from app.services.supervity import execute_workflow_stream

log = logging.getLogger(__name__)

router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])

# The "Invoice Orchestrator" operator on Supervity: fetches the first 100
# 'parked' invoices from Supabase, runs all 5 validation subworkflows against
# them in parallel, and aggregates the results into a consolidated report.
# Takes no inputs.
INVOICE_ORCHESTRATOR_WORKFLOW_ID = "019fdc8c-fb68-7000-815c-778caf0763b2"


@router.get("/parked-count")
async def get_parked_invoice_count():
    """Count of invoices currently sitting in 'parked' status — the pool this
    orchestrator run will pick up (capped at the first 100 by the workflow)."""
    response = (
        supabase.table("invoices")
        .select("invoice_doc_no", count="exact")
        .eq("status", "parked")
        .execute()
    )
    return {"count": response.count or 0}


@router.post("/run/stream")
async def run_orchestrator_stream():
    """SSE-streamed execution of the Invoice Orchestrator — proxies Supervity's
    stream back to the caller. Can run long: up to 100 invoices across 5
    parallel validation subworkflows."""

    async def event_generator():
        try:
            async for line in execute_workflow_stream(INVOICE_ORCHESTRATOR_WORKFLOW_ID, inputs={}, envs={}):
                yield f"{line}\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {e.response.text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
