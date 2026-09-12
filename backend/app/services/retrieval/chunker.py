import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from app.config import DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP


@dataclass
class DocumentChunk:
    id: str
    document_id: str
    document_name: str
    source_type: str
    page_number: Optional[int]
    slide_number: Optional[int]
    section_title: Optional[str]
    chunk_index: int
    total_chunks_in_section: int
    text: str
    char_count: int
    word_count: int
    original_file_reference: str
    image_preview_path: Optional[str]
    citation_label: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_metadata(self) -> Dict[str, Any]:
        """
        Metadata formatted strictly for ChromaDB storage.
        Chroma requires string, int, float, or bool values in metadata (no None or complex objects).
        """
        return {
            "document_id": str(self.document_id),
            "document_name": str(self.document_name),
            "source_type": str(self.source_type),
            "page_number": int(self.page_number) if self.page_number is not None else -1,
            "slide_number": int(self.slide_number) if self.slide_number is not None else -1,
            "section_title": str(self.section_title or ""),
            "chunk_index": int(self.chunk_index),
            "total_chunks_in_section": int(self.total_chunks_in_section),
            "char_count": int(self.char_count),
            "word_count": int(self.word_count),
            "original_file_reference": str(self.original_file_reference or ""),
            "image_preview_path": str(self.image_preview_path or ""),
            "citation_label": str(self.citation_label),
        }


class Chunker:
    """
    Page/slide-aware chunker.
    Crucial guarantee: Text is NEVER merged across pages or slides.
    Every chunk is strictly anchored to its parent page/slide/section with full citation metadata.
    """

    def __init__(self, chunk_size: int = DEFAULT_CHUNK_SIZE, chunk_overlap: int = DEFAULT_CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @staticmethod
    def build_citation_label(doc_name: str, source_type: str, page_number: Optional[int], slide_number: Optional[int], section_title: Optional[str]) -> str:
        """Constructs human-readable citation string."""
        if source_type == "pptx" and slide_number is not None:
            return f"{doc_name}, Slide {slide_number}"
        elif page_number is not None:
            if section_title and "Page" not in section_title:
                return f"{doc_name}, Page {page_number} ({section_title})"
            return f"{doc_name}, Page {page_number}"
        elif section_title:
            return f"{doc_name} ({section_title})"
        return doc_name

    def split_text_into_chunks(self, text: str) -> List[str]:
        """
        Splits text within a single section using sentence / paragraph boundaries.
        Falls back to sliding character window with overlap if individual sentences exceed chunk_size.
        """
        cleaned = text.strip()
        if not cleaned:
            return []

        if len(cleaned) <= self.chunk_size:
            return [cleaned]

        # Break text into candidate segments (paragraphs or sentences)
        sentences = re.split(r'(?<=[.?!;:\n])\s+', cleaned)
        chunks: List[str] = []
        current_chunk_parts: List[str] = []
        current_len = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # If a single sentence is larger than chunk_size, split it into character slices
            if len(sentence) > self.chunk_size:
                # Flush existing buffer first
                if current_chunk_parts:
                    chunk_str = " ".join(current_chunk_parts).strip()
                    if chunk_str:
                        chunks.append(chunk_str)
                    current_chunk_parts = []
                    current_len = 0

                # Slice long sentence with overlap
                start = 0
                while start < len(sentence):
                    end = min(start + self.chunk_size, len(sentence))
                    slice_text = sentence[start:end].strip()
                    if slice_text:
                        chunks.append(slice_text)
                    if end >= len(sentence):
                        break
                    start += (self.chunk_size - self.chunk_overlap)
                continue

            # Normal case: accumulate sentences
            extra_len = len(sentence) + (1 if current_chunk_parts else 0)
            if current_len + extra_len <= self.chunk_size:
                current_chunk_parts.append(sentence)
                current_len += extra_len
            else:
                # Save current chunk
                chunk_str = " ".join(current_chunk_parts).strip()
                if chunk_str:
                    chunks.append(chunk_str)

                # Overlap: keep the last sentence(s) if under overlap size
                overlap_parts: List[str] = []
                overlap_len = 0
                for prev_sentence in reversed(current_chunk_parts):
                    if overlap_len + len(prev_sentence) + 1 <= self.chunk_overlap:
                        overlap_parts.insert(0, prev_sentence)
                        overlap_len += len(prev_sentence) + 1
                    else:
                        break

                current_chunk_parts = overlap_parts + [sentence]
                current_len = sum(len(p) for p in current_chunk_parts) + (len(current_chunk_parts) - 1)

        if current_chunk_parts:
            final_str = " ".join(current_chunk_parts).strip()
            if final_str and (not chunks or final_str != chunks[-1]):
                chunks.append(final_str)

        return chunks if chunks else [cleaned]

    def chunk_section(self, section: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Chunks an extracted section dict (from document_sections table) into 1 or more DocumentChunks.
        """
        text = section.get("text", "").strip()
        if not text:
            return []

        text_pieces = self.split_text_into_chunks(text)
        total_chunks = len(text_pieces)
        doc_id = section["document_id"]
        doc_name = section.get("document_name", "Unknown Document")
        source_type = section.get("source_type", "unknown")
        page_num = section.get("page_number")
        slide_num = section.get("slide_number")
        sec_title = section.get("section_title")
        sec_idx = section.get("section_index", 0)
        orig_file = section.get("original_file_reference", "")
        img_preview = section.get("image_preview_path")

        citation = self.build_citation_label(doc_name, source_type, page_num, slide_num, sec_title)

        result: List[DocumentChunk] = []
        for idx, piece in enumerate(text_pieces):
            chunk_id = f"{doc_id}_s{sec_idx}_c{idx}"
            words = len(piece.split())
            chunk = DocumentChunk(
                id=chunk_id,
                document_id=doc_id,
                document_name=doc_name,
                source_type=source_type,
                page_number=page_num,
                slide_number=slide_num,
                section_title=sec_title,
                chunk_index=idx,
                total_chunks_in_section=total_chunks,
                text=piece,
                char_count=len(piece),
                word_count=words,
                original_file_reference=orig_file,
                image_preview_path=img_preview,
                citation_label=citation,
            )
            result.append(chunk)

        return result

    def chunk_sections(self, sections: List[Dict[str, Any]]) -> List[DocumentChunk]:
        """Process a list of sections and return all generated chunks."""
        all_chunks: List[DocumentChunk] = []
        for sec in sections:
            all_chunks.extend(self.chunk_section(sec))
        return all_chunks


# Global singleton instance
chunker = Chunker()
