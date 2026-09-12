import sys
from pathlib import Path
from app.services.processor.pdf_extractor import PDFExtractor
from app.services.processor.pptx_extractor import PPTXExtractor
from app.services.processor.text_extractor import TextExtractor
from app.services.processor.image_extractor import ImageExtractor

TEST_DIR = Path(__file__).resolve().parent.parent / "test_sample_files"

def test_pdf_extraction():
    extractor = PDFExtractor()
    pdf_file = TEST_DIR / "real_os_multipage.pdf"
    units = extractor.extract(pdf_file, "real_os_multipage.pdf")

    assert len(units) == 3, f"Expected 3 pages, got {len(units)}"
    assert units[0].page_number == 1
    assert "Process Management" in units[0].text
    assert units[1].page_number == 2
    assert "Coffman conditions" in units[1].text
    assert units[2].page_number == 3
    assert "Memory Virtualization" in units[2].text
    print("PASS: PDFExtractor verified (3 distinct pages, accurate page numbers, no flattening).")

def test_pptx_extraction():
    extractor = PPTXExtractor()
    pptx_file = TEST_DIR / "real_graph_slides.pptx"
    units = extractor.extract(pptx_file, "real_graph_slides.pptx")

    assert len(units) == 3, f"Expected 3 slides, got {len(units)}"
    assert units[0].slide_number == 1
    assert "Graph Traversal" in units[0].text
    assert units[1].slide_number == 2
    assert "Breadth-First Search" in units[1].text
    assert units[2].slide_number == 3
    assert "Depth-First Search" in units[2].text
    print("PASS: PPTXExtractor verified (3 distinct slides, accurate slide numbers, titles preserved).")

def test_markdown_extraction():
    extractor = TextExtractor()
    md_file = TEST_DIR / "real_dbms_normalization.md"
    units = extractor.extract(md_file, "real_dbms_normalization.md")

    assert len(units) >= 3, f"Expected at least 3 heading sections, got {len(units)}"
    assert any("First Normal Form" in u.section_title for u in units)
    assert any("Second Normal Form" in u.section_title for u in units)
    assert any("Third Normal Form" in u.section_title for u in units)
    print(f"PASS: TextExtractor (Markdown) verified ({len(units)} heading sections preserved).")

def test_plain_text_extraction():
    extractor = TextExtractor()
    txt_file = TEST_DIR / "real_syllabus_review.txt"
    units = extractor.extract(txt_file, "real_syllabus_review.txt")

    assert len(units) >= 1
    assert "CS301 Course Syllabus" in units[0].text
    print("PASS: TextExtractor (Plain text) verified.")

def test_image_extraction():
    extractor = ImageExtractor()
    img_file = TEST_DIR / "real_handwritten_note.png"
    units = extractor.extract(img_file, "real_handwritten_note.png")

    assert len(units) == 1
    assert units[0].source_type == "image"
    assert units[0].image_preview_path is not None
    # Verify original image was not altered/overwritten
    assert img_file.exists()
    print(f"PASS: ImageExtractor verified (status: {units[0].extraction_status}, preview: {units[0].image_preview_path}).")

if __name__ == "__main__":
    test_pdf_extraction()
    test_pptx_extraction()
    test_markdown_extraction()
    test_plain_text_extraction()
    test_image_extraction()
    print("\nALL 5 EXTRACTOR VERIFICATION TESTS PASSED SUCCESSFULLY!")
