# app/routers/insights.py
import json
import logging

from fastapi import APIRouter, HTTPException

from app.services.supervity import execute_workflow

log = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["Insights"])

# The "Insights for Invoices" operator on Supervity: scans the 'invoices' table
# in Supabase and generates up to 5 structured insights via AI. Takes no inputs;
# its Supabase credentials are baked into the workflow definition on Supervity.
INSIGHTS_WORKFLOW_ID = "019fd81f-d403-7000-9889-ea9235e8454a"


def _extract_insights(execute_response: dict) -> list[dict]:
    """Pull the insights list out of a blocking /workflow-runs/execute response.

    Verified live shape:
    {"success": true, "workflowRun": {"activityRuns": [{"stepId": "generate_insights",
      "outputs": {"output": "{\"insights\": [{\"type\": \"critical\"|\"warning\",
      \"details\": str, \"recommendation\": str}, ...]}"}}]}}
    """
    activity_runs = (execute_response.get("workflowRun") or {}).get("activityRuns") or []
    if not activity_runs:
        raise ValueError("No activity runs in workflow response")

    output_str = (activity_runs[-1].get("outputs") or {}).get("output")
    if not output_str:
        raise ValueError("No output on the final activity run")

    parsed = json.loads(output_str)
    insights = parsed.get("insights")
    if not isinstance(insights, list):
        raise ValueError("Response did not contain an 'insights' list")
    return insights


@router.post("/generate")
async def generate_insights():
    """Run the Insights for Invoices workflow and return its findings.

    Blocking — the workflow queries Supabase and runs an LLM pass, typically
    takes 20-40s.
    """
    try:
        execute_response = await execute_workflow(INSIGHTS_WORKFLOW_ID)
        return {"insights": _extract_insights(execute_response)}
    except Exception as e:
        log.warning(f"Insights generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Insights generation unavailable: {e}")
