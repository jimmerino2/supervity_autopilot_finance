# app/services/supervity.py

import os
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

def _execute_fields(workflow_id: str, inputs: dict | None, envs: dict | None) -> dict:
    """Build the multipart fields for /workflow-runs/execute[/stream].

    NOTE: this endpoint only accepts multipart/form-data, and `inputs`/`envs`
    must be sent as bracket-notation nested fields (e.g. `inputs[key]=value`),
    not as a JSON body or a JSON-encoded string field. Verified against the
    live API:
      - JSON body (`Content-Type: application/json`)            -> 500 Internal Server Error
      - multipart with inputs/envs as JSON-encoded string fields -> 400 "expected record, received string"
      - multipart with inputs[key]=value / envs[key]=value       -> 200 OK
    """
    fields = {"workflowId": workflow_id}
    for key, value in (inputs or {}).items():
        fields[f"inputs[{key}]"] = str(value)
    for key, value in (envs or {}).items():
        fields[f"envs[{key}]"] = str(value)
    return fields


async def execute_workflow(workflow_id: str, inputs: dict | None = None, envs: dict | None = None) -> dict:
    """POST /workflow-runs/execute — execute a workflow (blocking).

    Waits for completion before returning. Can be long-running — prefer
    execute_workflow_stream() for UI-facing calls.
    """
    fields = _execute_fields(workflow_id, inputs, envs)
    files = {name: (None, value) for name, value in fields.items()}

    async with httpx.AsyncClient(timeout=300) as client:  # long timeout: blocking execution
        response = await client.post(
            f"{SUPERVITY_BASE_URL}/workflow-runs/execute", headers=headers, files=files
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def execute_workflow_stream(workflow_id: str, inputs: dict | None = None, envs: dict | None = None):
    """POST /workflow-runs/execute/stream — execute a workflow, streaming SSE progress.

    Async generator yielding raw SSE lines. Events include: ping, activity-run,
    workflow-run, thinking, result, error.
    """
    fields = _execute_fields(workflow_id, inputs, envs)
    files = {name: (None, value) for name, value in fields.items()}

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{SUPERVITY_BASE_URL}/workflow-runs/execute/stream", headers=headers, files=files
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


# ---------------------------------------------------------------------------
# User Forms  (base path: /user-forms)
#
# Created when a workflow step is marked `is_human_input_step: true`: the
# Temporal workflow pauses and a form record is generated for a human
# reviewer. Submitting resumes the paused workflow via a Temporal signal.
# ---------------------------------------------------------------------------

async def get_user_forms(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    status: str | None = None,
) -> dict:
    """GET /user-forms — list human-review forms for workflows owned by the authenticated user.

    status: one of pending, approved, rejected. sortBy: createdAt, updatedAt,
    workflowName, status. sortOrder: asc, desc.
    """
    params = {"page": page, "limit": limit}
    if search:
        params["search"] = search
    if sort_by:
        params["sortBy"] = sort_by
    if sort_order:
        params["sortOrder"] = sort_order
    if status:
        params["status"] = status

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/user-forms", headers=headers, params=params)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_user_form_html(form_id: str) -> dict:
    """GET /user-forms/:formId — the form's HTML content, for rendering in a browser/iframe.
    Publicly accessible on Supervity's side (no auth needed), but sending our headers is harmless."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/user-forms/{form_id}", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def submit_user_form(activity_run_id: str, status: str, fields: dict | None = None) -> str:
    """POST /user-forms/:activityRunId/:status — submit reviewer input and resume the
    paused workflow. `status` must be "approve" or "reject". multipart/form-data per
    docs.supervity.ai — reviewer-filled fields as form fields. Returns a raw HTML
    confirmation page (not JSON), matching the rest of this endpoint's contract.
    """
    if status not in ("approve", "reject"):
        raise ValueError('status must be "approve" or "reject"')

    url = f"{SUPERVITY_BASE_URL}/user-forms/{activity_run_id}/{status}"

    async with httpx.AsyncClient(timeout=60) as client:
        if fields:
            files = {name: (None, str(value)) for name, value in fields.items()}
            response = await client.post(url, headers=headers, files=files)
        else:
            # httpx silently drops the multipart Content-Type for an empty `files`
            # dict and sends a bodyless request instead — but this endpoint only
            # accepts multipart/form-data (same class of quirk as
            # /workflow-runs/execute above), so build a minimal valid empty
            # multipart body by hand for the no-fields case rather than risk it.
            boundary = "supervityemptyformboundary"
            body = f"--{boundary}--\r\n".encode()
            req_headers = {**headers, "Content-Type": f"multipart/form-data; boundary={boundary}"}
            response = await client.post(url, headers=req_headers, content=body)
        _log_error(response)
        response.raise_for_status()
        return response.text


# ---------------------------------------------------------------------------
# Chats  (base path: /chats)
# ---------------------------------------------------------------------------

async def create_chat_thread() -> dict:
    """POST /chats — create a new empty chat thread. Returns {"threadId": ...}."""
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SUPERVITY_BASE_URL}/chats", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def list_chat_threads(page: int = 1, limit: int = 20) -> dict:
    """GET /chats — list chat threads for the authenticated user, newest first."""
    params = {"page": page, "limit": limit}
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SUPERVITY_BASE_URL}/chats", headers=headers, params=params)
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def get_chat_messages(thread_id: str, limit: int = 20) -> dict:
    """GET /chats/:threadId/messages — messages in a thread plus any linked workflow/rule.

    NOTE: despite docs.supervity.ai listing `page` as a valid query param here,
    the live endpoint rejects it with "unrecognized_keys" — only `limit` works.
    """
    params = {"limit": limit}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPERVITY_BASE_URL}/chats/{thread_id}/messages", headers=headers, params=params
        )
        _log_error(response)
        response.raise_for_status()
        return response.json()


async def send_chat_message_stream(thread_id: str, message: str, model: str | None = None):
    """POST /chats/:threadId/messages — send a message, streaming the SSE response.

    multipart/form-data per docs.supervity.ai/api-docs/chats — a plain string
    field, unlike workflow-runs/execute this one doesn't need a JSON-encoded
    object field, so it isn't affected by that endpoint's validation bug.

    Async generator yielding raw SSE lines. Events: ping, message, error.
    """
    fields: dict[str, str] = {"message": message}
    if model:
        fields["model"] = model
    files = {name: (None, value) for name, value in fields.items()}

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{SUPERVITY_BASE_URL}/chats/{thread_id}/messages", headers=headers, files=files
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    yield line


async def delete_chat_thread(thread_id: str) -> dict:
    """DELETE /chats/:threadId — soft-delete a thread and its messages."""
    async with httpx.AsyncClient() as client:
        response = await client.delete(f"{SUPERVITY_BASE_URL}/chats/{thread_id}", headers=headers)
        _log_error(response)
        response.raise_for_status()
        return response.json()