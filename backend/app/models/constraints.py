from pydantic import BaseModel
from typing import Optional


class ConstraintSource(BaseModel):
    spec_id: str
    page: int
    bbox: Optional[list[float]] = None


class Constraint(BaseModel):
    id: str
    category: str  # dimensional, mounting, clearance, interface, material, electrical, thermal, other
    feature_tags: list[str]
    description: str
    type: str  # dimension, position, position_array, tolerance, material, clearance, weight, electrical, thermal, enumeration
    value: dict | list
    unit: str
    rationale: str
    source: ConstraintSource
    active: bool = True
