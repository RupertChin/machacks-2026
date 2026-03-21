import json
from sse_starlette.sse import ServerSentEvent


def transcript_event(text: str) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({"text": text}), event="transcript")


def agent_text_event(text: str, done: bool = False) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({"text": text, "done": done}), event="agent_text")


def tool_call_event(op_id: str, tool_name: str, parameters: dict) -> ServerSentEvent:
    return ServerSentEvent(
        data=json.dumps({"op_id": op_id, "tool_name": tool_name, "parameters": parameters}),
        event="tool_call",
    )


def tool_result_internal_event(op_id: str, tool_name: str, parameters: dict, result: any) -> ServerSentEvent:
    return ServerSentEvent(
        data=json.dumps({"op_id": op_id, "tool_name": tool_name, "parameters": parameters, "result": result}),
        event="tool_result_internal",
    )


def error_event(message: str, recoverable: bool = True) -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({"message": message, "recoverable": recoverable}), event="error")


def done_event() -> ServerSentEvent:
    return ServerSentEvent(data=json.dumps({}), event="done")


def upload_progress_event(stage: str, page: int | None = None, total_pages: int | None = None) -> ServerSentEvent:
    d = {"stage": stage}
    if page is not None:
        d["page"] = page
    if total_pages is not None:
        d["total_pages"] = total_pages
    return ServerSentEvent(data=json.dumps(d), event="upload_progress")


def upload_error_event(message: str, stage: str, recoverable: bool = False) -> ServerSentEvent:
    return ServerSentEvent(
        data=json.dumps({"message": message, "stage": stage, "recoverable": recoverable}),
        event="upload_error",
    )


def upload_complete_event(spec_id: str, filename: str, page_count: int, constraints: list, extraction_summary: str) -> ServerSentEvent:
    return ServerSentEvent(
        data=json.dumps({
            "spec_id": spec_id,
            "filename": filename,
            "page_count": page_count,
            "constraints": [c.model_dump() if hasattr(c, 'model_dump') else c for c in constraints],
            "extraction_summary": extraction_summary,
        }),
        event="upload_complete",
    )
