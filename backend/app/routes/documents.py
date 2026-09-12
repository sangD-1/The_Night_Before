from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.models.document import (
    DocumentResponse,
    DocumentListResponse,
    DeleteResponse,
    DocumentProcessResponse,
    DocumentSectionsListResponse,
)
from app.services.document_service import DocumentService, UPLOADS_DIR
from app.services.processor import document_processor
from app.services.retrieval import vector_store

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a course material document (PDF, PPT, PPTX, MD, TXT, JPG, PNG).
    Validates file extension, size, and safely stores the file locally.
    Auto-triggers structured extraction and vector indexing.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename in upload.")

    saved_doc = await DocumentService.process_and_save_upload(file)

    # Trigger automatic extraction and indexing pipeline
    try:
        document_processor.process_document(saved_doc["id"])
        try:
            vector_store.index_document(saved_doc["id"])
        except Exception:
            pass  # Indexing can also be done manually if needed

        # Fetch updated document status
        updated = DocumentService.get_document(saved_doc["id"])
        if updated:
            return updated
    except Exception as e:
        # Document remains uploaded even if extraction encountered an issue
        pass

    return saved_doc

@router.get("", response_model=DocumentListResponse)
def list_documents():
    """List all uploaded course documents from persistent SQLite storage."""
    docs = DocumentService.get_all_documents()
    return {"documents": docs, "total": len(docs)}

@router.post("/{document_id}/process", response_model=DocumentProcessResponse)
def process_document(document_id: str):
    """
    Triggers structured text extraction for an uploaded document.
    Extracts page-by-page (PDF), slide-by-slide (PPTX), section-by-section (MD/TXT),
    or OCR (Images/Scans).
    """
    doc = DocumentService.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        result = document_processor.process_document(document_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@router.get("/{document_id}/sections", response_model=DocumentSectionsListResponse)
def get_document_sections(document_id: str):
    """
    Retrieve all extracted pages, slides, or sections for a document,
    preserving exact page/slide numbers for citation inspection.
    """
    doc = DocumentService.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    sections = document_processor.get_document_sections(document_id)
    return {
        "document_id": document_id,
        "document_name": doc["original_filename"],
        "total_sections": len(sections),
        "sections": sections,
    }

@router.get("/uploads/{stored_filename}")
def get_uploaded_file(stored_filename: str):
    """
    Safely serves an uploaded file (e.g. for image note previews).
    Guarantees no directory traversal.
    """
    safe_name = Path(stored_filename).name
    file_path = UPLOADS_DIR / safe_name

    try:
        resolved_path = file_path.resolve()
        resolved_uploads = UPLOADS_DIR.resolve()
        if not str(resolved_path).startswith(str(resolved_uploads)):
            raise HTTPException(status_code=400, detail="Invalid file path.")
    except Exception:
        raise HTTPException(status_code=400, detail="Path resolution error.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested file does not exist.")

    return FileResponse(path=str(file_path))

@router.delete("/{document_id}", response_model=DeleteResponse)
def delete_document(document_id: str):
    """Delete a document record, its extracted sections, and its underlying file."""
    success = DocumentService.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "success": True,
        "message": "Document deleted successfully.",
        "document_id": document_id,
    }

@router.post("/{document_id}/index")
def index_document_endpoint(document_id: str):
    """Index or re-index a document's extracted chunks into ChromaDB."""
    try:
        return vector_store.index_document(document_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

@router.post("/index-all")
def index_all_documents_endpoint():
    """Index all processed documents into ChromaDB."""
    try:
        return vector_store.index_all_documents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch indexing failed: {str(e)}")
