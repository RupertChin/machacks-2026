import json
import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.models.session import sessions
from app.models.events import transcript_event, error_event, done_event
from app.services.agent import AgentService
from app.services.whisper import transcribe
from app.routers.session import get_session

router = APIRouter(tags=["voice"])

agent_service = AgentService()


class ChatRequest(BaseModel):
    message: str
    scene_object_ids: list[str] = []


@router.post("/session/{session_id}/voice")
async def voice_command(
    session_id: str,
    audio: UploadFile = File(...),
    scene_object_ids: str = Form("[]"),
):
    session = get_session(session_id)

    if session.turn_lock.locked():
        raise HTTPException(status_code=409, detail="An agent turn is already in progress")

    try:
        object_ids = json.loads(scene_object_ids)
    except json.JSONDecodeError:
        object_ids = []

    audio_bytes = await audio.read()
    filename = audio.filename or "audio.webm"

    async def event_generator():
        await session.turn_lock.acquire()
        event_queue = asyncio.Queue()

        try:
            transcript = await transcribe(audio_bytes, filename)
            await event_queue.put(transcript_event(transcript))

            # Yield transcript event
            while not event_queue.empty():
                evt = await event_queue.get()
                yield evt

            agent_task = asyncio.create_task(
                agent_service.run_agent_turn(session, transcript, event_queue, object_ids)
            )

            while True:
                try:
                    evt = await asyncio.wait_for(event_queue.get(), timeout=30.0)
                    yield evt
                    if hasattr(evt, 'event') and evt.event == "done":
                        break
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    yield error_event(str(e))
                    yield done_event()
                    break

            if not agent_task.done():
                await agent_task

        except Exception as e:
            yield error_event(f"Voice processing failed: {str(e)}", recoverable=True)
            yield done_event()
        finally:
            session.turn_lock.release()

    return EventSourceResponse(event_generator(), ping=15)


@router.post("/session/{session_id}/chat")
async def chat_command(session_id: str, body: ChatRequest):
    session = get_session(session_id)

    if session.turn_lock.locked():
        raise HTTPException(status_code=409, detail="An agent turn is already in progress")

    async def event_generator():
        await session.turn_lock.acquire()
        event_queue = asyncio.Queue()

        try:
            agent_task = asyncio.create_task(
                agent_service.run_agent_turn(
                    session, body.message, event_queue, body.scene_object_ids
                )
            )

            while True:
                try:
                    evt = await asyncio.wait_for(event_queue.get(), timeout=30.0)
                    yield evt
                    if hasattr(evt, 'event') and evt.event == "done":
                        break
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    yield error_event(str(e))
                    yield done_event()
                    break

            if not agent_task.done():
                await agent_task

        except Exception as e:
            yield error_event(f"Chat processing failed: {str(e)}", recoverable=True)
            yield done_event()
        finally:
            session.turn_lock.release()

    return EventSourceResponse(event_generator(), ping=15)
