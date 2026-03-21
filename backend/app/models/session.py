import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.scene import SceneState
from app.services.constraint_store import ConstraintStore


class SpecMetadata(BaseModel):
    spec_id: str
    filename: str
    page_count: int
    uploaded_at: datetime = datetime.now()


@dataclass
class Session:
    session_id: str
    created_at: datetime = field(default_factory=datetime.now)
    scene_state: SceneState = field(default_factory=SceneState)
    constraint_store: ConstraintStore = field(default_factory=ConstraintStore)
    conversation_history: list[dict] = field(default_factory=list)
    pending_tool_results: dict[str, asyncio.Event] = field(default_factory=dict)
    tool_result_data: dict[str, dict] = field(default_factory=dict)
    op_id_to_tool_use_id: dict[str, str] = field(default_factory=dict)
    spec_metadata: Optional[SpecMetadata] = None
    turn_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


sessions: dict[str, Session] = {}
