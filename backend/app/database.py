import sqlite3
from pathlib import Path
from contextlib import contextmanager

# Store SQLite database safely in the project data directory
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "documents.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)

@contextmanager
def get_db():
    """Context manager for SQLite database connection with row dictionary access."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initialize database tables with future-compatible schema for RAG/OCR pipelines."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Documents master table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                mime_type TEXT,
                file_size INTEGER NOT NULL,
                upload_status TEXT NOT NULL DEFAULT 'waiting_for_processing',
                created_at TEXT NOT NULL,
                page_count INTEGER DEFAULT NULL,
                processing_status TEXT DEFAULT 'unprocessed',
                extraction_status TEXT DEFAULT NULL,
                document_type TEXT DEFAULT NULL,
                ocr_status TEXT DEFAULT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_created_at ON documents(created_at DESC)")

        # Document sections / pages / slides extracted content table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_sections (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                document_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                section_index INTEGER NOT NULL,
                page_number INTEGER,
                slide_number INTEGER,
                section_title TEXT,
                text TEXT NOT NULL,
                char_count INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                extraction_method TEXT NOT NULL,
                extraction_status TEXT NOT NULL,
                extraction_confidence REAL,
                original_file_reference TEXT NOT NULL,
                image_preview_path TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sections_doc_id ON document_sections(document_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sections_page ON document_sections(document_id, page_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sections_slide ON document_sections(document_id, slide_number)")
