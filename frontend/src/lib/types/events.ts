// User's transcribed speech
export interface TranscriptEvent {
  event: "transcript";
  data: { text: string };
}

// Streamed text tokens from Claude
export interface AgentTextEvent {
  event: "agent_text";
  data: { text: string; done: boolean };
}

// CAD tool call requiring frontend execution
export interface ToolCallEvent {
  event: "tool_call";
  data: {
    op_id: string;
    tool_name: string;
    parameters: Record<string, any>;
  };
}

// Tool resolved on backend (constraint/scene query)
export interface ToolResultInternalEvent {
  event: "tool_result_internal";
  data: {
    op_id: string;
    tool_name: string;
    parameters: Record<string, any>;
    result: any;
  };
}

// Error
export interface ErrorEvent {
  event: "error";
  data: { message: string; recoverable: boolean };
}

// Agent turn complete
export interface DoneEvent {
  event: "done";
  data: Record<string, never>;
}

// Upload SSE events
export interface UploadProgressEvent {
  event: "upload_progress";
  data: { stage: "parsing" | "classifying" | "extracting" | "done"; page?: number; total_pages?: number };
}

export interface UploadErrorEvent {
  event: "upload_error";
  data: { message: string; stage: "parsing" | "classifying" | "extracting"; recoverable: boolean };
}

export interface UploadCompleteEvent {
  event: "upload_complete";
  data: {
    spec_id: string;
    filename: string;
    page_count: number;
    constraints: import("./constraints").Constraint[];
    extraction_summary: string;
  };
}

// Discriminated unions
export type AgentSSEEvent = TranscriptEvent | AgentTextEvent | ToolCallEvent | ToolResultInternalEvent | ErrorEvent | DoneEvent;
export type UploadSSEEvent = UploadProgressEvent | UploadErrorEvent | UploadCompleteEvent;
export type SSEEvent = AgentSSEEvent | UploadSSEEvent;
