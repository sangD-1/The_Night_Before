from typing import Optional, List, Any
from pydantic import BaseModel

class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    file_type: str
    mime_type: Optional[str] = None
    file_size: int
    upload_status: str
    created_at: str
    page_count: Optional[int] = None
    processing_status: Optional[str] = None
    extraction_status: Optional[str] = None
    document_type: Optional[str] = None
    ocr_status: Optional[str] = None

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int

class DeleteResponse(BaseModel):
    success: bool
    message: str
    document_id: str

class DocumentSectionResponse(BaseModel):
    id: str
    document_id: str
    document_name: str
    source_type: str
    section_index: int
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    section_title: Optional[str] = None
    text: str
    char_count: int
    word_count: int
    extraction_method: str
    extraction_status: str
    extraction_confidence: Optional[float] = None
    original_file_reference: str
    image_preview_path: Optional[str] = None
    created_at: str

class DocumentSectionsListResponse(BaseModel):
    document_id: str
    total_sections: int
    sections: List[DocumentSectionResponse]

class DocumentProcessResponse(BaseModel):
    document_id: str
    original_filename: str
    file_type: str
    total_units_extracted: int
    processing_status: str
    sections: List[Any]
