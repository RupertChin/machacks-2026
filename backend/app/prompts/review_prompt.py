REVIEW_PROMPT_TEMPLATE = """You are a CAD design reviewer. Analyze the current 3D design against the loaded engineering constraints.

## Current Scene State
{scene_state_json}

## Active Constraints
{constraints_json}

## Instructions
For each active constraint, evaluate whether the current design satisfies it:
- ✅ Satisfied: the design meets this constraint (explain how)
- ⚠️ Warning: the design is close but may have issues (explain the risk)
- ❌ Violated: the design does not meet this constraint (explain the gap)

Also note:
- Any objects that seem misplaced or incorrectly sized
- Potential interference between parts
- Missing features that the constraints imply should exist

Be specific — reference object IDs, dimensions, and constraint values."""
