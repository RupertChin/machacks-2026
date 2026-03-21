export interface SceneObject {
  id: string;
  label: string;
  type: string;
  params: Record<string, any>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  bbox?: [number, number, number, number, number, number];
  created_by_op: string;
}

export interface Operation {
  op_id: string;
  action: string;
  params: Record<string, any>;
  status: "success" | "failure";
  result_object_ids: string[];
  error?: string;
  timestamp: string;
}

export interface SceneState {
  objects: Record<string, SceneObject>;
  operation_history: Operation[];
}

export interface SceneContext {
  objects: SceneObject[];
  recent_operations: Operation[];
  total_operations: number;
  active_spec?: string;
}
