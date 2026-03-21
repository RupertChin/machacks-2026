from typing import Optional
from app.models.constraints import Constraint, ConstraintSource


class ConstraintStore:
    def __init__(self):
        self.constraints: dict[str, Constraint] = {}
        self.spec_metadata: Optional[dict] = None
        self._next_constraint_id: int = 1

    def _generate_id(self) -> str:
        cid = f"c{self._next_constraint_id}"
        self._next_constraint_id += 1
        return cid

    def add_constraints(self, constraints: list[dict], spec_id: str = "") -> list[Constraint]:
        """Add constraints from extraction, assigning server-side IDs."""
        added = []
        for c_data in constraints:
            cid = self._generate_id()
            source = c_data.get("source", {})
            constraint = Constraint(
                id=cid,
                category=c_data["category"],
                feature_tags=c_data.get("feature_tags", []),
                description=c_data["description"],
                type=c_data["type"],
                value=c_data["value"],
                unit=c_data.get("unit", ""),
                rationale=c_data.get("rationale", ""),
                source=ConstraintSource(
                    spec_id=spec_id,
                    page=source.get("page", 0),
                    bbox=source.get("bbox"),
                ),
                active=True,
            )
            self.constraints[cid] = constraint
            added.append(constraint)
        return added

    def get_summary(self) -> dict:
        """Returns overview for agent context."""
        constraints_summary = []
        for c in self.constraints.values():
            if c.active:
                constraints_summary.append({
                    "id": c.id,
                    "category": c.category,
                    "description": c.description,
                })
        result = {
            "constraint_count": len(constraints_summary),
            "constraints": constraints_summary,
        }
        if self.spec_metadata:
            result["spec"] = self.spec_metadata.get("filename", "")
        return result

    def get_by_category(self, category: str) -> list[Constraint]:
        """Filter by category, active only."""
        return [c for c in self.constraints.values() if c.category == category and c.active]

    def get_detail(self, constraint_id: str) -> Optional[Constraint]:
        """Full constraint details."""
        return self.constraints.get(constraint_id)

    def search(self, query: str) -> list[Constraint]:
        """Case-insensitive substring search across feature_tags, description, category."""
        query_lower = query.lower()
        results = []
        for c in self.constraints.values():
            if not c.active:
                continue
            if query_lower in c.description.lower():
                results.append(c)
                continue
            if query_lower in c.category.lower():
                results.append(c)
                continue
            if any(query_lower in tag.lower() for tag in c.feature_tags):
                results.append(c)
                continue
        return results

    def get_active(self) -> list[Constraint]:
        """All active constraints."""
        return [c for c in self.constraints.values() if c.active]

    def set_active(self, constraint_id: str, active: bool) -> Constraint:
        """Toggle a constraint active/inactive. Raises KeyError if not found."""
        if constraint_id not in self.constraints:
            raise KeyError(f"Constraint {constraint_id} not found")
        self.constraints[constraint_id].active = active
        return self.constraints[constraint_id]

    def clear(self):
        """Remove all constraints and spec metadata."""
        self.constraints.clear()
        self.spec_metadata = None
        self._next_constraint_id = 1
