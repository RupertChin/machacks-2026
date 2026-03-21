from fastapi import APIRouter

router = APIRouter(tags=["spec"])


@router.post("/session/{session_id}/upload-spec")
async def upload_spec(session_id: str):
    return {"status": "not_implemented"}


@router.delete("/session/{session_id}/spec")
async def delete_spec(session_id: str):
    return {"status": "not_implemented"}


@router.patch("/session/{session_id}/constraints/{constraint_id}")
async def update_constraint(session_id: str, constraint_id: str):
    return {"status": "not_implemented"}
