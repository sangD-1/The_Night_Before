from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

@dataclass
class ExtractedUnit:
    """Represents a normalized, location-preserved extracted unit (page, slide, section, or scan)."""
    section_index: int
    source_type: str  # 'pdf', 'pptx', 'markdown', 'text', 'image'
    text: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    section_title: Optional[str] = None
    char_count: int = 0
    word_count: int = 0
    extraction_method: str = "unknown"
    extraction_status: str = "success"  # 'success', 'empty_page', 'empty_slide', 'ocr_unavailable', 'failed'
    extraction_confidence: Optional[float] = None
    image_preview_path: Optional[str] = None

    def __post_init__(self):
        if not self.char_count:
            self.char_count = len(self.text)
        if not self.word_count:
            self.word_count = len(self.text.split())

class BaseExtractor(ABC):
    """Abstract interface for document text extractors preserving exact source location."""

    @abstractmethod
    def extract(self, file_path: Path, document_name: str) -> List[ExtractedUnit]:
        """
        Extract text from file preserving page/slide boundaries.
        Returns a list of ExtractedUnit objects.
        """
        pass
