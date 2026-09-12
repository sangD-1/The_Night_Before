import re
from pathlib import Path
from typing import List
from app.services.processor.base_extractor import BaseExtractor, ExtractedUnit

class TextExtractor(BaseExtractor):
    """
    Extracts structured content from Markdown (.md) and Plain Text (.txt) files.
    Preserves heading boundaries, line ranges, and paragraph structure for precise citations.
    """

    def extract(self, file_path: Path, document_name: str) -> List[ExtractedUnit]:
        units: List[ExtractedUnit] = []
        is_markdown = file_path.suffix.lower() == ".md"

        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                content = file_path.read_text(encoding="latin-1")
            except Exception as e:
                raise ValueError(f"Unable to decode text file '{document_name}': {str(e)}")

        if not content.strip():
            return [
                ExtractedUnit(
                    section_index=1,
                    source_type="markdown" if is_markdown else "text",
                    text="[Empty document]",
                    section_title="Empty File",
                    extraction_method="text-parser",
                    extraction_status="empty_document",
                    page_number=1,
                )
            ]

        lines = content.splitlines()

        if is_markdown:
            # Parse markdown based on headings
            current_title = "Introduction"
            current_lines: List[str] = []
            current_start_line = 1
            section_idx = 1

            heading_pattern = re.compile(r"^(#{1,4})\s+(.+)$")

            for line_no, line in enumerate(lines, start=1):
                match = heading_pattern.match(line.strip())
                if match and current_lines:
                    # Flush current section
                    section_text = "\n".join(current_lines).strip()
                    if section_text:
                        end_line = line_no - 1
                        units.append(
                            ExtractedUnit(
                                section_index=section_idx,
                                source_type="markdown",
                                page_number=section_idx,  # Logical section page
                                section_title=f"{current_title} (Lines {current_start_line}-{end_line})",
                                text=section_text,
                                extraction_method="markdown-heading-parser",
                                extraction_status="success",
                                extraction_confidence=1.0,
                            )
                        )
                        section_idx += 1

                    current_title = match.group(2).strip()
                    current_lines = [line]
                    current_start_line = line_no
                else:
                    current_lines.append(line)

            # Flush final section
            if current_lines:
                section_text = "\n".join(current_lines).strip()
                if section_text:
                    units.append(
                        ExtractedUnit(
                            section_index=section_idx,
                            source_type="markdown",
                            page_number=section_idx,
                            section_title=f"{current_title} (Lines {current_start_line}-{len(lines)})",
                            text=section_text,
                            extraction_method="markdown-heading-parser",
                            extraction_status="success",
                            extraction_confidence=1.0,
                        )
                    )

        # Fallback or plain text file: chunk by line batches (approx 30 lines) or empty lines
        if not units:
            chunk_size = 35
            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i : i + chunk_size]
                chunk_text = "\n".join(chunk_lines).strip()
                if chunk_text:
                    start_l = i + 1
                    end_l = min(i + chunk_size, len(lines))
                    idx = (i // chunk_size) + 1
                    units.append(
                        ExtractedUnit(
                            section_index=idx,
                            source_type="markdown" if is_markdown else "text",
                            page_number=idx,
                            section_title=f"Section {idx} (Lines {start_l}-{end_l})",
                            text=chunk_text,
                            extraction_method="text-line-chunker",
                            extraction_status="success",
                            extraction_confidence=1.0,
                        )
                    )

        return units
