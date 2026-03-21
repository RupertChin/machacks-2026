from fastapi import APIRouter

router = APIRouter(tags=["tools"])


@router.post("/session/{session_id}/tool-result")
async def post_tool_result(session_id: str):
    return {"status": "not_implemented"}
