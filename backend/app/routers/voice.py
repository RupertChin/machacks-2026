from fastapi import APIRouter

router = APIRouter(tags=["voice"])


@router.post("/session/{session_id}/voice")
async def voice_command(session_id: str):
    return {"status": "not_implemented"}


@router.post("/session/{session_id}/chat")
async def chat_command(session_id: str):
    return {"status": "not_implemented"}
