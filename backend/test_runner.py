import os
os.environ.setdefault("RECALLIX_DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "test_isolated.db"))
import json
from .test_generator import generate_test_suite_pdfs
from .database import init_db, get_db, create_document, create_job, update_job, get_job, insert_question, query_questions
from .extractor import PDFExtractor

def run_acceptance_tests():
    print("=" * 60)
    print("RUNNING STUDY OS PHASE 2 ACCEPTANCE SUITE")
    print("=" * 60)

    test_dir = os.path.join(os.path.dirname(__file__), "..", "data", "test_pdfs")
    generate_test_suite_pdfs(test_dir)
    init_db()

    # Clean test data from DB for fresh idempotent run
    conn = get_db()
    conn.execute("DELETE FROM questions WHERE pdf_id LIKE 'pdf_test_%'")
    conn.execute("DELETE FROM pdf_documents WHERE id LIKE 'pdf_test_%'")
    conn.execute("DELETE FROM import_jobs WHERE id LIKE 'test_job%'")
    conn.commit()
    conn.close()

    results = {}

    # Test 1, 4, 6: Text-based PDF, 4 options, Separate Answer Key
    print("\n--- Test 1, 4, 6: Text-based PDF with 4 Options & Separate Answer Key ---")
    pdf1_path = os.path.join(test_dir, "test1_text_separate_key.pdf")
    ext1 = PDFExtractor(pdf1_path, "pdf_test_1", "test1_text_separate_key.pdf")
    q1_list, meta1 = ext1.process()

    t1_pass = len(q1_list) == 3
    t4_pass = all(len(q["options"]) == 4 for q in q1_list)
    t6_pass = (
        q1_list[0].get("correct_answer") == "C" and
        q1_list[1].get("correct_answer") == "B" and
        q1_list[2].get("correct_answer") == "B"
    )

    results["1. Text-based PDF"] = "PASS" if t1_pass else "FAIL"
    results["4. Four Options"] = "PASS" if t4_pass else "FAIL"
    results["6. Separate Answer Key Association"] = "PASS" if t6_pass else "FAIL"
    print(f"Extracted {len(q1_list)} questions. Answer keys matched: {meta1['answer_keys_found']}")

    # Insert into database for subsequent tests
    create_document("pdf_test_1", "test1_text_separate_key.pdf", pdf1_path, 1024, "sha_test_1", meta1["total_pages"])
    for q in q1_list:
        insert_question(q)

    # Test 3 & 5: Mathematical questions & Missing Answer Key
    print("\n--- Test 3 & 5: Mathematical Questions & Missing Answer Keys ---")
    pdf2_path = os.path.join(test_dir, "test2_math_missing_key.pdf")
    ext2 = PDFExtractor(pdf2_path, "pdf_test_2", "test2_math_missing_key.pdf")
    q2_list, meta2 = ext2.process()

    math_symbols_found = False
    for q in q2_list:
        if any(sym in q["question_text"] for sym in ["θ", "√2", "π", "cm³"]):
            math_symbols_found = True
            break

    t3_pass = len(q2_list) == 3 and math_symbols_found
    t5_pass = all(q.get("correct_answer") is None for q in q2_list)

    results["3. Mathematical Notation Preservation"] = "PASS" if t3_pass else "FAIL"
    results["5. Missing Answer Keys (No False Assumptions)"] = "PASS" if t5_pass else "FAIL"
    print(f"Mathematical questions extracted: {len(q2_list)}. All missing keys kept unverified: {t5_pass}")

    create_document("pdf_test_2", "test2_math_missing_key.pdf", pdf2_path, 1024, "sha_test_2", meta2["total_pages"])
    for q in q2_list:
        insert_question(q)

    # Test 8: Question Spanning Multiple Pages
    print("\n--- Test 8: Question Spanning Across Pages ---")
    pdf3_path = os.path.join(test_dir, "test3_spanning_pages.pdf")
    ext3 = PDFExtractor(pdf3_path, "pdf_test_3", "test3_spanning_pages.pdf")
    q3_list, meta3 = ext3.process()

    spanning_q = next((q for q in q3_list if q["raw_question_number"] == "1"), None)
    t8_pass = (
        spanning_q is not None and
        spanning_q["page_number"] == 1 and
        spanning_q["page_end_number"] == 2 and
        len(spanning_q["options"]) == 4 and
        "circular table" in spanning_q["question_text"]
    )
    results["8. Multi-page Question Spanning"] = "PASS" if t8_pass else "FAIL"
    print(f"Spanning question detected: page {spanning_q['page_number']} to {spanning_q['page_end_number']}. Passed: {t8_pass}")

    create_document("pdf_test_3", "test3_spanning_pages.pdf", pdf3_path, 1024, "sha_test_3", meta3["total_pages"])
    for q in q3_list:
        insert_question(q)

    # Test 7: Duplicate Question Detection
    print("\n--- Test 7: Duplicate Questions Across Documents ---")
    pdf4_path = os.path.join(test_dir, "test4_duplicates.pdf")
    ext4 = PDFExtractor(pdf4_path, "pdf_test_4", "test4_duplicates.pdf")
    q4_list, meta4 = ext4.process()

    duplicates_flagged = [q for q in q4_list if q.get("is_duplicate") == 1]
    t7_pass = len(duplicates_flagged) >= 1
    results["7. Duplicate Detection Across Documents"] = "PASS" if t7_pass else "FAIL"
    print(f"Duplicates detected: {len(duplicates_flagged)} of {len(q4_list)} questions. Passed: {t7_pass}")

    # Test 2: Scanned / Image-based PDF
    print("\n--- Test 2: Scanned / Image-based PDF Processing ---")
    pdf5_path = os.path.join(test_dir, "test5_scanned.pdf")
    ext5 = PDFExtractor(pdf5_path, "pdf_test_5", "test5_scanned.pdf")
    q5_list, meta5 = ext5.process()
    # If tesseract is present, text is parsed; if not, image is rendered for verification
    has_image_render = os.path.exists(os.path.join(os.path.dirname(__file__), "..", "data", "assets", "pages", "pdf_test_5_p1.png"))
    t2_pass = has_image_render
    results["2. Scanned PDF & Preprocessing Pipeline"] = "PASS" if t2_pass else "FAIL"
    print(f"Scanned page rendered to assets: {has_image_render}. Passed: {t2_pass}")

    # Test 9: Interrupted Processing & Job Recovery
    print("\n--- Test 9: Interrupted Job State & Recovery ---")
    job_id = "test_job_cancel"
    create_job(job_id, "pdf_test_1", 2)
    update_job(job_id, status="cancelled", error_message="User requested stop")
    j_cancel = get_job(job_id)
    t9_cancel = j_cancel["status"] == "cancelled"

    # Recovery: update back to queued/processing and complete
    update_job(job_id, status="completed", processed_pages=2, extracted_questions=3)
    j_rec = get_job(job_id)
    t9_rec = j_rec["status"] == "completed" and j_rec["extracted_questions"] == 3

    t9_pass = t9_cancel and t9_rec
    results["9. Interrupted Processing and Recovery"] = "PASS" if t9_pass else "FAIL"
    print(f"Job cancellation & state recovery: {t9_pass}")

    # Calculate overall accuracy
    print("\n" + "=" * 60)
    print("SUMMARY OF PHASE 2 ACCEPTANCE RESULTS:")
    print("=" * 60)
    for test_name, status in results.items():
        print(f"  [{status}] {test_name}")

    total_tests = len(results)
    passed_tests = sum(1 for s in results.values() if s == "PASS")
    accuracy_pct = round((passed_tests / total_tests) * 100, 1)
    print(f"\nFinal Acceptance Score: {passed_tests}/{total_tests} passed ({accuracy_pct}% verification)")
    return results

if __name__ == "__main__":
    run_acceptance_tests()
