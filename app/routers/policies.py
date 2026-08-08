# app/routers/policies.py
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from app.core.supabase import supabase, SUPABASE_URL, SUPABASE_KEY, SUPABASE_USERNAME, SUPABASE_PASSWORD
from app.services.supervity import execute_workflow

log = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["Policies"])

# Every policy must declare which orchestrator it applies to. There's no
# separate DB column for this — it's encoded as a "{category} - " prefix on
# the `name` column (see _build_name/create_policy/update_policy). Keep this
# list in sync with frontend/src/components/ai/policies/policyCategories.ts.
POLICY_CATEGORIES = ["Email Scanner", "Automatic Validator", "Manual Validator"]

# The "Policy Conflict Checker" operator on Supervity: fetches existing policies
# from Supabase and uses an LLM to decide whether a proposed policy conflicts
# with any of them. Outputs {"status": bool, "message": str} — status=true means
# a conflict was found.
CONFLICT_CHECKER_WORKFLOW_ID = "019fd7fe-adc0-7000-b551-064dec108f7b"

# Passed as runtime `envs` on execute so the workflow's Supabase step
# authenticates with this app's credentials rather than whatever was baked
# into the workflow definition on Supervity at creation time. Names on the
# right are what the workflow's fetch_policies step reads via os.environ.get().
CONFLICT_CHECKER_ENVS = {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_ANON_KEY": SUPABASE_KEY,
    "SUPABASE_EMAIL": SUPABASE_USERNAME,
    "SUPABASE_PASSWORD": SUPABASE_PASSWORD,
}


def _extract_conflict_result(execute_response: dict) -> dict:
    """Parse {"status": bool, "message": str} out of a blocking /workflow-runs/execute
    response. The real shape (verified live) is:
    {"success": true, "workflowRun": {"activityRuns": [{"outputs": {"output": "<json str>"}}]}}
    — the last activity run's stdout is the evaluate_conflict step's JSON print.
    Falls back to a few other plausible spots in case the shape drifts."""
    workflow_run = execute_response.get("workflowRun")
    activity_runs = (workflow_run or {}).get("activityRuns") or execute_response.get("activityRuns")
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
            envs=CONFLICT_CHECKER_ENVS,
        )
        return _extract_conflict_result(execute_response)
    except Exception as e:
        log.warning(f"Policy conflict check failed: {e}")
        raise HTTPException(status_code=502, detail=f"Conflict check unavailable: {e}")


def _build_name(category: str | None, name: str | None) -> str:
    if category not in POLICY_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of: {', '.join(POLICY_CATEGORIES)}",
        )
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    return f"{category} - {name.strip()}"


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
            "name": _build_name(payload.get("category"), payload.get("name")),
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
        # created_by/created_at are immutable. category+name are combined into
        # the stored `name`, so they're only touched together.
        row: dict = {}
        if payload.get("details") is not None:
            row["details"] = payload["details"]
        if payload.get("category") is not None or payload.get("name") is not None:
            row["name"] = _build_name(payload.get("category"), payload.get("name"))

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
