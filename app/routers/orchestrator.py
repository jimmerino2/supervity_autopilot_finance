# app/routers/orchestrator.py
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.core.supabase import supabase, SUPABASE_URL, SUPABASE_KEY, SUPABASE_USERNAME, SUPABASE_PASSWORD
from app.services.supervity import execute_workflow_stream, get_workflow_runs, get_schedules

log = logging.getLogger(__name__)

router = APIRouter(prefix="/orchestrator", tags=["Orchestrator"])

# Run statuses that mean a run is still in flight — used to block starting
# another run of the same operator until the current one finishes.
_ACTIVE_STATUSES = {"running", "waiting", "scheduled"}

# Passed as runtime `envs` on execute so the "Generate Invoice Review Forms"
# workflow's Supabase step authenticates with this app's credentials. Names on
# the right are the exact env var names the workflow reads (per its Supervity
# config), which differ from the naming used by other workflows (e.g. policies.py).
_MANUAL_VALIDATION_ENVS = {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_API_KEY": SUPABASE_KEY,
    "SUPABASE_USERNAME": SUPABASE_USERNAME,
    "SUPABASE_PASSWORD": SUPABASE_PASSWORD,
}

# Same idea for "Issue Payments and Emails" — its steps read SUPABASE_SERVICE_ROLE_KEY,
# while its Email Vendor Operator subworkflow reads SUPABASE_KEY/SUPABASE_API_KEY
# (per the workflow's own env descriptions: "same value as SUPABASE_SERVICE_ROLE_KEY").
# Unlike SUPABASE_URL/USERNAME/PASSWORD/SUPABASE_SERVICE_ROLE_KEY, those two have no
# baked-in default on Supervity's side, so they must be passed at runtime.
_ISSUE_PAYMENTS_ENVS = {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY,
    "SUPABASE_KEY": SUPABASE_KEY,
    "SUPABASE_API_KEY": SUPABASE_KEY,
    "SUPABASE_USERNAME": SUPABASE_USERNAME,
    "SUPABASE_PASSWORD": SUPABASE_PASSWORD,
}

# The master orchestrators surfaced in the Workbench, each pinned to a
# specific Supervity workflow. `related_status` names the invoices.status
# value shown as a live count alongside that card (None if not applicable).
# `workflow_id: None` marks a placeholder — not runnable yet, no Supervity
# lookups attempted for it.
ORCHESTRATORS = {
    "outlook-extraction": {
        "workflow_id": "019fd177-01cf-7001-9b7a-7a2408784ac4",
        "name": "Scan Outlook for Invoices",
        "description": "Scans Outlook for invoice emails and logs new invoices into Supabase as parked.",
        "inputs": {},
        "envs": {},
        "related_status": None,
    },
    "invoice-pending-open": {
        "workflow_id": "019fdc8c-fb68-7000-815c-778caf0763b2",
        "name": "Validate Parked Invoices",
        "description": "Validates parked invoices and updates them to open or pending approval.",
        "inputs": {"submitted_by": "Supervity Auto"},
        "envs": {},
        "related_status": "parked",
    },
    "manual-validation": {
        "workflow_id": "019fe02b-eaa1-7000-bf92-0a6bad1a5c47",
        "name": "Generate Invoice Review Forms",
        "description": "Reviews blocked invoices and generates Invoice Manual Approval Requests for a human reviewer.",
        "inputs": {},
        "envs": _MANUAL_VALIDATION_ENVS,
        "related_status": "pending_approval",
    },
    "issue-payments": {
        "workflow_id": "019fe03f-3db9-7000-bad5-2808c6571f29",
        "name": "Issue Payments",
        "description": "Updates open invoices to closed and emails vendors when enabled by policy.",
        "inputs": {},
        "envs": _ISSUE_PAYMENTS_ENVS,
        "related_status": "open",
    },
}

# Maps each orchestrator's related_status to a display label for its count.
_STATUS_LABELS = {
    "parked": "Parked Invoices",
    "pending_approval": "Pending Approval",
    "open": "Open Invoices",
}


def _get_orchestrator(key: str) -> dict:
    orchestrator = ORCHESTRATORS.get(key)
    if not orchestrator:
        raise HTTPException(status_code=404, detail=f"Unknown orchestrator '{key}'")
    return orchestrator


def _count_invoices_with_status(status: str) -> int:
    response = (
        supabase.table("invoices")
        .select("invoice_doc_no", count="exact")
        .eq("status", status)
        .execute()
    )
    return response.count or 0


@router.get("/invoice-counts")
async def get_invoice_counts():
    """Counts by status relevant to the invoice orchestrators."""
    return {
        "parked": _count_invoices_with_status("parked"),
        "pendingApproval": _count_invoices_with_status("pending_approval"),
        "open": _count_invoices_with_status("open"),
    }


@router.get("/status")
async def get_orchestrators_status():
    """For each known orchestrator: whether a run is currently in flight
    (gates the Run button), and its configured schedule if any."""
    try:
        schedules_response = await get_schedules(limit=100)
    except Exception as e:
        log.warning(f"Unable to load schedules: {e}")
        schedules_response = {"schedules": []}
    schedules_by_workflow = {s["workflowId"]: s for s in schedules_response.get("schedules", [])}

    result = []
    for key, orchestrator in ORCHESTRATORS.items():
        workflow_id = orchestrator["workflow_id"]

        is_active = False
        latest_run = None
        schedule = None

        if workflow_id:
            try:
                runs_response = await get_workflow_runs(workflow_id=workflow_id, page=1, limit=1)
                latest_run = (runs_response.get("workflowRuns") or [None])[0]
            except Exception as e:
                log.warning(f"Unable to load latest run for {workflow_id}: {e}")
            is_active = bool(latest_run and latest_run.get("status") in _ACTIVE_STATUSES)
            schedule = schedules_by_workflow.get(workflow_id)

        related_status = orchestrator["related_status"]
        related_count = (
            {"label": _STATUS_LABELS.get(related_status, related_status), "count": _count_invoices_with_status(related_status)}
            if related_status
            else None
        )

        result.append(
            {
                "key": key,
                "workflowId": workflow_id,
                "name": orchestrator["name"],
                "description": orchestrator["description"],
                "isConfigured": workflow_id is not None,
                "isActive": is_active,
                "latestRun": latest_run,
                "relatedCount": related_count,
                "schedule": {
                    "description": schedule.get("description"),
                    "isPaused": schedule.get("isPaused"),
                    "timezone": (schedule.get("definition") or {}).get("timezone"),
                }
                if schedule
                else None,
            }
        )

    return {"orchestrators": result}


@router.post("/{key}/run/stream")
async def run_orchestrator_stream(key: str):
    """SSE-streamed execution of the given orchestrator — proxies Supervity's
    stream back to the caller."""
    orchestrator = _get_orchestrator(key)
    if not orchestrator["workflow_id"]:
        raise HTTPException(status_code=501, detail=f"'{orchestrator['name']}' is not configured yet.")

    async def event_generator():
        try:
            async for line in execute_workflow_stream(
                orchestrator["workflow_id"], inputs=orchestrator["inputs"], envs=orchestrator["envs"]
            ):
                yield f"{line}\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {e.response.text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
