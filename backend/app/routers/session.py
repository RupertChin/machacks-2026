from fastapi import APIRouter

router = APIRouter(prefix="/session", tags=["session"])


@router.post("")
async def create_session():
    return {"session_id": "placeholder"}


@router.get("/{session_id}/state")
async def get_session_state(session_id: str):
    return {"session_id": session_id, "state": {}}
