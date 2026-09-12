import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any
from app.database import get_db
from app.services.processor.base_extractor import BaseExtractor, ExtractedUnit
from app.services.processor.pdf_extractor import PDFExtractor
from app.services.processor.pptx_extractor import PPTXExtractor
from app.services.processor.text_extractor import TextExtractor
from app.services.processor.image_extractor import ImageExtractor

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"

class DocumentProcessor:
    """
    Central coordinator for extracting structured, location-preserved content
    across PDFs, PPT/PPTX slides, Markdown/text notes, and images.
    """

    def __init__(self):
        self._extractors: Dict[str, BaseExtractor] = {
            "pdf": PDFExtractor(),
            "pptx": PPTXExtractor(),
            "markdown": TextExtractor(),
            "text": TextExtractor(),
            "image": ImageExtractor(),
        }

    def get_extractor(self, file_type: str) -> BaseExtractor:
        """Resolve the appropriate extractor for the given file type."""
        extractor = self._extractors.get(file_type.lower())
        if not extractor:
            raise ValueError(f"No processor registered for file type '{file_type}'")
        return extractor

    def process_document(self, document_id: str) -> Dict[str, Any]:
        """
        Processes an uploaded document, extracts pages/slides/sections,
        and saves normalized sections into SQLite.
        """
        # 1. Fetch document metadata
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (document_id,))
            doc_row = cursor.fetchone()
            if not doc_row:
                raise ValueError(f"Document with ID '{document_id}' not found.")
            doc = dict(doc_row)

        stored_filename = doc["stored_filename"]
        file_path = UPLOADS_DIR / stored_filename

        if not file_path.exists():
            raise FileNotFoundError(f"Stored file for document '{document_id}' not found on disk.")

        file_type = doc["file_type"].lower()
        extractor = self.get_extractor(file_type)

        # 2. Mark document as processing in database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE documents SET processing_status = 'processing', upload_status = 'processing' WHERE id = ?",
                (document_id,),
            )

        # 3. Perform structured extraction
        try:
            extracted_units: List[ExtractedUnit] = extractor.extract(
                file_path=file_path, document_name=doc["original_filename"]
            )
        except Exception as err:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE documents
                    SET processing_status = 'processing_failed',
                        extraction_status = ?,
                        upload_status = 'processing_failed'
                    WHERE id = ?
                    """,
                    (f"Extraction error: {str(err)}", document_id),
                )
            raise ValueError(f"Processing failed for document '{doc['original_filename']}': {str(err)}")

        # 4. Save extracted units into document_sections
        now = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            # Clear any previously extracted sections if re-processing
            cursor.execute("DELETE FROM document_sections WHERE document_id = ?", (document_id,))

            for unit in extracted_units:
                section_id = str(uuid.uuid4())
                cursor.execute(
                    """
                    INSERT INTO document_sections (
                        id, document_id, document_name, source_type,
                        section_index, page_number, slide_number, section_title,
                        text, char_count, word_count, extraction_method,
                        extraction_status, extraction_confidence, original_file_reference,
                        image_preview_path, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        section_id,
                        document_id,
                        doc["original_filename"],
                        unit.source_type,
                        unit.section_index,
                        unit.page_number,
                        unit.slide_number,
                        unit.section_title,
                        unit.text,
                        unit.char_count,
                        unit.word_count,
                        unit.extraction_method,
                        unit.extraction_status,
                        unit.extraction_confidence,
                        stored_filename,
                        unit.image_preview_path,
                        now,
                    ),
                )

            # 5. Update document status to ready_for_indexing
            ocr_status = None
            if file_type == "image":
                first_status = extracted_units[0].extraction_status if extracted_units else "failed"
                ocr_status = "success" if first_status == "success" else "ocr_unavailable"

            cursor.execute(
                """
                UPDATE documents
                SET page_count = ?,
                    processing_status = 'ready_for_indexing',
                    upload_status = 'ready_for_indexing',
                    extraction_status = 'success',
                    ocr_status = ?
                WHERE id = ?
                """,
                (len(extracted_units), ocr_status, document_id),
            )

        return {
            "document_id": document_id,
            "original_filename": doc["original_filename"],
            "file_type": file_type,
            "total_units_extracted": len(extracted_units),
            "processing_status": "ready_for_indexing",
            "sections": [
                {
                    "section_index": u.section_index,
                    "page_number": u.page_number,
                    "slide_number": u.slide_number,
                    "section_title": u.section_title,
                    "text_snippet": u.text[:120] + ("..." if len(u.text) > 120 else ""),
                    "char_count": u.char_count,
                    "word_count": u.word_count,
                    "extraction_status": u.extraction_status,
                    "extraction_confidence": u.extraction_confidence,
                    "image_preview_path": u.image_preview_path,
                }
                for u in extracted_units
            ],
        }

    @staticmethod
    def get_document_sections(document_id: str) -> List[Dict[str, Any]]:
        """Retrieve all extracted sections/pages/slides for a specific document."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM document_sections
                WHERE document_id = ?
                ORDER BY section_index ASC
                """,
                (document_id,),
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

# Global singleton
document_processor = DocumentProcessor()
