from typing import Optional, List
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., description="Student's study query to search across uploaded course materials")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Maximum number of chunks to retrieve")
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional custom similarity threshold override")
    document_ids: Optional[List[str]] = Field(None, description="Optional filter to restrict search to specific document IDs")


class SearchResultItem(BaseModel):
    chunk_id: str
    similarity_score: float
    cosine_distance: float
    is_relevant: bool
    text: str
    document_id: str
    document_name: str
    source_type: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    section_title: Optional[str] = None
    chunk_index: int
    citation_label: str
    original_file_reference: str
    image_preview_path: Optional[str] = None
    char_count: int
    word_count: int


class SearchResponse(BaseModel):
    query: str
    total_results: int
    has_sufficient_evidence: bool
    best_similarity_score: float
    similarity_threshold: float
    results: List[SearchResultItem]
    message: Optional[str] = None


class IndexResponse(BaseModel):
    document_id: str
    original_filename: str
    total_sections: int
    total_chunks_indexed: int
    status: str
    total_vectors_in_store: int


class IndexAllResponse(BaseModel):
    indexed_documents_count: int
    total_chunks_indexed: int
    failed_count: int
    results: List[IndexResponse]
    errors: List[dict]
    total_vectors_in_store: int


class RetrievalStatusResponse(BaseModel):
    collection_name: str
    persist_directory: str
    total_chunks_in_vector_store: int
    total_documents_in_db: int
    indexed_documents_count: int
    embedding_model: str
    embedding_dimension: int
    similarity_threshold: float
    default_top_k: int
