import io
import os
import sys
import logging
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_upload_pipeline")

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db

def run_tests():
    logger.info("=== Starting short-lived backend upload pipeline tests ===")
    
    with TestClient(app) as client:
        # Test 1: Health Check Endpoint
        logger.info("[Test 1] Testing GET /api/health...")
        health_resp = client.get("/api/health")
        assert health_resp.status_code == 200, f"Health check failed: {health_resp.text}"
        health_data = health_resp.json()
        assert health_data.get("status") == "ok", f"Health status not ok: {health_data}"
        logger.info("  [PASS] GET /api/health returned 200 OK: %s", health_data)

        # Test 2: List Documents Endpoint
        logger.info("[Test 2] Testing GET /api/documents...")
        list_resp = client.get("/api/documents")
        assert list_resp.status_code == 200, f"List documents failed: {list_resp.text}"
        list_data = list_resp.json()
        assert "documents" in list_data, f"No documents key: {list_data}"
        initial_doc_count = len(list_data["documents"])
        logger.info("  [PASS] GET /api/documents returned 200 OK with %d existing documents.", initial_doc_count)

        # Test 3: TXT Document Upload & Automatic Indexing
        logger.info("[Test 3] Testing POST /api/documents/upload with TXT file...")
        txt_content = (
            "Operating Systems Lecture Notes - Concurrency Control\n"
            "Semaphores provide mutual exclusion using wait() and signal() primitives.\n"
            "A binary semaphore acts as a mutex lock to protect critical sections.\n"
            "Counting semaphores manage resource pools with multiple instances.\n"
        )
        txt_file = io.BytesIO(txt_content.encode("utf-8"))
        txt_resp = client.post(
            "/api/documents/upload",
            files={"file": ("test_concurrency_notes.txt", txt_file, "text/plain")},
        )
        assert txt_resp.status_code == 201, f"TXT upload failed: {txt_resp.text}"
        txt_doc = txt_resp.json()
        assert txt_doc["original_filename"] == "test_concurrency_notes.txt"
        assert txt_doc["file_type"] == "text"
        assert txt_doc["upload_status"] == "indexed", f"Unexpected status: {txt_doc['upload_status']}"
        txt_doc_id = txt_doc["id"]
        logger.info("  [PASS] TXT upload succeeded with ID: %s, status: %s", txt_doc_id, txt_doc["upload_status"])

        # Verify TXT search & indexing
        search_resp = client.post(
            "/api/retrieval/search",
            json={"query": "binary semaphore mutex lock critical section", "top_k": 3},
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["has_sufficient_evidence"] is True
        assert any(r["document_id"] == txt_doc_id for r in search_data["results"])
        logger.info("  [PASS] TXT retrieval verified with evidence and score: %.4f", search_data["best_similarity_score"])

        # Test 4: PDF Document Upload & Page-Level Extraction & Indexing
        logger.info("[Test 4] Testing POST /api/documents/upload with PDF file...")
        import pymupdf
        pdf_stream = io.BytesIO()
        doc = pymupdf.open()
        p1 = doc.new_page(width=595, height=842)
        p1.insert_text((50, 70), "Advanced Distributed Algorithms - Section 1", fontsize=14)
        p1.insert_text((50, 100), "Raft consensus decomposes state machine replication into leader election and log replication.", fontsize=11)
        p2 = doc.new_page(width=595, height=842)
        p2.insert_text((50, 70), "Advanced Distributed Algorithms - Section 2", fontsize=14)
        p2.insert_text((50, 100), "Byzantine Fault Tolerance tolerates up to f arbitrary failures given 3f+1 total nodes.", fontsize=11)
        doc.save(pdf_stream)
        doc.close()
        pdf_bytes = pdf_stream.getvalue()

        pdf_resp = client.post(
            "/api/documents/upload",
            files={"file": ("test_distributed_systems.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )
        assert pdf_resp.status_code == 201, f"PDF upload failed: {pdf_resp.text}"
        pdf_doc = pdf_resp.json()
        assert pdf_doc["original_filename"] == "test_distributed_systems.pdf"
        assert pdf_doc["file_type"] == "pdf"
        assert pdf_doc["page_count"] == 2
        assert pdf_doc["upload_status"] == "indexed", f"Unexpected status: {pdf_doc['upload_status']}"
        pdf_doc_id = pdf_doc["id"]
        logger.info("  [PASS] PDF upload succeeded (2 pages) with ID: %s, status: %s", pdf_doc_id, pdf_doc["upload_status"])

        # Verify PDF sections and page citations
        sec_resp = client.get(f"/api/documents/{pdf_doc_id}/sections")
        assert sec_resp.status_code == 200
        sec_data = sec_resp.json()
        assert sec_data["total_sections"] == 2
        assert sec_data["sections"][0]["page_number"] == 1
        assert sec_data["sections"][1]["page_number"] == 2
        logger.info("  [PASS] PDF sections preserved page coordinates: Page 1 and Page 2.")

        # Verify PDF search retrieval
        pdf_search = client.post(
            "/api/retrieval/search",
            json={"query": "Byzantine Fault Tolerance 3f+1 total nodes", "top_k": 3},
        )
        assert pdf_search.status_code == 200
        pdf_search_data = pdf_search.json()
        assert pdf_search_data["has_sufficient_evidence"] is True
        top_pdf_match = pdf_search_data["results"][0]
        assert top_pdf_match["page_number"] == 2
        logger.info("  [PASS] PDF retrieval verified citation: '%s', Page %s (score: %.4f)",
                    top_pdf_match["document_name"], top_pdf_match["page_number"], top_pdf_match["similarity_score"])

        # Test 5: Image / Handwritten Note Upload & OCR / Companion Extraction
        logger.info("[Test 5] Testing POST /api/documents/upload with image scan...")
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (400, 200), color=(255, 255, 250))
        draw = ImageDraw.Draw(img)
        draw.text((30, 40), "Exam Formula: Amdahl Law Speedup", fill=(10, 20, 100))
        draw.text((30, 80), "Speedup = 1 / ((1 - P) + P / N)", fill=(10, 20, 100))
        img_stream = io.BytesIO()
        img.save(img_stream, format="PNG")
        img_bytes = img_stream.getvalue()

        img_resp = client.post(
            "/api/documents/upload",
            files={"file": ("test_amdahl_formula.png", io.BytesIO(img_bytes), "image/png")},
        )
        assert img_resp.status_code == 201, f"Image upload failed: {img_resp.text}"
        img_doc = img_resp.json()
        assert img_doc["original_filename"] == "test_amdahl_formula.png"
        assert img_doc["file_type"] == "image"
        img_doc_id = img_doc["id"]
        logger.info("  [PASS] Image upload succeeded with ID: %s, upload_status: %s, processing_status: %s",
                    img_doc_id, img_doc["upload_status"], img_doc.get("processing_status"))

        # Test 6: Real ~620 KB PDF Upload (Compiler_Design-1.pdf)
        logger.info("[Test 6] Testing upload of real ~620 KB PDF (Compiler_Design-1.pdf)...")
        real_pdf_path = BACKEND_DIR.parent / "test_sample_files" / "Compiler_Design-1.pdf"
        if real_pdf_path.exists():
            with open(real_pdf_path, "rb") as f:
                c_resp = client.post(
                    "/api/documents/upload",
                    files={"file": ("Compiler_Design-1.pdf", f, "application/pdf")},
                )
            assert c_resp.status_code == 201, f"Real PDF upload failed: {c_resp.text}"
            c_doc = c_resp.json()
            assert c_doc["upload_status"] == "indexed"
            c_doc_id = c_doc["id"]
            logger.info("  [PASS] ~620 KB PDF uploaded and indexed successfully: %d pages", c_doc.get("page_count", 0))
        else:
            c_doc_id = None

        # Test 7: Real ~731 KB PPTX Upload (Stack n Queue.pptx)
        logger.info("[Test 7] Testing upload of real ~731 KB PPTX (Stack n Queue.pptx)...")
        real_pptx_path = BACKEND_DIR.parent / "test_sample_files" / "Stack n Queue.pptx"
        if real_pptx_path.exists():
            with open(real_pptx_path, "rb") as f:
                pptx_resp = client.post(
                    "/api/documents/upload",
                    files={"file": ("Stack n Queue.pptx", f, "application/vnd.openxmlformats-officedocument.presentationml.presentation")},
                )
            assert pptx_resp.status_code == 201, f"Real PPTX upload failed: {pptx_resp.text}"
            pptx_doc = pptx_resp.json()
            assert pptx_doc["upload_status"] == "indexed"
            pptx_doc_id = pptx_doc["id"]
            logger.info("  [PASS] ~731 KB PPTX uploaded and indexed successfully: %d slides", pptx_doc.get("page_count", 0))
        else:
            pptx_doc_id = None

        # Test 8: Clean up all test documents
        logger.info("[Test 8] Cleaning up all test documents...")
        clean_ids = [txt_doc_id, pdf_doc_id, img_doc_id]
        if c_doc_id:
            clean_ids.append(c_doc_id)
        if pptx_doc_id:
            clean_ids.append(pptx_doc_id)

        for doc_id in clean_ids:
            del_resp = client.delete(f"/api/documents/{doc_id}")
            assert del_resp.status_code == 200, f"Delete failed: {del_resp.text}"
            del_data = del_resp.json()
            assert del_data["success"] is True
        logger.info("  [PASS] Cleaned up all %d test documents and their vectors.", len(clean_ids))

        # Test 9: Verify /api/documents reflects cleanup
        final_list = client.get("/api/documents").json()
        assert len(final_list["documents"]) == initial_doc_count
        logger.info("  [PASS] Final document count matches initial (%d).", initial_doc_count)

    logger.info("=== ALL SHORT-LIVED BACKEND UPLOAD PIPELINE TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
