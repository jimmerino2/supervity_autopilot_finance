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


class CancelBody(BaseModel):
    runIds: Optional[list[str]] = None
    workflowId: Optional[str] = None
    reason: Optional[str] = None


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