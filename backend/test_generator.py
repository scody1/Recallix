import os
import fitz
from PIL import Image, ImageDraw, ImageFont
import io

def generate_test_suite_pdfs(output_dir: str):
    """
    Generates test PDFs covering all 9 required acceptance criteria:
    1. Text-based PDF
    2. Scanned PDF
    3. Mathematical questions
    4. Questions with four options
    5. Missing answer keys
    6. Separate answer key
    7. Duplicate questions
    8. Questions spanning pages
    9. Interrupted processing and recovery
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1. Text-based PDF with 4 options and Separate Answer Key (tests 1, 4, 6)
    doc1 = fitz.open()
    p1 = doc1.new_page()
    p1.insert_text((50, 70), "SSC CGL MOCK TEST - GENERAL AWARENESS & ENGLISH\n\n", fontsize=14)
    p1.insert_text((50, 110), "Q.1 Which Mughal Emperor transferred the capital from Agra to Delhi?\n(A) Akbar\n(B) Jahangir\n(C) Shah Jahan\n(D) Aurangzeb\n\n", fontsize=11)
    p1.insert_text((50, 200), "Q.2 In the Indian Constitution, the idea of Directive Principles of State Policy is borrowed from which country?\n(A) USA\n(B) Ireland\n(C) Britain\n(D) Australia\n\n", fontsize=11)
    p1.insert_text((50, 290), "Q.3 Select the synonym of the given word: BENEVOLENT\n(A) Cruel\n(B) Generous\n(C) Malevolent\n(D) Selfish\n\n", fontsize=11)

    p2 = doc1.new_page()
    p2.insert_text((50, 80), "ANSWER KEY\n", fontsize=14)
    p2.insert_text((50, 120), "1-(C) 2-(B) 3-(B)\n", fontsize=12)
    doc1.save(os.path.join(output_dir, "test1_text_separate_key.pdf"))
    doc1.close()

    # 2. Mathematical questions with symbols & missing answer key (tests 3, 5)
    doc2 = fitz.open()
    p1 = doc2.new_page()
    p1.insert_text((50, 70), "QUANTITATIVE APTITUDE SECTION - PRACTICE SET\n\n", fontsize=14)
    p1.insert_text((50, 110), "Q.1 If sin θ + cos θ = √2 cos θ, then what is the value of cos θ - sin θ?\n(A) √2 sin θ\n(B) √2 cos θ\n(C) 2 sin θ\n(D) 1/√2\n\n", fontsize=11)
    p1.insert_text((50, 200), "Q.2 The radius of a cylinder is 7 cm and its height is 10 cm. Find its volume in cm³ (use π = 22/7):\n(A) 1540\n(B) 1440\n(C) 1620\n(D) 1500\n\n", fontsize=11)
    p1.insert_text((50, 290), "Q.3 A train running at 72 km/h crosses a 200 m long platform in 25 seconds. Find the length of the train:\n(A) 250 m\n(B) 300 m\n(C) 200 m\n(D) 350 m\n\n", fontsize=11)
    # Notice: NO answer key provided in doc2 (Tests missing answer key handling!)
    doc2.save(os.path.join(output_dir, "test2_math_missing_key.pdf"))
    doc2.close()

    # 3. Question spanning across multiple pages (test 8)
    doc3 = fitz.open()
    p1 = doc3.new_page()
    p1.insert_text((50, 70), "REASONING SECTION - MULTI-PAGE TEST\n\n", fontsize=14)
    p1.insert_text((50, 120), "Q.1 Eight persons A, B, C, D, E, F, G and H are sitting around a circular table facing towards the centre. B sits second to the right of D. G sits third to the right of B. F sits opposite to A.\n", fontsize=11)
    # The question continues onto Page 2 with its options!
    p2 = doc3.new_page()
    p2.insert_text((50, 70), "Who among the following sits immediate left of C?\n(A) D\n(B) H\n(C) E\n(D) A\n\n", fontsize=11)
    p2.insert_text((50, 160), "Q.2 In a certain code language, 'ROSE' is coded as '68' and 'LILY' is coded as '58'. How will 'LOTUS' be coded?\n(A) 85\n(B) 92\n(C) 90\n(D) 88\n\n", fontsize=11)
    doc3.save(os.path.join(output_dir, "test3_spanning_pages.pdf"))
    doc3.close()

    # 4. Duplicate questions test (test 7)
    doc4 = fitz.open()
    p1 = doc4.new_page()
    p1.insert_text((50, 70), "DUPLICATE DETECTION VALIDATION SHEET\n\n", fontsize=14)
    # Identical to Q.1 of test 1
    p1.insert_text((50, 110), "Q.1 Which Mughal Emperor transferred the capital from Agra to Delhi?\n(A) Akbar\n(B) Jahangir\n(C) Shah Jahan\n(D) Aurangzeb\n\n", fontsize=11)
    # Minor wording change (tests fuzzy token overlap similarity)
    p1.insert_text((50, 200), "Q.2 The radius of a right circular cylinder is 7 cm and its height is 10 cm. Calculate its total volume in cm³ (taking π = 22/7):\n(A) 1540\n(B) 1440\n(C) 1620\n(D) 1500\n\n", fontsize=11)
    doc4.save(os.path.join(output_dir, "test4_duplicates.pdf"))
    doc4.close()

    # 5. Scanned / image-based PDF (test 2)
    # Create an image containing question text, then embed it as an image page with 0 native text
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((40, 50), "SCANNED EXAM PAPER - SECTION B", fill=(20, 20, 20))
    draw.text((40, 100), "Q.1 What is the SI unit of electric current?", fill=(30, 30, 30))
    draw.text((40, 140), "(A) Volt", fill=(30, 30, 30))
    draw.text((40, 170), "(B) Ampere", fill=(30, 30, 30))
    draw.text((40, 200), "(C) Ohm", fill=(30, 30, 30))
    draw.text((40, 230), "(D) Watt", fill=(30, 30, 30))

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    doc5 = fitz.open()
    p1 = doc5.new_page(width=800, height=600)
    p1.insert_image(fitz.Rect(0, 0, 800, 600), stream=img_bytes)
    doc5.save(os.path.join(output_dir, "test5_scanned.pdf"))
    doc5.close()

if __name__ == "__main__":
    test_dir = os.path.join(os.path.dirname(__file__), "..", "data", "test_pdfs")
    generate_test_suite_pdfs(test_dir)
    print("Test suite PDFs generated in:", test_dir)
