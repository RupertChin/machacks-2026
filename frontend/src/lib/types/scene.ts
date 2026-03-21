export interface SceneObject {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  color: string;
}

export interface Operation {
  tool_name: string;
  params: Record<string, unknown>;
  result_id?: string;
}

export interface SceneState {
  objects: SceneObject[];
  operations: Operation[];
}
