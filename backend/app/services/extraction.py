import json
import asyncio
import tempfile
import os
from typing import Optional
from pathlib import Path

import anthropic

from app.config import settings
from app.prompts.extraction_prompt import EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL


_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def extract_constraints_from_pdf(
    pdf_bytes: bytes,
    filename: str,
    spec_id: str,
    constraint_store,
    progress_callback=None,
) -> tuple[list, int, str]:
    """
    Extract constraints from a PDF using OpenDataLoader + Claude.
    Returns (constraints, page_count, summary).
    """
    client = _get_client()

    # Save PDF to temp dir
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, filename)
        output_dir = os.path.join(tmp_dir, "output")
        os.makedirs(output_dir, exist_ok=True)

        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        # Run OpenDataLoader in executor (it's synchronous)
        try:
            import opendataloader_pdf
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: opendataloader_pdf.convert(
                    input_path=[pdf_path],
                    output_dir=output_dir,
                    format="markdown,json",
                    image_output="embedded",
                ),
            )
        except Exception as e:
            raise RuntimeError(f"PDF parsing failed: {str(e)}. Ensure Java 11+ is installed.")

        # Read parsed output
        json_files = list(Path(output_dir).glob("*.json"))
        md_files = list(Path(output_dir).glob("*.md"))

        elements = []
        if json_files:
            with open(json_files[0], "r") as f:
                elements = json.load(f)

        markdown_content = ""
        if md_files:
            with open(md_files[0], "r") as f:
                markdown_content = f.read()

        if not elements and not markdown_content:
            raise RuntimeError("PDF has no extractable content.")

        # Classify pages
        pages: dict[int, dict] = {}
        for elem in elements if isinstance(elements, list) else []:
            page_num = elem.get("page number", 1)
            if page_num not in pages:
                pages[page_num] = {"text_elements": [], "image_elements": []}

            elem_type = elem.get("type", "")
            text_like = {"heading", "paragraph", "table", "list", "caption", "formula"}
            if elem_type in text_like:
                pages[page_num]["text_elements"].append(elem)
            elif elem_type == "image":
                pages[page_num]["image_elements"].append(elem)

        page_count = max(pages.keys()) if pages else 1

        # Build content for Claude extraction
        all_constraints = []

        # Process pages in groups
        for page_num in sorted(pages.keys()):
            page_data = pages[page_num]
            total_elements = len(page_data["text_elements"]) + len(page_data["image_elements"])

            if total_elements == 0:
                continue

            text_ratio = len(page_data["text_elements"]) / total_elements if total_elements > 0 else 1.0

            content_blocks = []

            if text_ratio > 0.7:
                # Text page — send markdown
                page_text = "\n".join(
                    elem.get("content", "") for elem in page_data["text_elements"]
                )
                content_blocks.append({
                    "type": "text",
                    "text": f"## Input\ncontent_type: markdown\nPage {page_num}:\n\n{page_text}",
                })
            else:
                # Diagram page — send images if available
                for img_elem in page_data["image_elements"]:
                    img_content = img_elem.get("content", "")
                    if img_content and len(img_content) > 100:  # Likely base64
                        content_blocks.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": img_content,
                            },
                        })

                # Also include any text from the page
                page_text = "\n".join(
                    elem.get("content", "") for elem in page_data["text_elements"]
                )
                if page_text.strip():
                    content_blocks.append({
                        "type": "text",
                        "text": f"## Input\ncontent_type: image\nPage {page_num} text context:\n\n{page_text}",
                    })

            if not content_blocks:
                continue

            # Call Claude extraction
            try:
                response = await asyncio.wait_for(
                    client.messages.create(
                        model="claude-opus-4-6",
                        max_tokens=4096,
                        temperature=0,
                        system=EXTRACTION_SYSTEM_PROMPT,
                        messages=[{"role": "user", "content": content_blocks}],
                        tools=[EXTRACTION_TOOL],
                        tool_choice={"type": "tool", "name": "extract_constraints"},
                    ),
                    timeout=60.0,
                )

                # Extract constraints from tool call
                for block in response.content:
                    if block.type == "tool_use" and block.name == "extract_constraints":
                        page_constraints = block.input.get("constraints", [])
                        for c in page_constraints:
                            c["source"] = {"page": page_num, "spec_id": spec_id}
                        all_constraints.extend(page_constraints)

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                continue

        # If no pages were processed, try with full markdown
        if not all_constraints and markdown_content:
            try:
                response = await asyncio.wait_for(
                    client.messages.create(
                        model="claude-opus-4-6",
                        max_tokens=4096,
                        temperature=0,
                        system=EXTRACTION_SYSTEM_PROMPT,
                        messages=[{
                            "role": "user",
                            "content": f"## Input\ncontent_type: markdown\n\n{markdown_content[:50000]}",
                        }],
                        tools=[EXTRACTION_TOOL],
                        tool_choice={"type": "tool", "name": "extract_constraints"},
                    ),
                    timeout=60.0,
                )

                for block in response.content:
                    if block.type == "tool_use" and block.name == "extract_constraints":
                        all_constraints.extend(block.input.get("constraints", []))

            except Exception:
                pass

        # Store constraints (server-side IDs assigned by store)
        stored = constraint_store.add_constraints(all_constraints, spec_id=spec_id)

        summary = f"Extracted {len(stored)} constraints from {page_count} pages of {filename}"

        return stored, page_count, summary
