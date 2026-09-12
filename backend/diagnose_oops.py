import pymupdf
from pathlib import Path

doc = pymupdf.open("test_sample_files/Mastering OOPS Concepts in C++.pdf")
print("Total pages in PDF:", len(doc))
out_dir = Path("backend/scratch/oops_pdf_pages")
out_dir.mkdir(parents=True, exist_ok=True)

for i in range(min(5, len(doc))):
    page = doc[i]
    pix = page.get_pixmap(dpi=150)
    img_path = out_dir / f"page_{i+1}.png"
    pix.save(str(img_path))
    print(f"Saved {img_path}")
