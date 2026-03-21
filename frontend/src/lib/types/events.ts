export type SSEEventType =
  | "agent_text"
  | "tool_call"
  | "tool_result_ack"
  | "done"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}
