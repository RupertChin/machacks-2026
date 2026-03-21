import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.models.events import (
    upload_progress_event, upload_error_event, upload_complete_event,
)
from app.models.session import SpecMetadata
from app.routers.session import get_session
from app.services.extraction import extract_constraints_from_pdf

router = APIRouter(tags=["spec"])


class ConstraintToggle(BaseModel):
    active: bool


@router.post("/session/{session_id}/upload-spec")
async def upload_spec(session_id: str, file: UploadFile = File(...)):
    session = get_session(session_id)

    pdf_bytes = await file.read()
    filename = file.filename or "spec.pdf"
    spec_id = str(uuid.uuid4())

    async def event_generator():
        try:
            # Clear existing constraints
            session.constraint_store.clear()

            yield upload_progress_event("parsing")

            constraints, page_count, summary = await extract_constraints_from_pdf(
                pdf_bytes, filename, spec_id, session.constraint_store,
                progress_callback=lambda stage, page=None, total=None: None,
            )

            # Store spec metadata
            session.spec_metadata = SpecMetadata(
                spec_id=spec_id,
                filename=filename,
                page_count=page_count,
            )
            session.constraint_store.spec_metadata = {
                "spec_id": spec_id,
                "filename": filename,
                "page_count": page_count,
            }

            yield upload_complete_event(
                spec_id=spec_id,
                filename=filename,
                page_count=page_count,
                constraints=list(session.constraint_store.constraints.values()),
                extraction_summary=summary,
            )

        except Exception as e:
            yield upload_error_event(str(e), "parsing", recoverable=False)

    return EventSourceResponse(event_generator(), ping=15)


@router.delete("/session/{session_id}/spec", status_code=204)
async def delete_spec(session_id: str):
    session = get_session(session_id)
    session.constraint_store.clear()
    session.spec_metadata = None
    return None


@router.patch("/session/{session_id}/constraints/{constraint_id}")
async def update_constraint(session_id: str, constraint_id: str, body: ConstraintToggle):
    session = get_session(session_id)

    try:
        constraint = session.constraint_store.set_active(constraint_id, body.active)
        return constraint.model_dump()
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Constraint {constraint_id} not found")
