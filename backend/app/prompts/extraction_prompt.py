EXTRACTION_SYSTEM_PROMPT = """You are a technical specification extraction system. Analyze the following content from a technical spec sheet and extract ALL engineering constraints, dimensions, positions, and specifications by calling the extract_constraints tool.

## Constraint value formats (by type):
- dimension: {"length": number} or {"width": number, "height": number} or {"diameter": number} etc.
- position: {"x": number, "y": number} or {"x": number, "y": number, "z": number}
- position_array: [{"x": number, "y": number, "label": "optional"}, ...]
- tolerance: {"nominal": number, "plus": number, "minus": number}
- clearance: {"min": number, "max": number (optional)}
- material: {"name": "string", "properties": {"density": number, ...}}
- weight: {"value": number}
- electrical: {"voltage": number, "current": number} or {"power": number} etc.
- thermal: {"min_temp": number, "max_temp": number} or {"dissipation": number}
- enumeration: {"options": ["option1", "option2"]} or {"value": "string"}
- unit: measurement unit (e.g., "mm", "g", "°C", "V", "A", "W")
- rationale: why this matters for someone designing around this component (1 sentence)

## Instructions
- Extract EVERYTHING: dimensions, hole positions, connector locations, component heights, board thickness, weight, electrical ratings, thermal limits, material specs
- For position data, note the reference point / origin clearly in the rationale
- For arrays of positions (e.g., mounting holes), use the position_array type
- Normalize all dimensions to mm, weights to grams, temperatures to °C
- If a diagram shows dimensions with callout lines, extract each labeled dimension
- Generate meaningful feature_tags that someone might search for when designing an enclosure, mount, or adapter for this component

Call the extract_constraints tool with all extracted constraints."""


EXTRACTION_TOOL = {
    "name": "extract_constraints",
    "description": "Extract engineering constraints from a spec sheet page",
    "input_schema": {
        "type": "object",
        "properties": {
            "constraints": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["dimensional", "mounting", "clearance", "interface", "material", "electrical", "thermal", "other"],
                        },
                        "feature_tags": {"type": "array", "items": {"type": "string"}},
                        "description": {"type": "string"},
                        "type": {
                            "type": "string",
                            "enum": ["dimension", "position", "position_array", "tolerance", "material", "clearance", "weight", "electrical", "thermal", "enumeration"],
                        },
                        "value": {},
                        "unit": {"type": "string"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["category", "feature_tags", "description", "type", "value", "unit", "rationale"],
                },
            }
        },
        "required": ["constraints"],
    },
}
