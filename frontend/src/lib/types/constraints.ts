export interface Constraint {
  id: string;
  category: string;
  description: string;
  value: string;
  unit?: string;
  active: boolean;
}

export interface ConstraintSource {
  filename: string;
  uploaded_at: string;
}

export interface SpecMetadata {
  source: ConstraintSource;
  constraints: Constraint[];
}
