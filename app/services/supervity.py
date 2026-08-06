# app/services/supervity.py

import os
import json
import httpx

SUPERVITY_BASE_URL = os.getenv("SUPERVITY_BASE_URL", "https://auto-workflow-api.supervity.ai/api/v1")
SUPERVITY_API_KEY = os.getenv("SUPERVITY_API_KEY")

headers = {
    "Authorization": f"Bearer {SUPERVITY_API_KEY}",
    "x-source": "external",
}


def _log_error(response: httpx.Response) -> None:
    if response.status_code >= 400:
        print(f"Supervity API Error [{response.status_code}]: {response.text}")


# ---------------------------------------------------------------------------
# Workflows  (base path: /workflows)
# ---------------------------------------------------------------------------

async def get_all_workflows(page: int = 1, limit: int = 20, is_draft: bool | None = None, search: str | None = None) -> dict:
    """GET /workflows — list workflows owned by the authenticated user/org."""
    params = {"page": page, "limit": limit}
    if is_draft is not None:
        params["isDraft"] = is_draft
    if search:
        params["search"] = search

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/workflows", headers=headers, params=params)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_workflow(workflow_id: str) -> dict:
    """GET /workflows/:workflowId — full details of a specific workflow."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_workflow_versions(workflow_id: str, limit: int = 20, include_all: bool = False) -> dict:
    """GET /workflows/:workflowId/versions — list published versions, newest first."""
    params = {"limit": limit, "includeAll": include_all}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/versions", headers=headers, params=params
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def set_default_workflow_version(workflow_id: str, version_id: str) -> dict:
    """POST /workflows/:workflowId/versions/:versionId/default — set a version as active/default."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/versions/{version_id}/default", headers=headers
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def delete_workflow(workflow_id: str) -> dict:
    """DELETE /workflows/:workflowId — soft-delete a workflow. Owner only."""
    async with httpx.AsyncClient() as client:
        response = await client.delete(f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def save_workflow_envs(workflow_id: str, envs: list[dict]) -> dict:
    """POST /workflows/:workflowId/envs — upsert env vars for the default published version.

    envs: list of {"name": str, "value": str, "description": str (optional)}
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/envs",
            headers=headers,
            json={"envs": envs},
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def update_workflow_sharing(workflow_id: str, share_with_team_keys: list[str]) -> dict:
    """PATCH /workflows/:workflowId/sharing — replace team-sharing config. Pass [] to revoke all."""
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/sharing",
            headers=headers,
            json={"shareWithTeamKeys": share_with_team_keys},
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_upcoming_runs(workflow_id: str) -> dict:
    """GET /workflows/:workflowId/upcoming-runs — next scheduled execution times."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/upcoming-runs", headers=headers
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def set_schedule_paused(workflow_id: str, paused: bool) -> dict:
    """PUT /workflows/:workflowId/schedule — pause or resume the Temporal schedule.

    Raises 404 if no schedule exists for this workflow.
    """
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/schedule",
            headers=headers,
            json={"paused": paused},
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def parse_schedule(workflow_id: str, input_text: str) -> dict:
    """POST /workflows/:workflowId/schedule/parse — parse natural-language schedule
    (e.g. "every Monday at 9am") and create/update the Temporal schedule.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/schedule/parse",
            headers=headers,
            json={"input": input_text},
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def delete_schedule(workflow_id: str) -> dict:
    """DELETE /workflows/:workflowId/schedule — remove the schedule entirely.

    Raises 404 if no schedule exists for this workflow.
    """
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{SUPERVITY_BASE_URL}/workflows/{workflow_id}/schedule", headers=headers
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


# ---------------------------------------------------------------------------
# Workflow Runs  (base path: /workflow-runs)
# ---------------------------------------------------------------------------

async def execute_workflow(workflow_id: str, inputs: dict | None = None, envs: dict | None = None) -> dict:
    """POST /workflow-runs/execute — execute a workflow (blocking).

    Waits for completion before returning. Can be long-running — prefer
    execute_workflow_stream() for UI-facing calls.

    NOTE: multipart/form-data body — do not set Content-Type manually,
    httpx sets the correct multipart boundary automatically when using `data=`.
    """
    data = {
        "workflowId": workflow_id,
        "inputs": json.dumps(inputs or {}),
        "envs": json.dumps(envs or {}),
    }
    # Don't reuse the module-level `headers` Content-Type-sensitive dict blindly;
    # multipart needs its boundary auto-set, so exclude any preset Content-Type.
    execute_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}

    async with httpx.AsyncClient(timeout=300) as client:  # long timeout: blocking execution
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflow-runs/execute", headers=execute_headers, data=data
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def execute_workflow_stream(workflow_id: str, inputs: dict | None = None, envs: dict | None = None):
    """POST /workflow-runs/execute/stream — execute a workflow, streaming SSE progress.

    Async generator yielding raw SSE lines. Events include: ping, activity-run,
    workflow-run, thinking, result, error.
    """
    data = {
        "workflowId": workflow_id,
        "inputs": json.dumps(inputs or {}),
        "envs": json.dumps(envs or {}),
    }
    execute_headers = {k: v for k, v in headers.items() if k.lower() != "content-type"}

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{SUPERVITY_BASE_URL}/workflow-runs/execute/stream", headers=execute_headers, data=data
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    yield line


async def cancel_workflow_runs(run_ids: list[str] | None = None, workflow_id: str | None = None, reason: str | None = None) -> dict:
    """POST /workflow-runs/cancel — cancel specific runs, or all runs for a workflow.

    Provide exactly one of run_ids or workflow_id.
    """
    if not run_ids and not workflow_id:
        raise ValueError("Must provide either run_ids or workflow_id")

    payload: dict = {}
    if run_ids:
        payload["runIds"] = run_ids
    if workflow_id:
        payload["workflowId"] = workflow_id
    if reason:
        payload["reason"] = reason

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflow-runs/cancel", headers=headers, json=payload
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_workflow_runs(
    workflow_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 10,
    search: str | None = None,
) -> dict:
    """GET /workflow-runs — list workflow runs with optional filters.

    status: one of scheduled, running, completed, failed, cancelled, waiting
    """
    params = {"page": page, "limit": limit}
    if workflow_id:
        params["workflowId"] = workflow_id
    if status:
        params["status"] = status
    if search:
        params["search"] = search

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/workflow-runs", headers=headers, params=params)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_workflow_runs_dashboard(workflow_id: str) -> dict:
    """GET /workflow-runs/dashboard/:workflowId — run counts by status for a workflow."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPERVITY_BASE_URL}/workflow-runs/dashboard/{workflow_id}", headers=headers
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_workflow_run(run_id: str) -> dict:
    """GET /workflow-runs/:runId — a single run including all its activity (step) runs."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/workflow-runs/{run_id}", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()