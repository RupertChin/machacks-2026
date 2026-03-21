import json
import asyncio
from datetime import datetime
from typing import AsyncGenerator, Any, Optional

import anthropic

from app.config import settings
from app.models.events import (
    agent_text_event, tool_call_event, tool_result_internal_event,
    error_event, done_event,
)
from app.models.tools import CAD_TOOLS, INTERNAL_TOOLS
from app.services.scene_state import inject_object_ids, apply_tool_result, get_consumed_object_ids
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.review_prompt import REVIEW_PROMPT_TEMPLATE


# Tool definitions for Claude
TOOL_DEFINITIONS = [
    {
        "name": "add_primitive",
        "description": "Add a 3D primitive shape to the scene",
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["cuboid", "cylinder", "sphere", "torus"]},
                "dimensions": {"type": "object", "description": "Shape-specific dimensions in mm. Cuboid: {\"width\": x, \"height\": y, \"depth\": z}. Cylinder: {\"radius\": r, \"height\": h}. Sphere: {\"radius\": r}. Torus: {\"innerRadius\": r1, \"outerRadius\": r2}."},
                "position": {"type": "array", "items": {"type": "number"}, "description": "[x, y, z] center position in mm"},
                "rotation": {"type": "array", "items": {"type": "number"}, "description": "[rx, ry, rz] rotation in degrees. Optional, defaults to [0,0,0]"},
                "color": {"type": "string", "description": "Hex color string. Optional, auto-assigned if omitted"},
                "label": {"type": "string", "description": "Human-readable name for this object"}
            },
            "required": ["type", "dimensions", "position", "label"]
        }
    },
    {
        "name": "subtract",
        "description": "Boolean subtract: remove the tool shape(s) from the target shape. Tool objects are consumed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_id": {"type": "string", "description": "ID of the object to cut from"},
                "tool_id": {"type": "string", "description": "ID of a single object to use as the cutting tool"},
                "tool_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs of multiple objects to subtract at once. Use this OR tool_id, not both."}
            },
            "required": ["target_id"]
        }
    },
    {
        "name": "union",
        "description": "Boolean union: merge multiple objects into one.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs of objects to merge"},
                "label": {"type": "string", "description": "Label for the resulting merged object"}
            },
            "required": ["object_ids", "label"]
        }
    },
    {
        "name": "intersect",
        "description": "Boolean intersect: keep only the overlapping volume of multiple objects.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs of objects to intersect"},
                "label": {"type": "string", "description": "Label for the resulting object"}
            },
            "required": ["object_ids", "label"]
        }
    },
    {
        "name": "move_object",
        "description": "Move an object to a new position or by a relative offset. Must provide exactly one of 'position' or 'delta'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"},
                "position": {"type": "array", "items": {"type": "number"}, "description": "Absolute [x,y,z] position"},
                "delta": {"type": "array", "items": {"type": "number"}, "description": "Relative [dx,dy,dz] movement"}
            },
            "required": ["object_id"]
        }
    },
    {
        "name": "rotate_object",
        "description": "Rotate an object around an axis.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"},
                "axis": {"type": "string", "enum": ["x", "y", "z"]},
                "angle_degrees": {"type": "number"}
            },
            "required": ["object_id", "axis", "angle_degrees"]
        }
    },
    {
        "name": "scale_object",
        "description": "Scale an object uniformly or per-axis. Must provide exactly one of 'factor' or 'axis_factors'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"},
                "factor": {"type": "number", "description": "Uniform scale factor"},
                "axis_factors": {"type": "array", "items": {"type": "number"}, "description": "[sx, sy, sz] per-axis scale factors"}
            },
            "required": ["object_id"]
        }
    },
    {
        "name": "delete_object",
        "description": "Remove an object from the scene.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"}
            },
            "required": ["object_id"]
        }
    },
    {
        "name": "set_color",
        "description": "Change an object's display color.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"},
                "color": {"type": "string", "description": "Hex color (e.g., '#FF5500')"}
            },
            "required": ["object_id", "color"]
        }
    },
    {
        "name": "rename_object",
        "description": "Change an object's label.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string"},
                "label": {"type": "string"}
            },
            "required": ["object_id", "label"]
        }
    },
    {
        "name": "clone_object",
        "description": "Create a copy of an existing object at a new position.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string", "description": "ID of the source object to clone"},
                "position": {"type": "array", "items": {"type": "number"}, "description": "[x, y, z] position for the clone"},
                "label": {"type": "string", "description": "Label for the cloned object"}
            },
            "required": ["object_id", "position", "label"]
        }
    },
    {
        "name": "linear_pattern",
        "description": "Create N copies of an object along an axis with equal spacing. Source is preserved.",
        "input_schema": {
            "type": "object",
            "properties": {
                "object_id": {"type": "string", "description": "ID of the source object"},
                "direction": {"type": "array", "items": {"type": "number"}, "description": "[dx, dy, dz] direction vector"},
                "count": {"type": "integer", "description": "Number of copies"},
                "spacing": {"type": "number", "description": "Distance between copies in mm"},
                "label_prefix": {"type": "string", "description": "Prefix for copy labels"}
            },
            "required": ["object_id", "direction", "count", "spacing", "label_prefix"]
        }
    },
    {
        "name": "get_constraints_summary",
        "description": "Get an overview of all loaded constraints.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "get_constraints_by_category",
        "description": "Get all constraints in a specific category.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "enum": ["dimensional", "mounting", "clearance", "interface", "material", "electrical", "thermal", "other"]}
            },
            "required": ["category"]
        }
    },
    {
        "name": "get_constraint_detail",
        "description": "Get full details of a specific constraint.",
        "input_schema": {
            "type": "object",
            "properties": {"constraint_id": {"type": "string"}},
            "required": ["constraint_id"]
        }
    },
    {
        "name": "search_constraints",
        "description": "Search constraints by keyword.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Search query"}},
            "required": ["query"]
        }
    },
    {
        "name": "get_scene_state",
        "description": "Get the full current scene state.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "get_object_details",
        "description": "Get detailed information about a specific object.",
        "input_schema": {
            "type": "object",
            "properties": {"object_id": {"type": "string"}},
            "required": ["object_id"]
        }
    },
    {
        "name": "design_review",
        "description": "Audit the current design against all active constraints.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
]


_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


class AgentService:
    def __init__(self):
        self.client = _get_client()

    async def run_agent_turn(
        self,
        session,  # Session dataclass
        user_message: str,
        event_queue: asyncio.Queue,
        scene_object_ids: list[str],
    ) -> None:
        """Run a complete agent turn: stream Claude, dispatch tools, loop until done."""
        # Reconcile scene state
        session.scene_state.reconcile(scene_object_ids)

        # Build messages
        messages = self._build_messages(session, user_message)

        max_tokens_continues = 0

        while True:
            # Stream Claude response
            assistant_message, stop_reason = await self._stream_claude_response(
                messages, event_queue
            )

            # Append assistant message to history
            session.conversation_history.append(assistant_message)

            if stop_reason == "end_turn":
                await event_queue.put(done_event())
                break

            elif stop_reason == "max_tokens":
                max_tokens_continues += 1
                if max_tokens_continues > 2:
                    await event_queue.put(error_event("Agent response too long, stopping.", recoverable=True))
                    await event_queue.put(done_event())
                    break
                # Auto-continue
                messages.append(assistant_message)
                messages.append({"role": "user", "content": "Please continue."})
                continue

            elif stop_reason == "tool_use":
                # Collect all tool_use blocks
                tool_uses = [
                    block for block in assistant_message["content"]
                    if isinstance(block, dict) and block.get("type") == "tool_use"
                ]

                tool_results = []

                for tool_use in tool_uses:
                    tool_name = tool_use["name"]
                    tool_input = tool_use["input"]
                    tool_use_id = tool_use["id"]

                    if tool_name in CAD_TOOLS:
                        # Inject object IDs
                        params = inject_object_ids(session.scene_state, tool_name, tool_input)

                        # Generate op_id
                        op_id = session.scene_state.generate_op_id()
                        session.op_id_to_tool_use_id[op_id] = tool_use_id

                        # Add consumed_object_ids for frontend cleanup
                        consumed = get_consumed_object_ids(tool_name, params)
                        if consumed:
                            params["consumed_object_ids"] = consumed

                        # Create asyncio.Event BEFORE yielding tool_call event
                        event = asyncio.Event()
                        session.pending_tool_results[op_id] = event

                        # Send tool_call event to frontend
                        await event_queue.put(tool_call_event(op_id, tool_name, params))

                        # Wait for frontend tool result (15s timeout)
                        try:
                            await asyncio.wait_for(event.wait(), timeout=15.0)
                            result_data = session.tool_result_data.pop(op_id, {})

                            # Apply to scene state
                            apply_tool_result(
                                session.scene_state,
                                tool_name,
                                params,
                                result_data.get("status", "failure"),
                                result_data.get("result"),
                                result_data.get("error"),
                            )

                            if result_data.get("status") == "success":
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": tool_use_id,
                                    "content": json.dumps(result_data.get("result", {})),
                                })
                            else:
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": tool_use_id,
                                    "is_error": True,
                                    "content": result_data.get("error", "Tool execution failed"),
                                })

                        except asyncio.TimeoutError:
                            session.pending_tool_results.pop(op_id, None)
                            apply_tool_result(
                                session.scene_state, tool_name, params,
                                "failure", error="Timeout waiting for frontend result"
                            )
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": tool_use_id,
                                "is_error": True,
                                "content": "Timeout: frontend did not report result within 15 seconds",
                            })

                    elif tool_name in INTERNAL_TOOLS:
                        # Resolve internally (async to support design_review)
                        result = await self._resolve_internal_tool(session, tool_name, tool_input)

                        op_id = session.scene_state.generate_op_id()

                        await event_queue.put(
                            tool_result_internal_event(op_id, tool_name, tool_input, result)
                        )

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_use_id,
                            "content": json.dumps(result) if isinstance(result, (dict, list)) else str(result),
                        })
                    else:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_use_id,
                            "is_error": True,
                            "content": f"Unknown tool: {tool_name}",
                        })

                # Cleanup pending events
                for tool_use in tool_uses:
                    for op_id in list(session.pending_tool_results.keys()):
                        if session.pending_tool_results[op_id].is_set():
                            session.pending_tool_results.pop(op_id, None)

                # Feed all tool results back to Claude in a single user message
                user_result_message = {"role": "user", "content": tool_results}
                session.conversation_history.append(user_result_message)
                messages.append(assistant_message)
                messages.append(user_result_message)

            else:
                # Unknown stop reason
                await event_queue.put(error_event(f"Unexpected stop reason: {stop_reason}"))
                await event_queue.put(done_event())
                break

    async def _stream_claude_response(
        self,
        messages: list[dict],
        event_queue: asyncio.Queue,
    ) -> tuple[dict, str]:
        """Stream a Claude response, forwarding text events. Returns (assistant_message, stop_reason)."""
        content_blocks: list[dict] = []
        current_text = ""
        current_tool_input_json = ""
        current_block_type = None
        current_block_index = -1
        stop_reason = "end_turn"

        async with self.client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=16384,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOL_DEFINITIONS,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_start":
                    current_block_index = event.index
                    block = event.content_block
                    if block.type == "text":
                        current_block_type = "text"
                        current_text = block.text or ""
                    elif block.type == "tool_use":
                        current_block_type = "tool_use"
                        current_tool_input_json = ""
                        content_blocks.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": {},
                        })

                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        text = event.delta.text
                        current_text += text
                        await event_queue.put(agent_text_event(text, done=False))
                    elif hasattr(event.delta, "partial_json"):
                        current_tool_input_json += event.delta.partial_json

                elif event.type == "content_block_stop":
                    if current_block_type == "text":
                        await event_queue.put(agent_text_event("", done=True))
                        content_blocks.append({
                            "type": "text",
                            "text": current_text,
                        })
                        current_text = ""
                    elif current_block_type == "tool_use":
                        # Parse accumulated JSON
                        try:
                            parsed_input = json.loads(current_tool_input_json) if current_tool_input_json else {}
                        except json.JSONDecodeError:
                            parsed_input = {}
                        # Update the last tool_use block
                        for block in reversed(content_blocks):
                            if block["type"] == "tool_use":
                                block["input"] = parsed_input
                                break
                        current_tool_input_json = ""
                    current_block_type = None

                elif event.type == "message_stop":
                    pass

            # Get final message info
            final_message = await stream.get_final_message()
            stop_reason = final_message.stop_reason or "end_turn"

        assistant_message = {
            "role": "assistant",
            "content": content_blocks,
        }

        return assistant_message, stop_reason

    async def _resolve_internal_tool(self, session, tool_name: str, tool_input: dict) -> Any:
        """Resolve backend-only tools."""
        store = session.constraint_store
        scene = session.scene_state

        if tool_name == "get_constraints_summary":
            return store.get_summary()

        elif tool_name == "get_constraints_by_category":
            category = tool_input.get("category", "")
            constraints = store.get_by_category(category)
            return {
                "category": category,
                "constraints": [c.model_dump() for c in constraints],
            }

        elif tool_name == "get_constraint_detail":
            cid = tool_input.get("constraint_id", "")
            c = store.get_detail(cid)
            if c:
                return c.model_dump()
            return {"error": f"Constraint {cid} not found"}

        elif tool_name == "search_constraints":
            query = tool_input.get("query", "")
            results = store.search(query)
            return {
                "query": query,
                "results": [
                    {"id": c.id, "category": c.category, "description": c.description,
                     "type": c.type, "value": c.value, "unit": c.unit}
                    for c in results
                ],
            }

        elif tool_name == "get_scene_state":
            ctx = scene.to_claude_context(max_recent_ops=len(scene.operation_history))
            return ctx

        elif tool_name == "get_object_details":
            obj_id = tool_input.get("object_id", "")
            obj = scene.objects.get(obj_id)
            if obj:
                d = obj.model_dump()
                d["position"] = list(d["position"])
                d["rotation"] = list(d["rotation"])
                d["scale"] = list(d["scale"])
                if d["bbox"]:
                    d["bbox"] = list(d["bbox"])
                return d
            return {"error": f"Object {obj_id} not found"}

        elif tool_name == "design_review":
            return await self._run_design_review(session)

        return {"error": f"Unknown internal tool: {tool_name}"}

    async def _run_design_review(self, session) -> dict:
        """Run a separate Claude call for design review."""
        scene_json = json.dumps(session.scene_state.to_claude_context(), indent=2)
        active_constraints = session.constraint_store.get_active()
        constraints_json = json.dumps(
            [c.model_dump() for c in active_constraints], indent=2
        )

        if not active_constraints:
            return {"review": "No active constraints loaded. Upload a spec sheet to enable constraint-aware design review."}

        prompt = REVIEW_PROMPT_TEMPLATE.format(
            scene_state_json=scene_json,
            constraints_json=constraints_json,
        )

        try:
            response = await asyncio.wait_for(
                self.client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=4096,
                    temperature=0,
                    messages=[{"role": "user", "content": prompt}],
                ),
                timeout=30.0,
            )
            review_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    review_text += block.text
            return {"review": review_text}
        except Exception as e:
            return {"review": f"Design review failed: {str(e)}"}

    def _build_messages(self, session, user_message: str) -> list[dict]:
        """Build the messages list for Claude, including scene state context."""
        # Trim history if needed
        self._trim_history(session)

        # Build current scene state context
        scene_context = session.scene_state.to_claude_context()

        # Add spec info if loaded
        if session.constraint_store.spec_metadata:
            active_count = len(session.constraint_store.get_active())
            total_count = len(session.constraint_store.constraints)
            scene_context["active_spec"] = (
                f"{session.constraint_store.spec_metadata.get('filename', 'spec')} "
                f"({active_count}/{total_count} constraints active)"
            )

        # Format user message with scene context
        formatted_content = f"[Current Scene State]\n{json.dumps(scene_context, indent=2)}\n\n[User Message]\n{user_message}"

        user_msg = {"role": "user", "content": formatted_content}
        session.conversation_history.append(user_msg)

        return list(session.conversation_history)

    def _trim_history(self, session) -> None:
        """Trim conversation history to 40 entries at turn boundaries."""
        history = session.conversation_history
        if len(history) <= 40:
            return

        # Find a safe trim point
        trim_to = len(history) - 40

        # Ensure we don't split tool_use/tool_result pairs
        while trim_to < len(history) - 1:
            msg = history[trim_to]
            if isinstance(msg.get("content"), list):
                # Check if it's a tool result message
                has_tool_result = any(
                    isinstance(block, dict) and block.get("type") == "tool_result"
                    for block in msg["content"]
                )
                if has_tool_result:
                    trim_to += 1
                    continue
            break

        if trim_to <= 0:
            return

        # Create summary of trimmed content
        object_ids = list(session.scene_state.objects.keys())
        last_user_msg = ""
        for msg in history[:trim_to]:
            if msg.get("role") == "user" and isinstance(msg.get("content"), str):
                last_user_msg = msg["content"][:200]

        summary = (
            f"Previous conversation summary: {trim_to} messages trimmed. "
            f"Objects in scene at that point: {object_ids}. "
            f"Last user request: {last_user_msg}"
        )

        # Replace trimmed messages with summary
        session.conversation_history = [
            {"role": "user", "content": summary},
            {"role": "assistant", "content": [{"type": "text", "text": "Understood, continuing from where we left off."}]},
        ] + history[trim_to:]
