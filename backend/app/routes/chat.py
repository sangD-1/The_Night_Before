from fastapi import APIRouter, HTTPException
from app.models.chat import (
    ChatRequest,
    ChatResponse,
    ConversationHistoryResponse,
)
from app.services.rag import rag_service, conversation_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Core RAG Chat endpoint for students.
    Retrieves relevant course material, verifies evidence thresholds,
    and produces grounded answers with exact source citations.
    """
    try:
        response = rag_service.answer_question(
            question=request.question,
            session_id=request.session_id,
            document_ids=request.document_ids,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
        )
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except TimeoutError as te:
        raise HTTPException(status_code=504, detail=str(te))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG answer generation error: {str(e)}")


@router.get("/history/{session_id}", response_model=ConversationHistoryResponse)
def get_session_history(session_id: str):
    """Retrieves the recent conversation history for a specific study session."""
    messages = conversation_service.get_formatted_history(session_id)
    return {
        "session_id": session_id,
        "total_messages": len(messages),
        "messages": messages,
    }


@router.delete("/history/{session_id}")
def clear_session_history(session_id: str):
    """Clears conversation turns for the specified session to reset thread state."""
    success = conversation_service.clear_session(session_id)
    return {
        "success": True,
        "session_id": session_id,
        "message": "Conversation history cleared successfully.",
    }
