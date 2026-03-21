from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models.tools import ToolResultPayload
from app.routers.session import get_session

router = APIRouter(tags=["tools"])


@router.post("/session/{session_id}/tool-result", status_code=202)
async def post_tool_result(session_id: str, payload: ToolResultPayload):
    session = get_session(session_id)

    op_id = payload.op_id

    # Check if this op_id has a pending event
    event = session.pending_tool_results.get(op_id)
    if not event:
        # Unknown or late op_id
        raise HTTPException(status_code=410, detail=f"No pending operation for op_id {op_id}")

    # First-write-wins: if already set, ignore
    if event.is_set():
        return JSONResponse(status_code=202, content={"status": "already_received"})

    # Store result data
    session.tool_result_data[op_id] = {
        "status": payload.status,
        "result": payload.result,
        "error": payload.error,
    }

    # Signal the event
    event.set()

    return JSONResponse(status_code=202, content={"status": "accepted"})
