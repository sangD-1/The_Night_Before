"""
Automated Regression Test Suite for Named-Document RAG Grounding & Isolation.
Verifies that:
1. Queries explicitly referencing a document (e.g. "According to Stack n Queue.pptx, what is stack overflow?")
   prioritize and scope retrieval strictly to that document.
2. Unrelated documents are NEVER cited or used as evidence.
3. If the named document lacks the requested information, the system returns a genuine "not_covered" refusal.
4. Non-existent document references return a genuine "not_covered" refusal immediately.
5. PPTX extraction, slide-level chunking, and ChromaDB vector retrieval preserve exact slide metadata.
"""

import sys
import unittest
from pathlib import Path

# Ensure backend root is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.rag.rag_service import rag_service
from app.services.retrieval import vector_store
from app.services.processor import document_processor
from app.services.document_service import DocumentService


class TestNamedDocumentRAG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Verify that Stack n Queue.pptx exists and is indexed
        docs = DocumentService.get_all_documents()
        stack_docs = [d for d in docs if d.get("original_filename") == "Stack n Queue.pptx"]
        if not stack_docs:
            raise RuntimeError("Stack n Queue.pptx is not uploaded in the database.")
        
        cls.stack_doc = stack_docs[0]
        # Ensure it is processed and indexed
        if cls.stack_doc.get("processing_status") != "indexed":
            document_processor.process_document(cls.stack_doc["id"])
            vector_store.index_document(cls.stack_doc["id"])

    def test_01_named_document_stack_overflow_grounded(self):
        """Test: 'According to Stack n Queue.pptx, what is stack overflow?' returns grounded answer citing only the PPTX slides."""
        query = "According to Stack n Queue.pptx, what is stack overflow?"
        response = rag_service.answer_question(query)

        self.assertEqual(response.status, "grounded", f"Expected status 'grounded', got '{response.status}'")
        self.assertTrue(response.is_grounded, "Expected response.is_grounded to be True")
        self.assertGreater(response.sources_count, 0, "Expected at least one source citation")

        # Verify strict document isolation: ALL citations must be Stack n Queue.pptx
        for source in response.sources:
            self.assertEqual(
                source.document_name,
                "Stack n Queue.pptx",
                f"Unrelated document leaked into citations: '{source.document_name}'",
            )
            self.assertEqual(source.source_type, "pptx", f"Expected source_type 'pptx', got '{source.source_type}'")
            self.assertIsNotNone(source.slide_number, "Slide number must not be None")
            self.assertGreaterEqual(source.slide_number, 1, "Slide number must be >= 1")

        # Verify that Slide 11 (Overflow in stack) or Slide 10 is among the cited slides
        cited_slides = [s.slide_number for s in response.sources]
        self.assertTrue(
            11 in cited_slides or 10 in cited_slides,
            f"Expected Slide 11 or Slide 10 in citations, got: {cited_slides}",
        )

        # Verify answer discusses overflow / full stack
        lower_ans = response.answer.lower()
        self.assertTrue(
            "overflow" in lower_ans or "full" in lower_ans,
            "Answer should explain stack overflow",
        )

    def test_02_named_document_unrelated_topic_refusal(self):
        """Test: 'According to Stack n Queue.pptx, explain virtual memory paging fragmentation' must refuse with not_covered."""
        query = "According to Stack n Queue.pptx, explain virtual memory paging fragmentation"
        response = rag_service.answer_question(query)

        self.assertEqual(
            response.status,
            "not_covered",
            f"Expected status 'not_covered', got '{response.status}'",
        )
        self.assertFalse(response.is_grounded, "is_grounded must be False for off-topic query")
        self.assertEqual(response.sources_count, 0, "No sources should be cited for refused query")
        self.assertEqual(response.sources, [], "Sources list must be empty")

        # Verify no unrelated documents (like real_os_multipage.pdf) were cited
        for s in response.sources:
            self.assertNotEqual(s.document_name, "real_os_multipage.pdf")

    def test_03_non_existent_document_refusal(self):
        """Test: 'According to NonExistentFile.pdf, what is an operating system?' must refuse immediately without citing other docs."""
        query = "According to NonExistentFile.pdf, what is an operating system?"
        response = rag_service.answer_question(query)

        self.assertEqual(
            response.status,
            "not_covered",
            f"Expected status 'not_covered', got '{response.status}'",
        )
        self.assertFalse(response.is_grounded, "is_grounded must be False for missing document")
        self.assertEqual(response.sources_count, 0, "Sources count must be 0")
        self.assertEqual(len(response.sources), 0, "Sources list must be empty")
        self.assertIn("NonExistentFile.pdf", response.answer, "Refusal answer should mention the missing file name")

    def test_04_named_document_genuinely_not_covered_algorithm(self):
        """Test: Genuinely not-covered algorithm in named PPTX returns honest refusal."""
        query = "According to Stack n Queue.pptx, explain Dijkstra's algorithm for shortest path"
        response = rag_service.answer_question(query)

        self.assertEqual(response.status, "not_covered")
        self.assertFalse(response.is_grounded)
        self.assertEqual(response.sources_count, 0)

    def test_05_general_query_retains_normal_synthesis(self):
        """Test: General query without named document still searches all documents properly."""
        query = "What are the four Coffman conditions for deadlock?"
        response = rag_service.answer_question(query)

        self.assertEqual(response.status, "grounded")
        self.assertTrue(response.is_grounded)
        self.assertGreater(response.sources_count, 0)
        cited_names = [s.document_name for s in response.sources]
        self.assertIn("real_os_multipage.pdf", cited_names)

    def test_06_pptx_slides_extraction_and_vector_integrity(self):
        """Test: PPTX slide text extraction and slide numbers are correctly preserved."""
        sections = document_processor.get_document_sections(self.stack_doc["id"])
        self.assertGreaterEqual(len(sections), 68, "PPTX must have at least 68 sections")

        # Slide 11 verification
        slide_11_sections = [s for s in sections if s.get("slide_number") == 11]
        self.assertTrue(len(slide_11_sections) > 0, "Slide 11 section must exist")
        slide_11_text = slide_11_sections[0].get("text", "").lower()
        self.assertIn("overflow", slide_11_text, "Slide 11 text must mention overflow")

        # Verify no unhandled Unicode private-use bullet glyphs in sections
        for s in sections:
            txt = s.get("text", "")
            for ch in txt:
                self.assertFalse(
                    0xE000 <= ord(ch) <= 0xF8FF,
                    f"Found unsanitized Private Use Area character U+{ord(ch):04X} in slide {s.get('slide_number')}",
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
