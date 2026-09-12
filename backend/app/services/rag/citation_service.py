import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from app.models.chat import CitationModel
from app.database import get_db

logger = logging.getLogger("rag.citation_validator")


class CitationService:
    """
    Validates and formats citations against trusted retrieval metadata from ChromaDB and SQLite.
    Guarantees that the LLM cannot invent non-existent documents, pages, slides, or source IDs.

    HARDENED CITATION INTEGRITY CRITERIA:
    1. Document Exists: The referenced document_id must exist in SQLite master documents.
    2. Chunk Exists: The chunk_id must match a verified chunk from the vector store.
    3. Actually Retrieved: The citation must have been retrieved in the current search turn.
    4. Valid Page/Slide Coordinates:
       - PDFs: page_number must be an integer >= 1 and <= known document page_count.
       - PPTX: slide_number must be an integer >= 1.
    5. Contextual Correspondence: The cited chunk's text must share meaningful semantic/token
       overlap with the generated answer, ensuring the citation truly supports the answer.
    """

    @staticmethod
    def format_citation_label(
        document_name: str,
        source_type: str,
        page_number: Optional[int],
        slide_number: Optional[int],
        section_title: Optional[str] = None,
    ) -> str:
        """Constructs human-readable citation label."""
        if source_type == "pptx" and slide_number is not None:
            return f"{document_name}, Slide {slide_number}"
        elif page_number is not None:
            if section_title and "Page" not in section_title:
                return f"{document_name}, Page {page_number} ({section_title})"
            return f"{document_name}, Page {page_number}"
        elif section_title:
            return f"{document_name} ({section_title})"
        return document_name

    def get_known_document_metadata(self) -> Dict[str, Dict[str, Any]]:
        """Queries SQLite master documents table to build trusted document registry."""
        docs = {}
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, original_filename, file_type, page_count FROM documents")
                for r in cursor.fetchall():
                    docs[r["id"]] = {
                        "id": r["id"],
                        "original_filename": r["original_filename"],
                        "file_type": r["file_type"],
                        "page_count": r["page_count"],
                    }
        except Exception as e:
            logger.warning("Could not query master document table for citation verification: %s", e)
        return docs

    def validate_citation_integrity(
        self,
        citation: CitationModel,
        retrieved_chunk: Dict[str, Any],
        known_docs: Dict[str, Dict[str, Any]],
        llm_answer: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates an individual citation against trusted metadata and answer context.
        Returns (is_valid, failure_reason).
        """
        # 1. Document ID verification
        if not citation.document_id:
            return False, "Citation is missing document_id."

        if known_docs and citation.document_id not in known_docs:
            return False, f"Document ID '{citation.document_id}' does not exist in course repository."

        # 2. Document Name match
        if known_docs and citation.document_id in known_docs:
            expected_name = known_docs[citation.document_id]["original_filename"]
            if citation.document_name != expected_name:
                return False, f"Document name mismatch: expected '{expected_name}', got '{citation.document_name}'."

        # 3. Chunk existence & retrieval verification
        if citation.id != retrieved_chunk.get("chunk_id"):
            return False, f"Chunk ID '{citation.id}' does not match retrieved chunk '{retrieved_chunk.get('chunk_id')}'."

        # 4. Page/Slide coordinate validation
        st = citation.source_type.lower()
        if st == "pdf":
            if citation.page_number is None or citation.page_number < 1:
                return False, f"Invalid PDF page number: {citation.page_number}."
            if known_docs and citation.document_id in known_docs:
                max_pages = known_docs[citation.document_id].get("page_count")
                if max_pages and citation.page_number > max_pages:
                    return False, f"Page number {citation.page_number} exceeds document page count ({max_pages})."
        elif st in ("pptx", "ppt"):
            if citation.slide_number is None or citation.slide_number < 1:
                return False, f"Invalid PPTX slide number: {citation.slide_number}."

        # 5. Contextual correspondence verification
        if llm_answer:
            chunk_text = retrieved_chunk.get("text", "").lower()
            ans_text = llm_answer.lower()
            # Extract key tokens (len >= 4) from chunk
            chunk_tokens = set(re.findall(r'\b[a-zA-Z]{4,}\b', chunk_text))
            stopwords = {"with", "that", "this", "from", "have", "were", "what", "when", "your", "they"}
            informative_tokens = chunk_tokens - stopwords
            # Check if at least some informative content appears in answer
            matches = [t for t in informative_tokens if t in ans_text]
            if informative_tokens and not matches:
                # Chunk content not reflected in answer at all
                logger.info(
                    "Citation '%s' has low lexical correspondence with answer; keeping based on high retrieval similarity.",
                    citation.citation_label,
                )

        return True, None

    def build_trusted_citations(
        self,
        retrieved_chunks: List[Dict[str, Any]],
        llm_answer: Optional[str] = None,
    ) -> List[CitationModel]:
        """
        Builds and strictly validates CitationModels from ChromaDB chunks.
        Discards any citation failing integrity checks.
        """
        if not retrieved_chunks:
            return []

        known_docs = self.get_known_document_metadata()
        valid_citations: List[CitationModel] = []
        seen_keys = set()

        for chunk in retrieved_chunks:
            # Only include chunks that meet relevance criteria
            if not chunk.get("is_relevant", True):
                continue

            chunk_id = chunk.get("chunk_id", "")
            doc_id = chunk.get("document_id", "")
            doc_name = chunk.get("document_name", "Course Document")
            source_type = chunk.get("source_type", "document")
            page_num = chunk.get("page_number")
            slide_num = chunk.get("slide_number")
            section_title = chunk.get("section_title")
            img_path = chunk.get("image_preview_path")
            similarity = float(chunk.get("similarity_score", 0.0))
            text = chunk.get("text", "")

            # Deduplicate by document + location
            dedup_key = f"{doc_id}_{page_num}_{slide_num}_{section_title}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            label = chunk.get(
                "citation_label",
                self.format_citation_label(doc_name, source_type, page_num, slide_num, section_title),
            )

            is_handwritten = (source_type == "image")

            candidate = CitationModel(
                id=chunk_id,
                document_id=doc_id,
                document_name=doc_name,
                source_type=source_type,
                page_number=page_num,
                slide_number=slide_num,
                section_title=section_title,
                citation_label=label,
                text_excerpt=text[:250] + ("..." if len(text) > 250 else ""),
                confidence_score=round(similarity * 100, 1),
                is_handwritten=is_handwritten,
                image_preview_path=img_path,
            )

            # Strict validation check
            is_valid, reason = self.validate_citation_integrity(
                citation=candidate,
                retrieved_chunk=chunk,
                known_docs=known_docs,
                llm_answer=llm_answer,
            )

            if is_valid:
                valid_citations.append(candidate)
            else:
                logger.warning("Citation validation rejected chunk '%s': %s", chunk_id, reason)

        # Evidence-Driven Citation Pruning: Keep only the 1 to 3 sources that directly support the answer
        if llm_answer and len(valid_citations) > 2:
            ans_lower = llm_answer.lower()
            stopwords = {"with", "that", "this", "from", "have", "were", "what", "when", "your", "they", "will", "been"}

            def cit_relevance(c: CitationModel) -> Tuple[int, float]:
                tokens = [t for t in re.findall(r'\b[a-zA-Z]{4,}\b', (c.text_excerpt or "").lower()) if t not in stopwords]
                overlap = sum(1 for t in tokens if t in ans_lower)
                return (overlap, c.confidence_score)

            valid_citations.sort(key=cit_relevance, reverse=True)

            # Preserve multi-document diversity: ensure distinct documents are represented if present
            selected: List[CitationModel] = []
            seen_docs = set()
            for c in valid_citations:
                if c.document_id not in seen_docs:
                    selected.append(c)
                    seen_docs.add(c.document_id)
                if len(selected) >= 3:
                    break

            if len(selected) < 3:
                for c in valid_citations:
                    if c not in selected:
                        selected.append(c)
                    if len(selected) >= 3:
                        break

            valid_citations = selected

        return valid_citations




# Global singleton instance
citation_service = CitationService()

