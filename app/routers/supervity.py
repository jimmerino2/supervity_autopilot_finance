# app/api/routes/supervity.py

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.supervity import (
    get_all_workflows,
    get_workflow,
    get_workflow_versions,
    set_default_workflow_version,
    delete_workflow,
    save_workflow_envs,
    update_workflow_sharing,
    get_upcoming_runs,
    set_schedule_paused,
    parse_schedule,
    delete_schedule,
    execute_workflow,
    execute_workflow_stream,
    cancel_workflow_runs,
    get_workflow_runs,
    get_workflow_runs_dashboard,
    get_workflow_run,
    get_user_forms,
    get_user_form_html,
    submit_user_form,
    create_chat_thread,
    list_chat_threads,
    get_chat_messages,
    send_chat_message_stream,
    delete_chat_thread,
)

router = APIRouter(prefix="/supervity", tags=["Supervity"])


# ---------------------------------------------------------------------------
# Shared error handling
# ---------------------------------------------------------------------------

def _raise_from(e: Exception) -> None:
    """Forward the real Supervity status code + body instead of masking everything as 500."""
    if isinstance(e, httpx.HTTPStatusError):
        try:
            detail = e.response.json()
        except ValueError:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail)
    raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class EnvVar(BaseModel):
    name: str = Field(..., min_length=1)
    value: str
    description: Optional[str] = None


class SaveEnvsBody(BaseModel):
    envs: list[EnvVar]


class SharingBody(BaseModel):
    shareWithTeamKeys: list[str] = Field(default_factory=list)


class SchedulePauseBody(BaseModel):
    paused: bool


class ScheduleParseBody(BaseModel):
    input: str


class ExecuteBody(BaseModel):
    workflowId: str
    inputs: dict = Field(default_factory=dict)
    envs: dict = Field(default_factory=dict)


class SubmitFormBody(BaseModel):
    fields: dict = Field(default_factory=dict)


class CancelBody(BaseModel):
    runIds: Optional[list[str]] = None
    workflowId: Optional[str] = None
    reason: Optional[str] = None


class SendChatMessageBody(BaseModel):
    message: str
    model: Optional[str] = None


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

@router.get("/workflows")
async def list_workflows(
    page: int = 1,
    limit: int = 20,
    isDraft: Optional[bool] = None,
    search: Optional[str] = None,
):
    try:
        return await get_all_workflows(page=page, limit=limit, is_draft=isDraft, search=search)
    except Exception as e:
        _raise_from(e)


@router.get("/workflows/{workflow_id}")
async def get_workflow_details(workflow_id: str):
    try:
        return await get_workflow(workflow_id)
    except Exception as e:
        _raise_from(e)


@router.get("/workflows/{workflow_id}/versions")
async def list_workflow_versions(workflow_id: str, limit: int = 20, includeAll: bool = False):
    try:
        return await get_workflow_versions(workflow_id, limit=limit, include_all=includeAll)
    except Exception as e:
        _raise_from(e)


@router.post("/workflows/{workflow_id}/versions/{version_id}/default")
async def set_workflow_default_version(workflow_id: str, version_id: str):
    try:
        return await set_default_workflow_version(workflow_id, version_id)
    except Exception as e:
        _raise_from(e)


@router.delete("/workflows/{workflow_id}")
async def remove_workflow(workflow_id: str):
    try:
        return await delete_workflow(workflow_id)
    except Exception as e:
        _raise_from(e)


@router.post("/workflows/{workflow_id}/envs")
async def save_envs(workflow_id: str, body: SaveEnvsBody):
    try:
        return await save_workflow_envs(workflow_id, [e.model_dump(exclude_none=True) for e in body.envs])
    except Exception as e:
        _raise_from(e)


@router.patch("/workflows/{workflow_id}/sharing")
async def update_sharing(workflow_id: str, body: SharingBody):
    try:
        return await update_workflow_sharing(workflow_id, body.shareWithTeamKeys)
    except Exception as e:
        _raise_from(e)


@router.get("/workflows/{workflow_id}/upcoming-runs")
async def workflow_upcoming_runs(workflow_id: str):
    try:
        return await get_upcoming_runs(workflow_id)
    except Exception as e:
        _raise_from(e)


@router.put("/workflows/{workflow_id}/schedule")
async def pause_resume_schedule(workflow_id: str, body: SchedulePauseBody):
    try:
        return await set_schedule_paused(workflow_id, body.paused)
    except Exception as e:
        _raise_from(e)


@router.post("/workflows/{workflow_id}/schedule/parse")
async def parse_workflow_schedule(workflow_id: str, body: ScheduleParseBody):
    try:
        return await parse_schedule(workflow_id, body.input)
    except Exception as e:
        _raise_from(e)


@router.delete("/workflows/{workflow_id}/schedule")
async def remove_schedule(workflow_id: str):
    try:
        return await delete_schedule(workflow_id)
    except Exception as e:
        _raise_from(e)


# ---------------------------------------------------------------------------
# Workflow Runs
# ---------------------------------------------------------------------------

@router.post("/workflow-runs/execute")
async def run_workflow(body: ExecuteBody):
    """Blocking execution — waits for the workflow to finish. Can be long-running."""
    try:
        return await execute_workflow(body.workflowId, inputs=body.inputs, envs=body.envs)
    except Exception as e:
        _raise_from(e)


@router.post("/workflow-runs/execute/stream")
async def run_workflow_stream(body: ExecuteBody):
    """SSE-streamed execution — proxies Supervity's stream back to the caller."""
    from fastapi.responses import StreamingResponse

    async def event_generator():
        try:
            async for line in execute_workflow_stream(body.workflowId, inputs=body.inputs, envs=body.envs):
                yield f"{line}\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {e.response.text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/workflow-runs/cancel")
async def cancel_runs(body: CancelBody):
    if not body.runIds and not body.workflowId:
        raise HTTPException(status_code=400, detail="Must provide either runIds or workflowId")
    try:
        return await cancel_workflow_runs(run_ids=body.runIds, workflow_id=body.workflowId, reason=body.reason)
    except Exception as e:
        _raise_from(e)


@router.get("/workflow-runs")
async def list_workflow_runs(
    workflowId: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
):
    try:
        return await get_workflow_runs(workflow_id=workflowId, status=status, page=page, limit=limit, search=search)
    except Exception as e:
        _raise_from(e)


@router.get("/workflow-runs/dashboard/{workflow_id}")
async def workflow_runs_dashboard(workflow_id: str):
    try:
        return await get_workflow_runs_dashboard(workflow_id)
    except Exception as e:
        _raise_from(e)


@router.get("/workflow-runs/{run_id}")
async def workflow_run_details(run_id: str):
    try:
        return await get_workflow_run(run_id)
    except Exception as e:
        _raise_from(e)


# ---------------------------------------------------------------------------
# User Forms
# ---------------------------------------------------------------------------

@router.get("/user-forms")
async def list_user_forms(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    sortBy: Optional[str] = None,
    sortOrder: Optional[str] = None,
    status: Optional[str] = None,
):
    try:
        return await get_user_forms(
            page=page, limit=limit, search=search, sort_by=sortBy, sort_order=sortOrder, status=status
        )
    except Exception as e:
        _raise_from(e)


@router.get("/user-forms/{form_id}")
async def get_form(form_id: str):
    try:
        return await get_user_form_html(form_id)
    except Exception as e:
        _raise_from(e)


# Placeholder for the "send email to customer" operator triggered by the
# "Send email to customer" checkbox on the Invoice Manual Approval Requests
# review form — the workflow ID will be provided later. Until then this
# responds 501 rather than silently no-op'ing or failing unclearly.
NOTIFY_CUSTOMER_WORKFLOW_ID: Optional[str] = None


@router.post("/user-forms/{activity_run_id}/notify-customer")
async def notify_customer(activity_run_id: str, payload: dict):
    # NOTE: this literal-path route must stay registered before the
    # generic /user-forms/{activity_run_id}/{status} route below, otherwise
    # FastAPI matches "notify-customer" as the {status} path param instead.
    if not NOTIFY_CUSTOMER_WORKFLOW_ID:
        raise HTTPException(status_code=501, detail="Customer notification operator is not configured yet.")
    try:
        return await execute_workflow(NOTIFY_CUSTOMER_WORKFLOW_ID, inputs=payload)
    except Exception as e:
        _raise_from(e)


@router.post("/user-forms/{activity_run_id}/{status}")
async def submit_form(activity_run_id: str, status: str, body: SubmitFormBody):
    """Wraps Supervity's raw HTML confirmation page as {"html": ...}, matching the
    shape GET /user-forms/{form_id} already uses — keeps every endpoint on this
    router returning JSON so the frontend can use one fetch client throughout."""
    if status not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail='status must be "approve" or "reject"')
    try:
        html = await submit_user_form(activity_run_id, status, body.fields)
        return {"html": html}
    except Exception as e:
        _raise_from(e)


# ---------------------------------------------------------------------------
# Chats
# ---------------------------------------------------------------------------

@router.post("/chats")
async def create_thread():
    try:
        return await create_chat_thread()
    except Exception as e:
        _raise_from(e)


@router.get("/chats")
async def list_threads(page: int = 1, limit: int = 20):
    try:
        return await list_chat_threads(page=page, limit=limit)
    except Exception as e:
        _raise_from(e)


@router.get("/chats/{thread_id}/messages")
async def thread_messages(thread_id: str, limit: int = 20):
    try:
        return await get_chat_messages(thread_id, limit=limit)
    except Exception as e:
        _raise_from(e)


@router.post("/chats/{thread_id}/messages")
async def send_message(thread_id: str, body: SendChatMessageBody):
    """SSE-streamed AI response — proxies Supervity's stream back to the caller."""
    from fastapi.responses import StreamingResponse

    async def event_generator():
        try:
            async for line in send_chat_message_stream(thread_id, body.message, body.model):
                yield f"{line}\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: {e.response.text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/chats/{thread_id}")
async def remove_thread(thread_id: str):
    try:
        return await delete_chat_thread(thread_id)
    except Exception as e:
        _raise_from(e)