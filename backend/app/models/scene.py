from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SceneObject(BaseModel):
    id: str
    label: str
    type: str  # cuboid, cylinder, sphere, torus, compound
    params: dict
    position: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0)
    color: str = "#888888"
    bbox: Optional[tuple[float, ...]] = None
    created_by_op: str = ""


class Operation(BaseModel):
    op_id: str
    action: str
    params: dict
    status: str = "pending"  # pending, success, failure
    result_object_ids: list[str] = []
    error: Optional[str] = None
    timestamp: datetime = datetime.now()


class SceneState:
    def __init__(self):
        self.objects: dict[str, SceneObject] = {}
        self.operation_history: list[Operation] = []
        self.next_object_id: int = 1
        self.next_op_id: int = 1

    def generate_object_id(self) -> str:
        oid = f"obj_{self.next_object_id}"
        self.next_object_id += 1
        return oid

    def generate_op_id(self) -> str:
        oid = f"op_{self.next_op_id}"
        self.next_op_id += 1
        return oid

    def to_claude_context(self, max_recent_ops: int = 10) -> dict:
        objects_list = []
        for obj in self.objects.values():
            obj_dict = obj.model_dump()
            # Convert tuples to lists for JSON
            obj_dict["position"] = list(obj_dict["position"])
            obj_dict["rotation"] = list(obj_dict["rotation"])
            obj_dict["scale"] = list(obj_dict["scale"])
            if obj_dict["bbox"]:
                obj_dict["bbox"] = list(obj_dict["bbox"])
            objects_list.append(obj_dict)

        recent_ops = self.operation_history[-max_recent_ops:]
        recent_ops_list = []
        for op in recent_ops:
            recent_ops_list.append({
                "op_id": op.op_id,
                "action": op.action,
                "params": op.params,
                "status": op.status,
            })

        result = {
            "objects": objects_list,
            "recent_operations": recent_ops_list,
            "total_operations": len(self.operation_history),
        }
        return result

    def reconcile(self, frontend_object_ids: list[str]):
        """Remove objects that are not in the frontend manifest."""
        stale = [oid for oid in self.objects if oid not in frontend_object_ids]
        for oid in stale:
            del self.objects[oid]
