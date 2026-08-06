# app/routers/policies.py
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from app.core.supabase import supabase
from app.services.supervity import execute_workflow

log = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["Policies"])

# The "Policy Conflict Checker" operator on Supervity: fetches existing policies
# from Supabase and uses an LLM to decide whether a proposed policy conflicts
# with any of them. Outputs {"status": bool, "message": str} — status=true means
# a conflict was found.
CONFLICT_CHECKER_WORKFLOW_ID = "019fd7fe-adc0-7000-b551-064dec108f7b"


def _extract_conflict_result(execute_response: dict) -> dict:
    """The blocking /workflow-runs/execute response shape isn't documented, so
    try the plausible spots: a step's stdout (JSON string) inside activityRuns,
    or a top-level/workflowRun-nested status+message."""
    activity_runs = execute_response.get("activityRuns")
    if isinstance(activity_runs, list) and activity_runs:
        output_str = (activity_runs[-1].get("outputs") or {}).get("output")
        if output_str:
            try:
                parsed = json.loads(output_str)
                if "status" in parsed and "message" in parsed:
                    return {"status": bool(parsed["status"]), "message": str(parsed["message"])}
            except (json.JSONDecodeError, TypeError):
                pass

    if "status" in execute_response and "message" in execute_response:
        return {"status": bool(execute_response["status"]), "message": str(execute_response["message"])}

    workflow_run = execute_response.get("workflowRun")
    if isinstance(workflow_run, dict):
        for key in ("output", "result"):
            val = workflow_run.get(key)
            if isinstance(val, str):
                try:
                    parsed = json.loads(val)
                    if "status" in parsed and "message" in parsed:
                        return {"status": bool(parsed["status"]), "message": str(parsed["message"])}
                except (json.JSONDecodeError, TypeError):
                    pass

    raise ValueError("Could not find a status/message result in the workflow response")


@router.post("/check-conflict")
async def check_policy_conflict(payload: dict):
    description = payload.get("description")
    if not description:
        raise HTTPException(status_code=400, detail="description is required")

    try:
        execute_response = await execute_workflow(
            CONFLICT_CHECKER_WORKFLOW_ID,
            inputs={"new_policy_description": description},
        )
        return _extract_conflict_result(execute_response)
    except Exception as e:
        log.warning(f"Policy conflict check failed: {e}")
        raise HTTPException(status_code=502, detail=f"Conflict check unavailable: {e}")


@router.get("/")
async def list_policies():
    try:
        response = supabase.table("policies").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{policy_id}")
async def get_policy(policy_id: int):
    try:
        response = (
            supabase.table("policies")
            .select("*")
            .eq("id", policy_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Policy not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_policy(payload: dict, request: Request):
    try:
        # created_by comes from the signed-in approver, not the client payload.
        created_by = request.headers.get("x-approver-email")
        if not created_by:
            raise HTTPException(status_code=403, detail="Sign in with an approver account to create a policy.")

        row = {
            "name": payload.get("name"),
            "details": payload.get("details"),
            "created_by": created_by,
        }
        response = supabase.table("policies").insert(row).execute()
        return response.data[0] if response.data else None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{policy_id}")
async def update_policy(policy_id: int, payload: dict):
    try:
        # created_by/created_at are immutable — only name/details can change.
        row = {k: v for k, v in {"name": payload.get("name"), "details": payload.get("details")}.items() if v is not None}
        response = (
            supabase.table("policies")
            .update(row)
            .eq("id", policy_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Policy not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{policy_id}")
async def delete_policy(policy_id: int):
    try:
        response = (
            supabase.table("policies")
            .delete()
            .eq("id", policy_id)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
