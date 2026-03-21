// Main thread → Worker
export type WorkerRequest =
  | { type: "execute_tool"; op_id: string; tool_name: string; parameters: Record<string, any> }
  | { type: "delete_object"; object_id: string }
  | { type: "clear_all" }
  | { type: "export_all"; format: "stl" };

// Worker → Main thread
export type WorkerResponse =
  | { type: "tool_result"; op_id: string; status: "success"; positions: Float32Array; normals: Float32Array; object_id: string; bbox: number[] }
  | { type: "tool_result_batch"; op_id: string; results: Array<{ object_id: string; positions: Float32Array; normals: Float32Array; bbox: number[] }> }
  | { type: "tool_result"; op_id: string; status: "failure"; error: string }
  | { type: "delete_result"; object_id: string; status: "success" | "failure" }
  | { type: "clear_result"; status: "success" }
  | { type: "export_result"; data: ArrayBuffer; format: "stl" }
  | { type: "error"; message: string };

// Tool result POST from frontend to backend
export interface ToolResultPayload {
  op_id: string;
  status: "success" | "failure";
  result?: {
    object_id?: string;
    object_ids?: string[];
    bbox?: [number, number, number, number, number, number];
  };
  error?: string;
}

// CAD tools that go to the Worker
export const CAD_TOOLS = new Set([
  "add_primitive", "subtract", "union", "intersect",
  "move_object", "rotate_object", "scale_object",
  "clone_object", "linear_pattern", "delete_object"
]);

// Tools that don't go to Worker
export const MAIN_THREAD_TOOLS = new Set(["set_color", "rename_object"]);
