import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException

from app.models.session import Session, sessions

router = APIRouter(prefix="/session", tags=["session"])


def get_session(session_id: str) -> Session:
    """Helper to get session or raise 404."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return session


@router.post("")
async def create_session():
    session_id = str(uuid.uuid4())
    session = Session(session_id=session_id)
    sessions[session_id] = session
    return {
        "session_id": session_id,
        "created_at": session.created_at.isoformat(),
    }


@router.get("/{session_id}/state")
async def get_session_state(session_id: str):
    session = get_session(session_id)

    scene_context = session.scene_state.to_claude_context()

    spec_info = None
    if session.spec_metadata:
        spec_info = {
            "filename": session.spec_metadata.filename,
            "constraint_count": len(session.constraint_store.constraints),
            "constraints": [c.model_dump() for c in session.constraint_store.constraints.values()],
        }

    return {
        "scene": scene_context,
        "spec": spec_info,
        "conversation_history_length": len(session.conversation_history),
    }
