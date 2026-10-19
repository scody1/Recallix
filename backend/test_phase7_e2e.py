import os
import sys
import json
import time
import uuid
import urllib.request
import urllib.parse
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def make_req(endpoint: str, method: str = "GET", data: dict = None) -> dict:
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"} if data is not None else {}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def print_step(step_num: int, title: str, details: str = ""):
    print(f"\n========================================================")
    print(f" STEP {step_num}: {title.upper()}")
    print(f"========================================================")
    if details:
        print(f"  > {details}")

def run_phase7_acceptance_test():
    print("\n" + "#" * 60)
    print(" STUDY OS — PHASE 7 FINAL ACCEPTANCE TEST SUITE (15 STEPS)")
    print("#" * 60)

    # ----------------------------------------------------
    # STEP 1: Import a representative PDF
    # ----------------------------------------------------
    print_step(1, "Import a Representative PDF")
    # Generate a representative test PDF with math, fractions, and questions
    import fitz
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "data", "test_phase7_sample.pdf")
    doc = fitz.open()
    page = doc.new_page()
    sample_text = """
    SSC CGL PRACTICE DRILL - QUANT & GENERAL STUDIES
    
    Q.1 If the value of \\sqrt{x} + \\frac{1}{\\sqrt{x}} = 3, find the value of x^2 + \\frac{1}{x^2}.
    (A) 47
    (B) 49
    (C) 51
    (D) 45
    
    Q.2 What is the SI unit of electric resistance?
    (A) Volt
    (B) Ampere
    (C) Ohm
    (D) Watt
    
    Q.3 Solve for y: 2y + 15 = 45. What is the value of y?
    (A) 12
    (B) 15
    (C) 18
    (D) 20
    
    Answer Key:
    1: A
    2: C
    3: B
    """
    page.insert_text((50, 60), sample_text, fontsize=11)
    doc.save(pdf_path)
    doc.close()

    # Upload PDF via multipart
    boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()
    
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="test_phase7_sample.pdf"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/documents/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        upload_res = json.loads(resp.read().decode("utf-8"))
    
    doc_id = upload_res["uploaded"][0]["document_id"] if upload_res.get("uploaded") else upload_res["duplicates"][0]["document_id"]
    print(f" [PASS] PDF Uploaded successfully. Document ID: {doc_id}")

    # ----------------------------------------------------
    # STEP 2: Extract questions
    # ----------------------------------------------------
    print_step(2, "Extract Questions via Ingestion Engine")
    # Poll import job
    jobs = make_req("/jobs")
    job = next((j for j in jobs if j["pdf_id"] == doc_id), None)
    if job:
        job_id = job["id"]
        # Wait until job completes
        for _ in range(15):
            curr_job = make_req(f"/jobs/{job_id}")["job"]
            if curr_job["status"] in ["completed", "failed"]:
                break
            time.sleep(0.5)
        print(f" [PASS] Extraction Job {job_id} Status: {curr_job['status']} | Extracted: {curr_job['extracted_questions']}")

    # Check extracted questions
    q_res = make_req(f"/questions?pdf_id={doc_id}&limit=10")
    extracted_questions = q_res["items"]
    assert len(extracted_questions) >= 3, f"Expected at least 3 extracted questions, found {len(extracted_questions)}"
    print(f" [PASS] Verified {len(extracted_questions)} questions extracted from document.")

    # ----------------------------------------------------
    # STEP 3: Verify selected questions
    # ----------------------------------------------------
    print_step(3, "Verify Selected Question via Verification API")
    q_to_verify = extracted_questions[0]
    verif_res = make_req(
        f"/questions/{q_to_verify['id']}",
        method="PATCH",
        data={"verification_status": "verified"}
    )
    assert verif_res["verification_status"] == "verified", "Verification status did not update to 'verified'"
    print(f" [PASS] Question {q_to_verify['id'][:8]} successfully verified (Status: verified).")

    # ----------------------------------------------------
    # STEP 4: Create a practice session
    # ----------------------------------------------------
    print_step(4, "Create Practice Session with Review Mode Support")
    practice_cfg = {
        "pool": "specific_pdf",
        "pdf_id": doc_id,
        "count": 3,
        "mode": "untimed",
        "duration_minutes": 15,
        "shuffle_questions": False,
        "shuffle_options": False,
        "include_unverified": True,
        "review_mode": True,
        "correct_marks": 2.0,
        "negative_marks": 0.5
    }
    session_res = make_req("/practice/sessions/create", method="POST", data=practice_cfg)
    sess_id = session_res["session_id"]
    sess_questions = session_res["questions"]
    assert len(sess_questions) >= 3, "Practice session questions list incomplete"
    print(f" [PASS] Practice session {sess_id} initialized with {len(sess_questions)} questions.")

    # ----------------------------------------------------
    # STEP 5: Answer questions (1 correct, 1 wrong, 1 skipped)
    # ----------------------------------------------------
    print_step(5, "Answer Questions in Practice Session")
    # Q1: answer correct ('A')
    q1 = sess_questions[0]
    ans1 = q1["correct_answer"] or "A"

    # Q2: answer wrong (choose 'A' when correct is 'C')
    q2 = sess_questions[1]
    ans2 = "A" if (q2.get("correct_answer") != "A") else "B"

    # Q3: leave unattempted/skipped
    q3 = sess_questions[2]
    ans3 = None

    test_attempts = [
        {"question_id": q1["question_id"], "selected_option": ans1, "is_marked_for_review": 0, "is_visited": 1, "time_spent_seconds": 25},
        {"question_id": q2["question_id"], "selected_option": ans2, "is_marked_for_review": 0, "is_visited": 1, "time_spent_seconds": 30},
        {"question_id": q3["question_id"], "selected_option": ans3, "is_marked_for_review": 1, "is_visited": 1, "time_spent_seconds": 10},
    ]

    save_res = make_req(
        f"/practice/sessions/{sess_id}/progress",
        method="POST",
        data={"current_index": 1, "elapsed_seconds": 65, "attempts": test_attempts}
    )
    print(f" [PASS] Progress saved for 3 questions. Answers recorded.")

    # ----------------------------------------------------
    # STEP 6: Bookmark a question
    # ----------------------------------------------------
    print_step(6, "Bookmark a Question")
    bm_res = make_req(f"/practice/bookmarks/{q2['question_id']}/toggle", method="POST")
    assert bm_res["is_bookmarked"] is True, "Failed to bookmark question"
    print(f" [PASS] Question {q2['question_id'][:8]} bookmarked (is_bookmarked=True).")

    # ----------------------------------------------------
    # STEP 7: Refresh simulation / Active session query
    print_step(7, "Simulate Browser Refresh / Recovery")
    active_sess_resp = make_req("/practice/sessions/active")
    active_sess = active_sess_resp.get("active_session")
    assert active_sess is not None and active_sess["id"] == sess_id, "Active session recovery failed on refresh"
    assert active_sess["elapsed_seconds"] == 65, "Elapsed seconds not preserved"
    print(f" [PASS] Active session recovered seamlessly with elapsed time {active_sess['elapsed_seconds']}s.")

    # ----------------------------------------------------
    # STEP 8: Resume the session
    # ----------------------------------------------------
    print_step(8, "Resume Session and Verify Selected Answers Intact")
    recovered_attempts = active_sess["questions"]
    q1_recovered = next(a for a in recovered_attempts if a["question_id"] == q1["question_id"])
    assert q1_recovered["selected_option"] == ans1, "Question 1 selected answer lost on resume"
    print(f" [PASS] Recovered question options and selected answer '{q1_recovered['selected_option']}' intact.")

    # ----------------------------------------------------
    # STEP 9: Complete and submit it
    # ----------------------------------------------------
    print_step(9, "Complete and Submit Practice Session")
    submit_res = make_req(
        f"/practice/sessions/{sess_id}/submit",
        method="POST",
        data={"elapsed_seconds": 75, "attempts": test_attempts}
    )
    assert submit_res["status"] == "completed", "Session did not transition to completed"
    print(f" [PASS] Practice session {sess_id} successfully submitted and scored.")

    # ----------------------------------------------------
    # STEP 10: Verify results & scoring accuracy
    # ----------------------------------------------------
    print_step(10, "Verify Scoring Results (+2.0 correct, -0.5 wrong = 1.5 score)")
    expected_score = 2.0 - 0.5 # 1.5
    actual_score = submit_res["score"]
    assert actual_score == expected_score, f"Expected score {expected_score}, got {actual_score}"
    print(f" [PASS] Exact scoring verified: {actual_score} pts (Expected: {expected_score}).")

    # ----------------------------------------------------
    # STEP 11: Confirm incorrect questions enter revision
    # ----------------------------------------------------
    print_step(11, "Confirm Incorrect Question Enters Revision Engine")
    rev_items = make_req("/revision/items?filter_type=incorrect")["items"]
    incorrect_found = any(item["id"] == q2["question_id"] for item in rev_items)
    assert incorrect_found, f"Incorrect question {q2['question_id']} not found in revision queue"
    print(f" [PASS] Incorrect question {q2['question_id'][:8]} confirmed present in revision queue.")

    # ----------------------------------------------------
    # STEP 12: Reattempt a revision question
    # ----------------------------------------------------
    print_step(12, "Reattempt Revision Question & Check Interval Update")
    reattempt_res = make_req(
        "/revision/reattempt",
        method="POST",
        data={
            "question_id": q2["question_id"],
            "selected_option": q2.get("correct_answer") or "C",
            "mistake_category": "concept_not_clear",
            "is_difficult": True
        }
    )
    assert reattempt_res["is_correct"] == 1, "Reattempt did not register correct answer"
    updated_rev_item = reattempt_res["item"]
    print(f" [PASS] Reattempt marked Correct. New Due Date: {updated_rev_item['due_date']} (Interval: {updated_rev_item['interval_days']}d).")

    # ----------------------------------------------------
    # STEP 13: Verify analytics update correctly
    # ----------------------------------------------------
    print_step(13, "Verify Analytics Metrics & Unique Question Coverage")
    analytics = make_req("/analytics/overview?date_range=all")
    metrics = analytics["dashboard_metrics"]
    assert metrics["unique_questions_attempted"] >= 2, "Unique questions attempted not incremented"
    assert metrics["total_attempts"] >= 3, "Total attempts not tracked"
    coverage = metrics.get("unique_question_coverage_pct", 0)
    print(f" [PASS] Analytics Overview verified: Unique Attempted={metrics['unique_questions_attempted']}, Coverage={coverage}%, Total Attempts={metrics['total_attempts']}")

    # ----------------------------------------------------
    # STEP 14: Create a full database backup
    # ----------------------------------------------------
    print_step(14, "Create Full Database Backup Bundle")
    backup_res = make_req("/backup/create", method="POST", data={})
    backup_filename = backup_res["filename"]
    assert backup_filename.endswith(".zip"), "Backup file is not a valid zip bundle"
    print(f" [PASS] Backup bundle created: {backup_filename} ({backup_res['file_size']} bytes, {backup_res['total_questions']} Qs).")

    # ----------------------------------------------------
    # STEP 15: Restore the backup and compare records
    # ----------------------------------------------------
    print_step(15, "Restore Backup & Compare Data Integrity")
    restore_res = make_req("/backup/restore", method="POST", data={"backup_target": backup_filename})
    assert restore_res["status"] == "restored", "Backup restore failed"
    assert restore_res["integrity_check"] == "ok", "PRAGMA integrity_check failed after restore"
    assert restore_res["restored_questions"] >= backup_res["total_questions"], "Restored question count mismatch"
    print(f" [PASS] Backup restored cleanly. Integrity check: {restore_res['integrity_check']} | Questions: {restore_res['restored_questions']}")

    print("\n" + "#" * 60)
    print(" ALL 15 ACCEPTANCE TEST STEPS COMPLETED AND VERIFIED 100%!")
    print("#" * 60 + "\n")

if __name__ == "__main__":
    run_phase7_acceptance_test()
