import os
import re
import uuid
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image, ImageOps, ImageFilter

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False

from .classifier import classify_question
from .deduplicator import find_duplicate, compute_hash

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "assets", "pages")
os.makedirs(ASSETS_DIR, exist_ok=True)

# Question marker regex: e.g., "Q.1", "Q 1", "Question 1:", "1.", "1)"
QUESTION_START_RE = re.compile(
    r"(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*(\d{1,4})[:.)\s]|(?:प्रश्न)?\s*(\d{1,4})[.)]\s+)",
    re.IGNORECASE
)

# Option marker regex: (A) / (1) / A. / 1) / (a) / (क) / (ख) / (ग) / (घ)
OPTION_PATTERN_RE = re.compile(
    r"(?:(?:\(([A-Ea-e1-5क-घ])\))|(?:\[([A-Ea-e1-5क-घ])\])|(?:(?:^|\n|\s{2,})([A-Ea-e1-5क-घ])[\.\)]))\s*",
    re.MULTILINE
)

# Answer key table or section regex
ANSWER_KEY_SECTION_RE = re.compile(
    r"(?:(?:answer\s*key)|(?:solutions?)|(?:answers?)|(?:उत्तर\s*माला))\s*[:\-]?\s*",
    re.IGNORECASE
)

# Pairs in answer key: e.g., "1.(A)", "1-a", "1: B", "1 B", "1.(क)"
ANSWER_KEY_PAIR_RE = re.compile(
    r"(\d{1,4})\s*[:\.\-]?\s*[\(\[]?\s*([A-Ea-e1-5क-घ])\s*[\)\]]?"
)

def preprocess_image_for_ocr(img: Image.Image) -> Image.Image:
    """Preprocesses a PIL Image for improved OCR contrast and character edge fidelity."""
    # 1. Grayscale
    gray = ImageOps.grayscale(img)
    # 2. Rescale/Sharpen
    sharpened = gray.filter(ImageFilter.SHARPEN)
    # 3. Dynamic contrast stretch
    autocontrast = ImageOps.autocontrast(sharpened, cutoff=2)
    return autocontrast

def run_ocr_on_page(page, dpi: int = 200) -> str:
    """Renders page as image and runs local Tesseract OCR with image preprocessing."""
    if not PYMUPDF_AVAILABLE:
        return ""
    try:
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        preprocessed = preprocess_image_for_ocr(img)

        if PYTESSERACT_AVAILABLE:
            try:
                # Custom config for alphanumeric + math
                text = pytesseract.image_to_string(preprocessed, config="--psm 6")
                return text
            except Exception as e:
                # Tesseract executable not configured or errored
                return ""
        return ""
    except Exception as e:
        return ""

def render_page_image(page, pdf_id: str, page_num: int) -> str:
    """Renders and caches the page as a web-accessible PNG image."""
    filename = f"{pdf_id}_p{page_num}.png"
    filepath = os.path.join(ASSETS_DIR, filename)
    if not os.path.exists(filepath):
        try:
            pix = page.get_pixmap(dpi=150)
            pix.save(filepath)
        except Exception as e:
            return ""
    return f"/assets/pages/{filename}"

def extract_answer_keys_from_text(full_doc_text: str) -> Dict[str, str]:
    """Finds separate answer key blocks and maps raw question number to chosen option letter."""
    keys = {}
    sections = ANSWER_KEY_SECTION_RE.split(full_doc_text)
    if len(sections) > 1:
        # Check text in answer key section
        key_block = " ".join(sections[1:])
        matches = ANSWER_KEY_PAIR_RE.findall(key_block)
        for q_num, ans in matches:
            label = ans.upper()
            # Convert 1-4 or Hindi क-घ to A-D
            num_to_letter = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "क": "A", "ख": "B", "ग": "C", "घ": "D"}
            if label in num_to_letter:
                label = num_to_letter[label]
            keys[q_num] = label
    return keys

def parse_options_from_block(block_text: str) -> Tuple[str, List[Dict[str, str]]]:
    """
    Separates question stem from options.
    Returns (cleaned_question_stem, list_of_options).
    """
    matches = list(OPTION_PATTERN_RE.finditer(block_text))
    if not matches:
        return block_text.strip(), []

    # Question stem is everything before the first option
    first_opt_start = matches[0].start()
    question_stem = block_text[:first_opt_start].strip()

    options = []
    num_to_letter = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "क": "A", "ख": "B", "ग": "C", "घ": "D"}

    for i in range(len(matches)):
        m = matches[i]
        label = (m.group(1) or m.group(2) or m.group(3)).upper()
        if label in num_to_letter:
            label = num_to_letter[label]

        start_idx = m.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(block_text)
        opt_text = block_text[start_idx:end_idx].strip()
        # Clean any trailing punctuation or inline answer markings
        opt_text = re.sub(r"\s+", " ", opt_text)

        options.append({
            "label": label,
            "text": opt_text
        })

    return question_stem, options

class PDFExtractor:
    def __init__(self, file_path: str, pdf_id: str, filename: str):
        self.file_path = file_path
        self.pdf_id = pdf_id
        self.filename = filename

    def process(self, progress_callback=None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError("PyMuPDF is required for PDF extraction.")

        doc = fitz.open(self.file_path)
        total_pages = len(doc)
        ocr_pages_count = 0

        # Step 1: Read all pages, detecting if text exists or OCR is needed
        page_texts = []
        page_image_urls = {}

        for p_idx in range(total_pages):
            page = doc[p_idx]
            page_num = p_idx + 1

            # Render image for verification comparison
            img_url = render_page_image(page, self.pdf_id, page_num)
            page_image_urls[page_num] = img_url

            # Extract layout text
            text = page.get_text("text")

            # Check if page is scanned/image-based
            if len(text.strip()) < 40:
                ocr_text = run_ocr_on_page(page)
                if ocr_text:
                    text = ocr_text
                    ocr_pages_count += 1

            page_texts.append({
                "page_num": page_num,
                "text": text,
                "image_url": img_url
            })

            if progress_callback:
                progress_callback(page_num, total_pages, f"Extracted page {page_num}/{total_pages}")

        # Step 2: Separate Answer Key detection across the document
        full_doc_text = "\n".join([pt["text"] for pt in page_texts])
        answer_keys = extract_answer_keys_from_text(full_doc_text)

        # Step 3: Segment Questions and handle questions spanning multiple pages
        extracted_questions = []
        current_question = None
        buffer = []

        for pt in page_texts:
            page_num = pt["page_num"]
            raw_page_text = pt["text"]

            # If this page starts the answer key section, truncate page text here
            ak_match = ANSWER_KEY_SECTION_RE.search(raw_page_text)
            if ak_match:
                page_question_text = raw_page_text[:ak_match.start()]
            else:
                page_question_text = raw_page_text

            lines = page_question_text.split("\n")

            for line in lines:
                match = QUESTION_START_RE.match(line)
                if match:
                    q_num = match.group(1) or match.group(2)
                    # Flush previous question
                    if current_question:
                        current_question["raw_text"] = "\n".join(buffer)
                        q_obj = self._finalize_question(current_question, answer_keys)
                        if q_obj:
                            extracted_questions.append(q_obj)
                        buffer = []

                    # Start new question
                    current_question = {
                        "q_num": q_num,
                        "page_start": page_num,
                        "page_end": page_num,
                        "page_image_url": pt["image_url"],
                    }
                    clean_line = line[match.end():].strip()
                    if clean_line:
                        buffer.append(clean_line)
                else:
                    if current_question:
                        clean_line = line.strip()
                        if clean_line:
                            buffer.append(clean_line)
                            current_question["page_end"] = page_num

            # If answer key was found on this page, finish current question
            if ak_match and current_question:
                current_question["raw_text"] = "\n".join(buffer)
                q_obj = self._finalize_question(current_question, answer_keys)
                if q_obj:
                    extracted_questions.append(q_obj)
                current_question = None
                buffer = []
                break

        # Flush final question
        if current_question and buffer:
            current_question["raw_text"] = "\n".join(buffer)
            q_obj = self._finalize_question(current_question, answer_keys)
            if q_obj:
                extracted_questions.append(q_obj)

        doc.close()

        metadata = {
            "total_pages": total_pages,
            "ocr_pages_count": ocr_pages_count,
            "extracted_count": len(extracted_questions),
            "answer_keys_found": len(answer_keys)
        }

        return extracted_questions, metadata

    def _finalize_question(self, q_raw: Dict[str, Any], answer_keys: Dict[str, str]) -> Optional[Dict[str, Any]]:
        raw_text = q_raw.get("raw_text", "").strip()
        if not raw_text or len(raw_text) < 10:
            return None

        stem, options = parse_options_from_block(raw_text)
        q_num = q_raw["q_num"]

        # Confidence calculation
        confidence = 0.85
        if len(options) == 4:
            confidence = 0.92
        elif len(options) >= 2:
            confidence = 0.78
        else:
            confidence = 0.50

        # Answer key matching
        correct_answer = None
        if q_num in answer_keys:
            correct_answer = answer_keys[q_num]
            confidence = min(0.98, confidence + 0.05)

        # Verification status:
        # - 'incomplete' (unavailable answer / missing options) if fewer than 2 options or no correct answer
        # - 'flagged' (requires correction) if confidence < 0.70
        # - 'unverified' if question extracted awaiting user verification
        # Never silently treat an uncertain answer as verified.
        if len(options) < 2 or not correct_answer:
            verification_status = "incomplete"
        elif confidence < 0.70:
            verification_status = "flagged"
        else:
            verification_status = "unverified"

        # Classification into subject & topic
        subject, topic, cls_conf = classify_question(stem, options)

        # Duplicate detection
        is_dup, dup_of_id, sim = find_duplicate(stem)

        q_id = str(uuid.uuid4())
        norm_hash = compute_hash(stem)

        return {
            "id": q_id,
            "pdf_id": self.pdf_id,
            "source_filename": self.filename,
            "page_number": q_raw["page_start"],
            "page_end_number": q_raw["page_end"],
            "raw_question_number": q_num,
            "question_text": stem,
            "options": options,
            "correct_answer": correct_answer,
            "explanation": None,
            "subject": subject,
            "topic": topic,
            "confidence": round(confidence, 2),
            "verification_status": verification_status,
            "page_image_url": q_raw.get("page_image_url"),
            "diagram_image_url": None,
            "is_duplicate": 1 if is_dup else 0,
            "duplicate_of_id": dup_of_id,
            "normalized_hash": norm_hash
        }
