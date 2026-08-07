# app/routers/insights.py
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.core.supabase import supabase
from app.services.supervity import execute_workflow_stream

log = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["Insights"])

# The "Insights for Invoices" operator on Supervity: scans the 'invoices' table
# in Supabase, generates structured insights via AI, and — as its own final
# step — writes them directly into the 'insights' Supabase table. Takes no
# inputs; its Supabase credentials are baked into the workflow definition on
# Supervity. Persistence happens workflow-side, so this router only proxies
# the run and reads back whatever the workflow saved.
INSIGHTS_WORKFLOW_ID = "019fd81f-d403-7000-9889-ea9235e8454a"


@router.get("/")
async def list_insights():
    """List all persisted insights, newest first."""
    try:
        response = supabase.table("insights").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/stream")
async def generate_insights_stream():
    """SSE-streamed execution of the Insights for Invoices workflow — proxies
    Supervity's stream back to the caller. The workflow itself persists the
    generated insights into the 'insights' table as its last step; the
    frontend re-fetches GET /insights afterward rather than relying on the
    stream payload directly."""

    async def event_generator():
        try:
            async for line in execute_workflow_stream(INSIGHTS_WORKFLOW_ID):
                yield f"{line}\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {e.response.text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
