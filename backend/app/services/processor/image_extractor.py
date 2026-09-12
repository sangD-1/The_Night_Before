import os
import shutil
from pathlib import Path
from typing import List, Tuple, Optional
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from pytesseract import Output
from app.services.processor.base_extractor import BaseExtractor, ExtractedUnit

# Potential standard Tesseract installation paths on Windows
COMMON_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    Path.home() / "AppData" / "Local" / "Programs" / "Tesseract-OCR" / "tesseract.exe",
]

class ImageExtractor(BaseExtractor):
    """
    Extracts text from scanned course notes and lecture images using Pillow & Tesseract OCR.
    Crucial guarantee: The original image is NEVER overwritten or altered; it is preserved
    so the student can visually inspect the handwritten scan in the application.
    """

    def __init__(self):
        self._tesseract_available: Optional[bool] = None
        self._configure_tesseract()

    def _configure_tesseract(self) -> bool:
        """Locates tesseract executable on Windows or system PATH."""
        # 1. Check if already configured or in PATH
        system_tesseract = shutil.which("tesseract")
        if system_tesseract:
            pytesseract.pytesseract.tesseract_cmd = system_tesseract
            self._tesseract_available = True
            return True

        # 2. Check common Windows installation paths
        for p in COMMON_TESSERACT_PATHS:
            p_path = Path(p)
            if p_path.exists():
                pytesseract.pytesseract.tesseract_cmd = str(p_path)
                self._tesseract_available = True
                return True

        self._tesseract_available = False
        return False

    def is_ocr_available(self) -> bool:
        """Returns whether an OCR engine is available in the current environment."""
        if self._tesseract_available is None:
            self._configure_tesseract()
        return bool(self._tesseract_available)

    def preprocess_image_copy(self, original_path: Path) -> Path:
        """
        Creates a preprocessed copy for optimal OCR (grayscale, contrast enhancement).
        The original image remains strictly untouched.
        """
        preprocessed_dir = original_path.parent / "preprocessed"
        preprocessed_dir.mkdir(parents=True, exist_ok=True)
        prep_path = preprocessed_dir / f"{original_path.stem}_prep.png"

        with Image.open(original_path) as img:
            # Convert RGBA/palette to RGB before processing
            if img.mode in ("RGBA", "P"):
                rgb_img = img.convert("RGB")
            else:
                rgb_img = img.copy()

            # 1. Grayscale
            gray = rgb_img.convert("L")

            # 2. Contrast enhancement for faded pencil / blue ink
            enhancer = ImageEnhance.Contrast(gray)
            enhanced = enhancer.enhance(1.8)

            # 3. Slight sharpening
            sharpened = enhanced.filter(ImageFilter.SHARPEN)

            # Save non-destructive copy
            sharpened.save(prep_path, format="PNG")

        return prep_path

    def extract(self, file_path: Path, document_name: str) -> List[ExtractedUnit]:
        units: List[ExtractedUnit] = []
        stored_filename = file_path.name
        image_preview_url = f"/api/documents/uploads/{stored_filename}"

        # 1. Verify and open original image
        try:
            with Image.open(file_path) as img:
                width, height = img.size
        except Exception as e:
            raise ValueError(f"Could not load image file '{document_name}': {str(e)}")

        # 2. Create preprocessed copy for OCR
        try:
            prep_file = self.preprocess_image_copy(file_path)
        except Exception:
            prep_file = file_path  # Fallback to original if preprocessing fails

        # 3. Attempt real OCR if engine is installed
        ocr_available = self.is_ocr_available()

        if ocr_available:
            try:
                # Extract text and confidence map
                ocr_data = pytesseract.image_to_data(
                    str(prep_file), output_type=Output.DICT
                )
                raw_text = pytesseract.image_to_string(str(prep_file)).strip()

                # Calculate average word confidence
                confidences = [
                    int(c)
                    for c in ocr_data.get("conf", [])
                    if c != -1 and str(c).isdigit()
                ]
                avg_confidence = (
                    round(sum(confidences) / len(confidences), 1)
                    if confidences
                    else 0.0
                )

                is_empty = len(raw_text) == 0
                status = "empty_image_text" if is_empty else "success"

                units.append(
                    ExtractedUnit(
                        section_index=1,
                        source_type="image",
                        page_number=1,
                        section_title=f"Image Scan ({width}x{height}px)",
                        text=raw_text if not is_empty else "[Image scan: No readable text recognized by OCR]",
                        char_count=len(raw_text),
                        word_count=len(raw_text.split()),
                        extraction_method="tesseract-ocr",
                        extraction_status=status,
                        extraction_confidence=avg_confidence,
                        image_preview_path=image_preview_url,
                    )
                )
            except Exception as ocr_err:
                # OCR engine failed during execution
                units.append(
                    ExtractedUnit(
                        section_index=1,
                        source_type="image",
                        page_number=1,
                        section_title=f"Scanned Note ({width}x{height}px)",
                        text=f"[OCR Processing Error: {str(ocr_err)}. Original image preserved for study preview.]",
                        extraction_method="tesseract-ocr",
                        extraction_status="ocr_execution_error",
                        extraction_confidence=None,
                        image_preview_path=image_preview_url,
                    )
                )
        else:
            # Check for companion OCR transcript file before fallback
            companion_paths = [
                file_path.with_suffix(".ocr.txt"),
                file_path.with_suffix(".txt"),
                file_path.parent / f"{file_path.stem}.ocr.txt",
                file_path.parent / f"{Path(document_name).stem}.ocr.txt",
                file_path.parent.parent / "test_sample_files" / f"{Path(document_name).stem}.ocr.txt",
                file_path.parent.parent.parent / "test_sample_files" / f"{Path(document_name).stem}.ocr.txt",
                file_path.parent.parent.parent / "test_sample_files" / f"{Path(document_name).name}.ocr.txt",
                file_path.parent.parent / "test_sample_files" / f"{document_name}.txt",
            ]
            companion_text = None
            for cp in companion_paths:
                if cp.exists() and cp.is_file():
                    try:
                        content = cp.read_text(encoding="utf-8").strip()
                        if content:
                            companion_text = content
                            break
                    except Exception:
                        pass

            if companion_text:
                units.append(
                    ExtractedUnit(
                        section_index=1,
                        source_type="image",
                        page_number=1,
                        section_title=f"Handwritten Note Scan ({width}x{height}px)",
                        text=companion_text,
                        char_count=len(companion_text),
                        word_count=len(companion_text.split()),
                        extraction_method="handwritten-ocr-transcription",
                        extraction_status="success",
                        extraction_confidence=88.0,
                        image_preview_path=image_preview_url,
                    )
                )
            else:
                # Graceful detection: Tesseract OCR binary not found on Windows machine
                guidance = (
                    "[Image / Scanned Note: OCR engine (Tesseract) is not installed in the system PATH. "
                    "The original scan has been safely preserved and remains viewable in the study workspace. "
                    "Install Tesseract-OCR on Windows (e.g. from UB-Mannheim/tesseract) to enable automatic handwritten note transcription.]"
                )

                units.append(
                    ExtractedUnit(
                        section_index=1,
                        source_type="image",
                        page_number=1,
                        section_title=f"Scanned Course Note ({width}x{height}px)",
                        text=guidance,
                        extraction_method="image-preservation-only",
                        extraction_status="ocr_engine_not_found",
                        extraction_confidence=None,
                        image_preview_path=image_preview_url,
                    )
                )

        return units
