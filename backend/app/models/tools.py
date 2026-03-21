from pydantic import BaseModel
from typing import Optional


class ToolResultPayload(BaseModel):
    op_id: str
    status: str  # "success" | "failure"
    result: Optional[dict] = None
    error: Optional[str] = None


# CAD tools that are executed on the frontend
CAD_TOOLS = {
    "add_primitive", "subtract", "union", "intersect",
    "move_object", "rotate_object", "scale_object",
    "delete_object", "clone_object", "linear_pattern",
}

# Tools resolved internally on the backend
INTERNAL_TOOLS = {
    "get_constraints_summary", "get_constraints_by_category",
    "get_constraint_detail", "search_constraints",
    "get_scene_state", "get_object_details", "design_review",
    "set_color", "rename_object",
}
