import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.database import get_db

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# 25 MB sensible limit for local development course materials
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

# Whitelisted file extensions and type normalization
ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".ppt": "pptx",
    ".pptx": "pptx",
    ".md": "markdown",
    ".txt": "text",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
}

class DocumentService:
    @staticmethod
    def get_extension(filename: str) -> str:
        """Extract and lowercase file extension."""
        if not filename:
            return ""
        return Path(filename).suffix.lower()

    @classmethod
    async def process_and_save_upload(cls, file: UploadFile) -> dict:
        """
        Validates, safely stores, and records metadata for an uploaded course material file.
        """
        original_filename = Path(file.filename or "unknown").name
        ext = cls.get_extension(original_filename)

        if not ext or ext not in ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS.keys()))
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: {allowed_list}",
            )

        file_type = ALLOWED_EXTENSIONS[ext]
        doc_id = str(uuid.uuid4())
        safe_stored_filename = f"{doc_id.replace('-', '')}{ext}"
        destination_path = UPLOADS_DIR / safe_stored_filename

        # Security: ensure path traversal cannot escape the uploads directory
        try:
            resolved_dest = destination_path.resolve()
            resolved_uploads = UPLOADS_DIR.resolve()
            if not str(resolved_dest).startswith(str(resolved_uploads)):
                raise HTTPException(status_code=400, detail="Invalid destination path.")
        except Exception:
            raise HTTPException(status_code=400, detail="Path resolution error.")

        total_bytes = 0
        chunk_size = 64 * 1024  # 64 KB

        try:
            with open(destination_path, "wb") as f_out:
                while True:
                    chunk = await file.read(chunk_size)
                    if not chunk:
                        break
                    total_bytes += len(chunk)

                    if total_bytes > MAX_FILE_SIZE_BYTES:
                        raise HTTPException(
                            status_code=400,
                            detail=f"File exceeds the maximum allowed size of 25 MB ({MAX_FILE_SIZE_BYTES} bytes).",
                        )

                    f_out.write(chunk)

            if total_bytes == 0:
                if destination_path.exists():
                    destination_path.unlink()
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file is empty (0 bytes).",
                )

        except HTTPException:
            if destination_path.exists():
                destination_path.unlink()
            raise
        except Exception as e:
            if destination_path.exists():
                destination_path.unlink()
            raise HTTPException(
                status_code=500,
                detail=f"An error occurred while saving the file: {str(e)}",
            )

        # Record metadata persistently in SQLite
        created_at = datetime.now(timezone.utc).isoformat()
        upload_status = "waiting_for_processing"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO documents (
                    id, original_filename, stored_filename, file_type,
                    mime_type, file_size, upload_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc_id,
                    original_filename,
                    safe_stored_filename,
                    file_type,
                    file.content_type or "application/octet-stream",
                    total_bytes,
                    upload_status,
                    created_at,
                ),
            )

        return {
            "id": doc_id,
            "original_filename": original_filename,
            "stored_filename": safe_stored_filename,
            "file_type": file_type,
            "mime_type": file.content_type or "application/octet-stream",
            "file_size": total_bytes,
            "upload_status": upload_status,
            "created_at": created_at,
            "page_count": None,
            "processing_status": None,
            "extraction_status": None,
            "document_type": None,
            "ocr_status": None,
        }

    @staticmethod
    def get_all_documents() -> list[dict]:
        """Retrieve all documents ordered by upload date descending."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_document(doc_id: str) -> dict | None:
        """Retrieve a specific document by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def delete_document(doc_id: str) -> bool:
        """Delete a document record, its extracted sections, vector embeddings, and underlying stored file."""
        from app.services.retrieval import vector_store

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT stored_filename FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if not row:
                return False

            stored_filename = row["stored_filename"]
            file_path = UPLOADS_DIR / stored_filename
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass

            # Clean up vector embeddings in ChromaDB
            try:
                vector_store.delete_document_vectors(doc_id)
            except Exception:
                pass

            # Clean up sections and master document record
            cursor.execute("DELETE FROM document_sections WHERE document_id = ?", (doc_id,))
            cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            return True
