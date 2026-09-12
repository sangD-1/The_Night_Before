from fastapi import APIRouter, HTTPException
from app.models.retrieval import (
    SearchRequest,
    SearchResponse,
    IndexResponse,
    IndexAllResponse,
    RetrievalStatusResponse,
)
from app.services.retrieval import vector_store
from app.config import RETRIEVAL_SIMILARITY_THRESHOLD, DEFAULT_TOP_K

router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse)
def search_materials(request: SearchRequest):
    """
    Performs semantic search over student course materials.
    Returns ranked passages with cosine similarity scores, distances, and exact page/slide citations.
    Evaluates similarity threshold: if best match is below threshold, has_sufficient_evidence is False.
    """
    threshold = (
        request.similarity_threshold
        if request.similarity_threshold is not None
        else RETRIEVAL_SIMILARITY_THRESHOLD
    )
    top_k = request.top_k or DEFAULT_TOP_K

    try:
        results = vector_store.search(
            query=request.query,
            top_k=top_k,
            similarity_threshold=threshold,
            document_ids=request.document_ids,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/index/{document_id}", response_model=IndexResponse)
def index_document(document_id: str):
    """
    Indexes a specific document into the ChromaDB vector store.
    Chunks sections with page/slide awareness and embeds them locally.
    """
    try:
        result = vector_store.index_document(document_id)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")


@router.post("/index-all", response_model=IndexAllResponse)
def index_all_documents():
    """
    Batch indexes all uploaded and extracted course documents.
    """
    try:
        result = vector_store.index_all_documents()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch indexing failed: {str(e)}")


@router.get("/status", response_model=RetrievalStatusResponse)
def get_retrieval_status():
    """
    Returns statistics about vector store health, total chunks, model, and threshold.
    """
    try:
        return vector_store.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch status: {str(e)}")
