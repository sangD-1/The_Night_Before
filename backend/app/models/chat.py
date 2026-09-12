from typing import Optional, List
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Student's study question to answer from course materials")
    session_id: Optional[str] = Field(None, description="Optional session/conversation identifier for multi-turn context")
    document_ids: Optional[List[str]] = Field(None, description="Optional list of document IDs to restrict retrieval to")
    top_k: Optional[int] = Field(None, ge=1, le=10, description="Optional override for number of retrieved chunks")
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional override for relevance threshold")


class CitationModel(BaseModel):
    id: str
    document_id: str
    document_name: str
    source_type: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    section_title: Optional[str] = None
    citation_label: str
    text_excerpt: str
    confidence_score: float
    is_handwritten: bool = False
    image_preview_path: Optional[str] = None


class ChatResponse(BaseModel):
    status: str = Field(..., description="'grounded' | 'not_covered' | 'insufficient_evidence' | 'error'")
    answer: str
    query: str
    session_id: str
    is_grounded: bool
    is_multi_source: bool
    sources_count: int
    sources: List[CitationModel]
    best_similarity_score: float
    similarity_threshold: float
    retrieved_chunks_count: int
    created_at: str
    has_conflicts: bool = False
    model_name: Optional[str] = None
    message: Optional[str] = None


class ConversationHistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: str
    status: Optional[str] = None


class ConversationHistoryResponse(BaseModel):
    session_id: str
    total_messages: int
    messages: List[ConversationHistoryMessage]
