import re
from pathlib import Path
from typing import List
from pptx import Presentation
from app.services.processor.base_extractor import BaseExtractor, ExtractedUnit

class PPTXExtractor(BaseExtractor):
    """
    Extracts text slide-by-slide from PPT/PPTX presentations using python-pptx.
    Preserves exact slide numbers and slide titles for future slide-level citations.
    """

    def _clean_text(self, text: str) -> str:
        """Sanitize text by stripping private-use area characters (e.g. bullet glyphs \uf0e0)."""
        if not text:
            return ""
        # Remove unicode Private Use Area glyphs commonly used for custom bullets
        cleaned = re.sub(r'[\ue000-\uf8ff]', '', text)
        return cleaned.strip()

    def _extract_shape_text(self, shape) -> List[str]:
        """Safely extract all text from a PowerPoint shape, table, or group."""
        lines: List[str] = []
        try:
            # 1. Text frame shapes
            if getattr(shape, "has_text_frame", False) and shape.text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    t = self._clean_text(paragraph.text)
                    if t:
                        lines.append(t)

            # 2. Table shapes
            if getattr(shape, "has_table", False) and shape.table:
                for row in shape.table.rows:
                    row_cells = [self._clean_text(c.text) for c in row.cells if c.text and self._clean_text(c.text)]
                    if row_cells:
                        lines.append(" | ".join(row_cells))

            # 3. Grouped shapes (recursive)
            if hasattr(shape, "shapes"):
                for sub_shape in shape.shapes:
                    lines.extend(self._extract_shape_text(sub_shape))
        except Exception:
            pass

        return lines

    def extract(self, file_path: Path, document_name: str) -> List[ExtractedUnit]:
        units: List[ExtractedUnit] = []

        try:
            prs = Presentation(str(file_path))
        except Exception as e:
            raise ValueError(f"Could not open PowerPoint presentation '{document_name}': {str(e)}")

        total_slides = len(prs.slides)
        if total_slides == 0:
            return units

        for slide_idx, slide in enumerate(prs.slides, start=1):
            slide_lines: List[str] = []
            slide_title = None

            # Safely attempt to extract official slide title shape
            try:
                title_shape = slide.shapes.title
                if title_shape and getattr(title_shape, "has_text_frame", False):
                    t_val = getattr(title_shape, "text", "")
                    if t_val and t_val.strip():
                        slide_title = t_val.strip()
                        slide_lines.append(f"# {slide_title}")
            except Exception:
                slide_title = None

            # Extract text from all shapes (text frames, tables, groups)
            for shape in slide.shapes:
                # If shape is title and was already added, skip to avoid duplication
                try:
                    if slide_title and getattr(shape, "has_text_frame", False):
                        if getattr(shape, "text", "").strip() == slide_title:
                            continue
                except Exception:
                    pass

                shape_lines = self._extract_shape_text(shape)
                slide_lines.extend(shape_lines)

            combined_text = "\n".join(slide_lines).strip()
            is_empty = len(combined_text) == 0
            status = "empty_slide" if is_empty else "success"

            title = f"Slide {slide_idx}: {slide_title}" if slide_title else f"Slide {slide_idx}"

            unit = ExtractedUnit(
                section_index=slide_idx,
                source_type="pptx",
                page_number=None,
                slide_number=slide_idx,
                section_title=title,
                text=combined_text if not is_empty else "[Empty or non-text slide]",
                extraction_method="python-pptx",
                extraction_status=status,
                extraction_confidence=1.0 if not is_empty else None,
            )
            units.append(unit)

        return units
