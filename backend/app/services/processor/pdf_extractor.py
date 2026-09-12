from pathlib import Path
from typing import List
import pymupdf
from app.services.processor.base_extractor import BaseExtractor, ExtractedUnit

class PDFExtractor(BaseExtractor):
    """
    Extracts text page-by-page from PDF files using PyMuPDF.
    Never flattens pages into one single blob, ensuring precise page-level citation metadata.
    """

    def extract(self, file_path: Path, document_name: str) -> List[ExtractedUnit]:
        units: List[ExtractedUnit] = []

        try:
            doc = pymupdf.open(str(file_path))
        except Exception as e:
            raise ValueError(f"Could not open PDF file '{document_name}': {str(e)}")

        total_pages = len(doc)
        if total_pages == 0:
            return units

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]

            # Extract raw text from the page
            page_text = page.get_text("text").strip()

            # Determine extraction status & title
            is_empty = len(page_text) < 5
            status = "empty_page" if is_empty else "success"

            # Derive a clean section title from the first non-empty line or fallback
            section_title = f"Page {page_num}"
            if not is_empty:
                first_line = page_text.splitlines()[0].strip()
                if 0 < len(first_line) <= 80:
                    section_title = f"Page {page_num}: {first_line}"

            unit = ExtractedUnit(
                section_index=page_num,
                source_type="pdf",
                page_number=page_num,
                slide_number=None,
                section_title=section_title,
                text=page_text if not is_empty else "[Empty or non-text page]",
                extraction_method="pymupdf",
                extraction_status=status,
                extraction_confidence=1.0 if not is_empty else None,
            )
            units.append(unit)

        doc.close()
        return units
