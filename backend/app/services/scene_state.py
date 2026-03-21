from datetime import datetime
from app.models.scene import SceneState, SceneObject, Operation


def inject_object_ids(scene_state: SceneState, tool_name: str, parameters: dict) -> dict:
    """
    Generate and inject server-side object IDs into tool call parameters.
    Returns the modified parameters dict.
    """
    params = dict(parameters)

    if tool_name == "add_primitive":
        params["object_id"] = scene_state.generate_object_id()
    elif tool_name == "clone_object":
        params["new_object_id"] = scene_state.generate_object_id()
    elif tool_name in ("union", "intersect"):
        params["object_id"] = scene_state.generate_object_id()
    elif tool_name == "linear_pattern":
        count = params.get("count", 0)
        params["object_ids"] = [scene_state.generate_object_id() for _ in range(count)]

    return params


def get_consumed_object_ids(tool_name: str, parameters: dict) -> list[str]:
    """Get IDs of objects consumed by boolean operations."""
    consumed = []
    if tool_name == "subtract":
        if "tool_ids" in parameters and parameters["tool_ids"]:
            consumed.extend(parameters["tool_ids"])
        elif "tool_id" in parameters and parameters["tool_id"]:
            consumed.append(parameters["tool_id"])
    elif tool_name in ("union", "intersect"):
        consumed.extend(parameters.get("object_ids", []))
    return consumed


def apply_tool_result(
    scene_state: SceneState,
    tool_name: str,
    parameters: dict,
    status: str,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    """Apply a tool result to update the scene state model."""
    op_id = scene_state.generate_op_id()
    result_object_ids = []

    if status == "success" and result:
        if tool_name == "add_primitive":
            obj_id = parameters.get("object_id", result.get("object_id", ""))
            dims = parameters.get("dimensions", {})
            pos = tuple(parameters.get("position", [0, 0, 0]))
            rot_deg = parameters.get("rotation", [0, 0, 0])
            rot = tuple(r * 3.14159265 / 180 for r in rot_deg) if rot_deg else (0.0, 0.0, 0.0)
            color = parameters.get("color", "#888888")
            bbox = tuple(result.get("bbox", [])) if result.get("bbox") else None

            obj = SceneObject(
                id=obj_id,
                label=parameters.get("label", obj_id),
                type=parameters.get("type", "unknown"),
                params=dims,
                position=pos,
                rotation=rot,
                scale=(1.0, 1.0, 1.0),
                color=color,
                bbox=bbox,
                created_by_op=op_id,
            )
            scene_state.objects[obj_id] = obj
            result_object_ids.append(obj_id)

        elif tool_name == "subtract":
            target_id = parameters.get("target_id", "")
            tool_ids = parameters.get("tool_ids", [])
            if not tool_ids and parameters.get("tool_id"):
                tool_ids = [parameters["tool_id"]]

            # Remove tool objects
            for tid in tool_ids:
                scene_state.objects.pop(tid, None)

            # Update target
            if target_id in scene_state.objects:
                scene_state.objects[target_id].type = "compound"
                if result.get("bbox"):
                    scene_state.objects[target_id].bbox = tuple(result["bbox"])
            result_object_ids.append(target_id)

        elif tool_name in ("union", "intersect"):
            input_ids = parameters.get("object_ids", [])
            new_id = parameters.get("object_id", result.get("object_id", ""))

            # Gather info from first input for defaults
            first_obj = scene_state.objects.get(input_ids[0]) if input_ids else None

            # Remove all input objects
            for iid in input_ids:
                scene_state.objects.pop(iid, None)

            bbox = tuple(result.get("bbox", [])) if result.get("bbox") else None
            obj = SceneObject(
                id=new_id,
                label=parameters.get("label", new_id),
                type="compound",
                params={},
                position=(0.0, 0.0, 0.0),
                scale=(1.0, 1.0, 1.0),
                color=first_obj.color if first_obj else "#888888",
                bbox=bbox,
                created_by_op=op_id,
            )
            scene_state.objects[new_id] = obj
            result_object_ids.append(new_id)

        elif tool_name == "clone_object":
            source_id = parameters.get("object_id", "")
            new_id = parameters.get("new_object_id", "")
            source = scene_state.objects.get(source_id)

            if source:
                obj = SceneObject(
                    id=new_id,
                    label=parameters.get("label", new_id),
                    type=source.type,
                    params=dict(source.params),
                    position=tuple(parameters.get("position", [0, 0, 0])),
                    rotation=source.rotation,
                    scale=source.scale,
                    color=source.color,
                    bbox=tuple(result.get("bbox", [])) if result.get("bbox") else None,
                    created_by_op=op_id,
                )
                scene_state.objects[new_id] = obj
                result_object_ids.append(new_id)

        elif tool_name == "linear_pattern":
            source_id = parameters.get("object_id", "")
            source = scene_state.objects.get(source_id)
            object_ids = result.get("object_ids", parameters.get("object_ids", []))
            direction = parameters.get("direction", [0, 0, 0])
            spacing = parameters.get("spacing", 0)
            label_prefix = parameters.get("label_prefix", "copy")

            if source:
                source_pos = list(source.position)
                for i, oid in enumerate(object_ids):
                    pos = tuple(
                        source_pos[j] + direction[j] * spacing * (i + 1)
                        for j in range(3)
                    )
                    obj = SceneObject(
                        id=oid,
                        label=f"{label_prefix}_{i + 1}",
                        type=source.type,
                        params=dict(source.params),
                        position=pos,
                        rotation=source.rotation,
                        scale=source.scale,
                        color=source.color,
                        created_by_op=op_id,
                    )
                    scene_state.objects[oid] = obj
                    result_object_ids.append(oid)

        elif tool_name == "move_object":
            obj_id = parameters.get("object_id", "")
            if obj_id in scene_state.objects:
                if parameters.get("position"):
                    scene_state.objects[obj_id].position = tuple(parameters["position"])
                elif parameters.get("delta"):
                    old_pos = scene_state.objects[obj_id].position
                    delta = parameters["delta"]
                    scene_state.objects[obj_id].position = tuple(
                        old_pos[i] + delta[i] for i in range(3)
                    )
                if result.get("bbox"):
                    scene_state.objects[obj_id].bbox = tuple(result["bbox"])
            result_object_ids.append(obj_id)

        elif tool_name == "rotate_object":
            obj_id = parameters.get("object_id", "")
            if obj_id in scene_state.objects:
                axis = parameters.get("axis", "y")
                angle_rad = parameters.get("angle_degrees", 0) * 3.14159265 / 180
                old_rot = list(scene_state.objects[obj_id].rotation)
                idx = {"x": 0, "y": 1, "z": 2}.get(axis, 1)
                old_rot[idx] += angle_rad
                scene_state.objects[obj_id].rotation = tuple(old_rot)
            result_object_ids.append(obj_id)

        elif tool_name == "scale_object":
            obj_id = parameters.get("object_id", "")
            if obj_id in scene_state.objects:
                if parameters.get("factor"):
                    f = parameters["factor"]
                    old_scale = scene_state.objects[obj_id].scale
                    scene_state.objects[obj_id].scale = tuple(s * f for s in old_scale)
                elif parameters.get("axis_factors"):
                    af = parameters["axis_factors"]
                    old_scale = scene_state.objects[obj_id].scale
                    scene_state.objects[obj_id].scale = tuple(
                        old_scale[i] * af[i] for i in range(3)
                    )
                if result.get("bbox"):
                    scene_state.objects[obj_id].bbox = tuple(result["bbox"])
            result_object_ids.append(obj_id)

        elif tool_name == "set_color":
            obj_id = parameters.get("object_id", "")
            if obj_id in scene_state.objects:
                scene_state.objects[obj_id].color = parameters.get("color", "#888888")
            result_object_ids.append(obj_id)

        elif tool_name == "rename_object":
            obj_id = parameters.get("object_id", "")
            if obj_id in scene_state.objects:
                scene_state.objects[obj_id].label = parameters.get("label", "")
            result_object_ids.append(obj_id)

        elif tool_name == "delete_object":
            obj_id = parameters.get("object_id", result.get("object_id", ""))
            scene_state.objects.pop(obj_id, None)
            result_object_ids.append(obj_id)

    # Record operation
    op = Operation(
        op_id=op_id,
        action=tool_name,
        params=parameters,
        status=status,
        result_object_ids=result_object_ids,
        error=error,
        timestamp=datetime.now(),
    )
    scene_state.operation_history.append(op)
