import os
import sys
import fitz
from PIL import Image, ImageDraw, ImageFont
from backend.extractor import PDFExtractor

def create_representative_benchmark_pdf(pdf_path: str):
    """
    Creates a comprehensive 4-page test PDF covering:
    1. English standard MCQs
    2. Hindi questions with Devanagari options (क, ख, ग, घ)
    3. Mathematical expressions (roots, fractions, exponents)
    4. Scanned page (bitmap image rendered onto page)
    5. Tables and diagrams
    6. Question spanning across pages (starts page 1, ends page 2)
    7. Missing answers (Q8 has no answer in key)
    8. Separate answer key block on final page
    """
    doc = fitz.open()

    # --- PAGE 1: English, Math, and Spanning Question start ---
    page1 = doc.new_page()
    p1_text = """GENERAL COMPETITIVE EXAMINATION DRILL
SECTION A: QUANTITATIVE APTITUDE & REASONING

Q.1 What is the compound interest on Rs. 10,000 for 2 years at 10% per annum compounded annually?
(A) Rs. 2,100
(B) Rs. 2,000
(C) Rs. 2,200
(D) Rs. 2,050

Q.2 Evaluate the mathematical expression: \\sqrt{144} + \\frac{15}{3} - 2^3.
(A) 9
(B) 11
(C) 13
(D) 15

Q.3 The ratio of speed of boat in still water to speed of stream is 5:1. If the boat takes 4 hours
"""
    page1.insert_text((40, 50), p1_text, fontsize=11)

    # --- PAGE 2: Spanning Question continuation, Table & Hindi Questions ---
    page2 = doc.new_page()
    p2_text = """to travel 48 km downstream, what is the speed of the boat in still water?
(A) 12.5 km/h
(B) 10 km/h
(C) 15 km/h
(D) 14 km/h

Q.4 Study the table given below showing marks scored by students:
| Student | Math | Science | English |
| A       | 85   | 78      | 92      |
| B       | 70   | 88      | 80      |
What is the average score of Student A across all three subjects?
(A) 85
(B) 82
(C) 80
(D) 87

Q.5 भारत का प्रथम वायसराय कौन था?
(क) लॉर्ड डलहौजी
(ख) लॉर्ड कैनिंग
(ग) लॉर्ड कर्जन
(घ) लॉर्ड माउंटबेटन
"""
    page2.insert_text((40, 50), p2_text, fontsize=11)

    # --- PAGE 3: Scanned / Bitmap Rendered Page ---
    page3 = doc.new_page()
    # Create an image simulating a scanned document page
    img = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((30, 30), "Q.6 [SCANNED PAGE OCR SAMPLE]", fill=(20, 20, 20))
    draw.text((30, 60), "Which of the following elements has the chemical symbol Fe?", fill=(20, 20, 20))
    draw.text((30, 90), "(A) Lead", fill=(20, 20, 20))
    draw.text((30, 110), "(B) Gold", fill=(20, 20, 20))
    draw.text((30, 130), "(C) Iron", fill=(20, 20, 20))
    draw.text((30, 150), "(D) Silver", fill=(20, 20, 20))
    
    # Save image to temp and insert as page rect
    temp_img_path = pdf_path.replace(".pdf", "_scanned_temp.png")
    img.save(temp_img_path)
    page3.insert_image(fitz.Rect(40, 50, 500, 350), filename=temp_img_path)
    if os.path.exists(temp_img_path):
        os.remove(temp_img_path)

    # Add text fallback on Page 3 for environments where Tesseract is not installed on system PATH
    page3.insert_text((40, 380), """Q.7 Which gas is most abundant in the Earth's atmosphere?
(A) Oxygen
(B) Nitrogen
(C) Carbon Dioxide
(D) Argon
""", fontsize=11)

    # --- PAGE 4: Missing Answer Question & End-of-Book Answer Keys ---
    page4 = doc.new_page()
    p4_text = """Q.8 What is the boiling point of pure water at 1 atmospheric pressure?
(A) 90°C
(B) 100°C
(C) 110°C
(D) 120°C

Q.9 निम्नलिखित में से कौन सी नदी डेल्टा नहीं बनाती है?
(क) गंगा
(ख) नर्मदा
(ग) महानदी
(घ) कावेरी

=========================================
ANSWER KEY & SOLUTIONS
=========================================
1: A
2: A
3: B
4: A
5: B
6: C
7: B
9: B
(Note: Q.8 answer is intentionally omitted to test missing answer key detection)
"""
    page4.insert_text((40, 50), p4_text, fontsize=11)

    doc.save(pdf_path)
    doc.close()
    print(f"Benchmark PDF generated at: {pdf_path}")

def run_extraction_audit():
    benchmark_pdf = os.path.join(os.path.dirname(__file__), "..", "data", "benchmark_stress_test.pdf")
    create_representative_benchmark_pdf(benchmark_pdf)

    extractor = PDFExtractor(benchmark_pdf, "bench_001", "benchmark_stress_test.pdf")
    questions, metadata = extractor.process()

    print("\n" + "=" * 60)
    print(" EXTRACTION AUDIT BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total Pages Processed   : {metadata['total_pages']}")
    print(f"OCR Pages Run           : {metadata['ocr_pages_count']}")
    print(f"Answer Keys Detected    : {metadata['answer_keys_found']}")
    print(f"Extracted Questions     : {len(questions)}")
    print("-" * 60)

    for i, q in enumerate(questions):
        print(f"\n[Question #{i+1}] Q.{q['raw_question_number']} (p.{q['page_number']}->{q['page_end_number']})")
        print(f"  Status       : {q['verification_status']}")
        print(f"  Confidence   : {q['confidence']}")
        print(f"  Subject/Topic: {q['subject']} • {q['topic']}")
        print(f"  Correct Ans  : {q['correct_answer']}")
        print(f"  Stem Preview : {q['question_text'][:80]}...")
        print(f"  Options Count: {len(q['options'])}")
        for opt in q['options']:
            print(f"    ({opt['label']}) {opt['text']}")

    return questions, metadata

if __name__ == "__main__":
    run_extraction_audit()
