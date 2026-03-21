export interface ConstraintSource {
  spec_id: string;
  page: number;
  bbox?: [number, number, number, number];
}

export type ConstraintCategory = "dimensional" | "mounting" | "clearance" | "interface" | "material" | "electrical" | "thermal" | "other";

export type ConstraintType = "dimension" | "position" | "position_array" | "tolerance" | "material" | "clearance" | "weight" | "electrical" | "thermal" | "enumeration";

export interface Constraint {
  id: string;
  category: ConstraintCategory;
  feature_tags: string[];
  description: string;
  type: ConstraintType;
  value: Record<string, any> | any[];
  unit: string;
  rationale: string;
  source: ConstraintSource;
  active: boolean;
}

export interface SpecMetadata {
  spec_id: string;
  filename: string;
  page_count: number;
  uploaded_at: string;
}
