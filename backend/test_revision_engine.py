import os
os.environ.setdefault("RECALLIX_DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "test_isolated.db"))
import json
from datetime import datetime, timedelta
from .database import (
    init_db, get_db, create_document, insert_question,
    record_question_attempt, get_revision_stats, get_revision_items_list,
    record_reattempt, classify_mistake, toggle_difficult,
    toggle_question_bookmark, get_bookmarked_ids,
    create_practice_session, submit_practice_session
)

def run_phase4_acceptance_tests():
    print("=" * 65)
    print("RUNNING STUDY OS PHASE 4 SMART REVISION & MISTAKE TRACKER ACCEPTANCE SUITE")
    print("=" * 65)

    init_db()
    conn = get_db()

    test_pdf_id = "pdf_test_p4"
    existing_doc = conn.execute("SELECT id FROM pdf_documents WHERE id = ?", (test_pdf_id,)).fetchone()
    if not existing_doc:
        create_document(test_pdf_id, "revision_test_fixture.pdf", "data/uploads/fixture_p4.pdf", 2048, "sha_p4_rev_test", 10)

    for i in range(1, 10):
        qid = f"q_p4_test_{i}"
        existing = conn.execute("SELECT id FROM questions WHERE id = ?", (qid,)).fetchone()
        if not existing:
            insert_question({
                "id": qid,
                "pdf_id": test_pdf_id,
                "source_filename": "revision_test_fixture.pdf",
                "page_number": i,
                "page_end_number": i,
                "raw_question_number": str(i),
                "question_text": f"Phase 4 Revision Test Question {i}: What is {i} * 10?",
                "options": [
                    {"label": "A", "text": str(i * 10)},
                    {"label": "B", "text": str(i * 10 + 5)},
                    {"label": "C", "text": str(i * 10 - 5)},
                    {"label": "D", "text": str(i * 100)},
                ],
                "correct_answer": "A",
                "explanation": f"Source PDF explanation: {i} * 10 = {i * 10}.",
                "subject": "Quantitative Aptitude" if i % 2 == 1 else "Reasoning",
                "topic": "Multiplication" if i % 2 == 1 else "Logical Puzzles",
                "confidence": 0.98,
                "verification_status": "verified",
                "page_image_url": f"/assets/pages/{test_pdf_id}_p{i}.png"
            })
    conn.close()

    results = {}

    # --- Criterion 1: Incorrect question enters revision ---
    print("\n--- Criterion 1: Incorrect question enters revision ---")
    q1_id = "q_p4_test_1"
    conn = get_db()
    # Attempt question 1 with incorrect answer 'B'
    record_question_attempt(
        conn=conn,
        question_id=q1_id,
        selected_option="B",
        is_correct=0,
        mistake_category="calculation_error",
        is_difficult=False,
        notes="Made an arithmetic slip"
    )
    conn.commit()
    conn.close()

    incorrect_items = get_revision_items_list(filter_type="incorrect")["items"]
    q1_found = next((item for item in incorrect_items if item["id"] == q1_id), None)

    assert q1_found is not None, "q1 not found in incorrect revision items!"
    assert q1_found["last_attempt_status"] == "incorrect", f"Expected incorrect, got {q1_found['last_attempt_status']}"
    assert q1_found["interval_days"] == 1, f"Expected 1 day interval for incorrect, got {q1_found['interval_days']}"
    assert q1_found["mistake_category"] == "calculation_error", f"Expected calculation_error, got {q1_found['mistake_category']}"

    print(f"PASS: Incorrect question entered revision queue. Interval: {q1_found['interval_days']}d, Due: {q1_found['due_date']}, Category: {q1_found['mistake_category']}")
    results["1_incorrect_enters_revision"] = True

    # --- Criterion 2: Bookmarked question appears in bookmarks ---
    print("\n--- Criterion 2: Bookmarked question appears in bookmarks ---")
    q2_id = "q_p4_test_2"
    # Ensure bookmarked
    b_state = toggle_question_bookmark(q2_id)
    if not b_state:  # if was already bookmarked and toggled off, toggle back on
        b_state = toggle_question_bookmark(q2_id)

    bookmarked_items = get_revision_items_list(filter_type="bookmarked")["items"]
    q2_found = next((item for item in bookmarked_items if item["id"] == q2_id), None)

    assert q2_found is not None, "q2 not found in bookmarked revision items!"
    assert q2_found["is_bookmarked"] == 1, "is_bookmarked flag must be 1"
    print(f"PASS: Bookmarked question {q2_id} appears in bookmarked filter with is_bookmarked=1")
    results["2_bookmarked_appears_in_bookmarks"] = True

    # --- Criterion 3: Correctly answered question follows its revision schedule ---
    print("\n--- Criterion 3: Correctly answered question follows its revision schedule ---")
    q3_id = "q_p4_test_3"
    conn = get_db()
    # Clean previous records for q3
    conn.execute("DELETE FROM revision_items WHERE question_id = ?", (q3_id,))
    conn.execute("DELETE FROM revision_logs WHERE question_id = ?", (q3_id,))
    conn.commit()

    # Attempt 1: First correct answer -> should be 5 days interval, streak 1
    record_question_attempt(
        conn=conn,
        question_id=q3_id,
        selected_option="A",
        is_correct=1,
        is_difficult=False
    )
    conn.commit()
    conn.close()

    items = get_revision_items_list(filter_type="all_attempted")["items"]
    q3_item1 = next(item for item in items if item["id"] == q3_id)
    assert q3_item1["interval_days"] == 5, f"Expected 5 days on first correct, got {q3_item1['interval_days']}"
    assert q3_item1["streak"] == 1, f"Expected streak 1, got {q3_item1['streak']}"
    print(f"  Attempt 1 (First correct): Interval = {q3_item1['interval_days']}d, Streak = {q3_item1['streak']}")

    # Attempt 2: Second correct answer (Consistently correct) -> should be 14 days interval, streak 2
    conn = get_db()
    record_question_attempt(
        conn=conn,
        question_id=q3_id,
        selected_option="A",
        is_correct=1,
        is_difficult=False
    )
    conn.commit()
    conn.close()

    items = get_revision_items_list(filter_type="all_attempted")["items"]
    q3_item2 = next(item for item in items if item["id"] == q3_id)
    assert q3_item2["interval_days"] == 14, f"Expected 14 days on consistent correct, got {q3_item2['interval_days']}"
    assert q3_item2["streak"] == 2, f"Expected streak 2, got {q3_item2['streak']}"
    print(f"  Attempt 2 (Consistent correct): Interval = {q3_item2['interval_days']}d, Streak = {q3_item2['streak']}")

    # Correct but flagged difficult -> interval should be 2 days
    q4_id = "q_p4_test_4"
    conn = get_db()
    record_question_attempt(
        conn=conn,
        question_id=q4_id,
        selected_option="A",
        is_correct=1,
        is_difficult=True
    )
    conn.commit()
    conn.close()

    items = get_revision_items_list(filter_type="difficult")["items"]
    q4_item = next(item for item in items if item["id"] == q4_id)
    assert q4_item["interval_days"] == 2, f"Expected 2 days for correct but difficult, got {q4_item['interval_days']}"
    print(f"  Attempt 3 (Correct but difficult): Interval = {q4_item['interval_days']}d, Due: {q4_item['due_date']}")

    print("PASS: Spaced repetition interval schedule verified (Incorrect=1d, Difficult=2d, Correct=5d, Consistent=14d)")
    results["3_spaced_repetition_schedule"] = True

    # --- Criterion 4: Reattempt updates revision status ---
    print("\n--- Criterion 4: Reattempt updates revision status ---")
    # Take q1 (which was incorrect and interval=1d) and reattempt it correctly via record_reattempt
    reattempt_res = record_reattempt(
        question_id=q1_id,
        selected_option="A",  # Correct answer
        mistake_category="calculation_error",
        is_difficult=False
    )
    assert reattempt_res["is_correct"] == 1, "Reattempt answer should evaluate to correct"
    updated_q1 = reattempt_res["item"]
    assert updated_q1["last_attempt_status"] == "correct", f"Expected correct, got {updated_q1['last_attempt_status']}"
    assert updated_q1["interval_days"] == 5, f"Expected interval upgraded to 5d, got {updated_q1['interval_days']}"
    assert updated_q1["streak"] == 1, f"Expected streak reset/updated to 1, got {updated_q1['streak']}"

    print(f"PASS: Reattempt updated status to '{updated_q1['last_attempt_status']}', interval upgraded to {updated_q1['interval_days']}d, streak={updated_q1['streak']}")
    results["4_reattempt_updates_status"] = True

    # --- Criterion 5: Previous attempts remain accessible ---
    print("\n--- Criterion 5: Previous attempts remain accessible ---")
    # q1 has had at least 2 attempts (initial incorrect + reattempt correct)
    conn = get_db()
    logs = conn.execute("SELECT * FROM revision_logs WHERE question_id = ? ORDER BY id ASC", (q1_id,)).fetchall()
    conn.close()

    assert len(logs) >= 2, f"Expected at least 2 logs for q1, found {len(logs)}"
    first_attempt = dict(logs[0])
    second_attempt = dict(logs[1])

    assert first_attempt["selected_option"] == "B", f"First attempt option was B, got {first_attempt['selected_option']}"
    assert first_attempt["is_correct"] == 0, "First attempt was incorrect"
    assert second_attempt["selected_option"] == "A", f"Second attempt option was A, got {second_attempt['selected_option']}"
    assert second_attempt["is_correct"] == 1, "Second attempt was correct"

    print(f"PASS: Full attempt history retained ({len(logs)} attempts recorded for question).")
    print(f"  Attempt 1: Selected={first_attempt['selected_option']}, Correct={first_attempt['is_correct']}, Mistake={first_attempt['mistake_category']}")
    print(f"  Attempt 2: Selected={second_attempt['selected_option']}, Correct={second_attempt['is_correct']}")
    results["5_previous_attempts_accessible"] = True

    # --- Criterion 6: Refresh does not erase revision progress ---
    print("\n--- Criterion 6: Refresh does not erase revision progress ---")
    # Verify directly by opening fresh database connections and simulating client refresh
    conn_fresh = get_db()
    persisted_item = conn_fresh.execute("SELECT * FROM revision_items WHERE question_id = ?", (q1_id,)).fetchone()
    persisted_logs = conn_fresh.execute("SELECT COUNT(*) FROM revision_logs WHERE question_id = ?", (q1_id,)).fetchone()[0]
    conn_fresh.close()

    assert persisted_item is not None, "Revision item vanished from database!"
    assert persisted_item["interval_days"] == 5, f"Interval not persisted! Got {persisted_item['interval_days']}"
    assert persisted_logs >= 2, f"Attempt logs count not persisted! Got {persisted_logs}"

    # Also test mistake classification one-click persistence
    classify_mistake(q1_id, "silly_mistake")
    conn_verify = get_db()
    reloaded_mistake = conn_verify.execute("SELECT mistake_category FROM revision_items WHERE question_id = ?", (q1_id,)).fetchone()[0]
    conn_verify.close()
    assert reloaded_mistake == "silly_mistake", f"Expected silly_mistake, got {reloaded_mistake}"

    # Check that questions table has NO duplicates created
    conn_dup = get_db()
    total_q1 = conn_dup.execute("SELECT COUNT(*) FROM questions WHERE id = ?", (q1_id,)).fetchone()[0]
    conn_dup.close()
    assert total_q1 == 1, f"Duplicate question created in questions table! Count = {total_q1}"

    print(f"PASS: Database state verified across fresh connections. Mistake category='{reloaded_mistake}', zero duplicate questions.")
    results["6_refresh_persists_progress"] = True

    print("\n" + "=" * 65)
    print("ALL 6 PHASE 4 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY (6/6)")
    print("=" * 65)
    return results

if __name__ == "__main__":
    run_phase4_acceptance_tests()
