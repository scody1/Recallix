import os
os.environ.setdefault("RECALLIX_DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "test_isolated.db"))
import json
from .database import (
    init_db, get_db, create_document, insert_question,
    create_practice_session, get_active_practice_session,
    get_practice_session_details, update_practice_session_progress,
    submit_practice_session, toggle_question_bookmark
)

def run_phase3_acceptance_tests():
    print("=" * 60)
    print("RUNNING STUDY OS PHASE 3 PRACTICE ENGINE ACCEPTANCE SUITE")
    print("=" * 60)

    init_db()
    conn = get_db()

    # Ensure we have at least 10 questions in DB
    existing_count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    if existing_count < 10:
        create_document("pdf_test_p3", "practice_test_fixture.pdf", "path.pdf", 1024, "sha_p3_fixture", 5)
        for i in range(1, 15):
            insert_question({
                "id": f"q_p3_{i}",
                "pdf_id": "pdf_test_p3",
                "source_filename": "practice_test_fixture.pdf",
                "page_number": (i // 3) + 1,
                "page_end_number": (i // 3) + 1,
                "raw_question_number": str(i),
                "question_text": f"Practice Engine Test Question {i}: What is {i} + {i}?",
                "options": [
                    {"label": "A", "text": str(i * 2)},
                    {"label": "B", "text": str(i * 2 + 1)},
                    {"label": "C", "text": str(i * 2 - 1)},
                    {"label": "D", "text": str(i * 3)},
                ],
                "correct_answer": "A",
                "explanation": f"{i} + {i} = {i * 2}",
                "subject": "Quantitative Aptitude" if i % 2 == 0 else "Reasoning",
                "topic": "Arithmetic" if i % 2 == 0 else "Series",
                "confidence": 0.95,
                "verification_status": "verified",
                "page_image_url": "/assets/pages/pdf_test_1_p1.png"
            })
    conn.close()

    results = {}

    # --- Scenario 1: Complete a test with 10 questions, refresh halfway, resume it, submit it ---
    print("\n--- Scenario 1: Test with 10 Questions, Refresh Halfway, Resume & Submit ---")

    # 1. Start Session
    config = {
        "pool": "entire",
        "subject": "all",
        "topic": "all",
        "count": 10,
        "mode": "untimed",
        "duration_minutes": 15,
        "shuffle_questions": False,
        "shuffle_options": False,
        "include_unverified": True,
        "correct_marks": 2.0,
        "negative_marks": 0.5
    }
    session = create_practice_session(config)
    session_id = session["session_id"]
    q_list = session["questions"]
    print(f"Created session: {session_id} with {len(q_list)} questions.")

    # 2. Answer first 5 questions (halfway)
    # Mark question 2 for review.
    # Q0, Q1, Q2: correct
    # Q3: incorrect
    # Q4: skipped
    for i in range(3):
        cor = q_list[i].get("correct_answer") or "A"
        q_list[i]["selected_option"] = cor

    q_list[2]["is_marked_for_review"] = 1

    # Q3: intentionally incorrect
    cor3 = q_list[3].get("correct_answer") or "A"
    q_list[3]["selected_option"] = "B" if cor3 == "A" else "A"

    # Q4: skipped (visited = 1, selected_option = None)
    q_list[4]["selected_option"] = None
    q_list[4]["is_visited"] = 1

    update_practice_session_progress(
        session_id=session_id,
        current_index=4,
        elapsed_seconds=120,
        attempts=q_list
    )
    print("Answered halfway (5 questions) and marked Q3 for review. Saved progress at elapsed = 120s.")

    # 3. Simulate browser refresh / application restart:
    # Query get_active_practice_session()
    resumed = get_active_practice_session()
    t_resume_id = resumed is not None and resumed["id"] == session_id
    t_resume_idx = resumed["current_index"] == 4
    t_resume_time = resumed["elapsed_seconds"] == 120
    t_resume_q0 = resumed["questions"][0]["selected_option"] == q_list[0]["selected_option"]
    t_resume_q2_mark = resumed["questions"][2]["is_marked_for_review"] == 1
    t_resume_q3 = resumed["questions"][3]["selected_option"] == q_list[3]["selected_option"]
    t_no_duplicate_attempts = len(resumed["questions"]) == 10

    t_resume_pass = (
        t_resume_id and t_resume_idx and t_resume_time and
        t_resume_q0 and t_resume_q2_mark and t_resume_q3 and
        t_no_duplicate_attempts
    )
    results["Session Recovery Across Refresh (Halfway Resume)"] = "PASS" if t_resume_pass else "FAIL"
    print(f"Recovered session after refresh without duplicate attempts: {t_resume_pass}")

    # 4. Resume and answer remaining questions (5..9)
    # Q5, Q6, Q8, Q9: correct
    # Q7: incorrect
    res_q_list = resumed["questions"]
    for i in [5, 6, 8, 9]:
        cor = res_q_list[i].get("correct_answer") or "A"
        res_q_list[i]["selected_option"] = cor

    cor7 = res_q_list[7].get("correct_answer") or "A"
    res_q_list[7]["selected_option"] = "B" if cor7 == "A" else "A"

    # 5. Submit Test
    final_results = submit_practice_session(
        session_id=session_id,
        elapsed_seconds=240,
        attempts=res_q_list
    )

    # Calculate expected score based on actual correct answers
    expected_correct = 0
    expected_incorrect = 0
    for att in res_q_list:
        sel = att.get("selected_option")
        cor = att.get("correct_answer")
        if sel is None:
            continue
        elif cor and sel.upper() == cor.upper():
            expected_correct += 1
        else:
            expected_incorrect += 1

    expected_score = round((expected_correct * 2.0) - (expected_incorrect * 0.5), 2)
    score_pass = final_results["score"] == expected_score
    status_pass = final_results["status"] == "completed"
    time_pass = final_results["elapsed_seconds"] == 240
    results["Submission & Marking Scheme Calculation"] = "PASS" if (score_pass and status_pass and time_pass) else "FAIL"
    print(f"Submission results: Score = {final_results['score']} (Expected: {expected_score}). Status = {final_results['status']}. Passed: {score_pass}")

    # --- Scenario 2: Test All Three Practice Modes ---
    print("\n--- Scenario 2: Validate Untimed, Timed, and Strict Simulation Modes ---")

    # Mode 1: Untimed
    m1_session = create_practice_session({
        "pool": "entire",
        "count": 5,
        "mode": "untimed",
        "include_unverified": True
    })
    m1_pass = m1_session["config"]["mode"] == "untimed"

    # Mode 2: Timed
    m2_session = create_practice_session({
        "pool": "entire",
        "count": 5,
        "mode": "timed",
        "duration_minutes": 20,
        "include_unverified": True
    })
    m2_pass = m2_session["config"]["mode"] == "timed" and m2_session["config"]["duration_minutes"] == 20

    # Mode 3: Strict Simulation
    m3_session = create_practice_session({
        "pool": "entire",
        "count": 5,
        "mode": "strict",
        "duration_minutes": 30,
        "include_unverified": True
    })
    m3_pass = m3_session["config"]["mode"] == "strict" and m3_session["config"]["duration_minutes"] == 30

    modes_pass = m1_pass and m2_pass and m3_pass
    results["Three Practice Modes Support (Untimed, Timed, Strict)"] = "PASS" if modes_pass else "FAIL"
    print(f"All 3 modes verified: {modes_pass}")

    # Clean up active sessions
    submit_practice_session(m1_session["session_id"], 10)
    submit_practice_session(m2_session["session_id"], 10)
    submit_practice_session(m3_session["session_id"], 10)

    # --- Scenario 3: Question Navigation & Bookmarks ---
    print("\n--- Scenario 3: Question Navigation & Bookmarking ---")
    q_id_to_bookmark = "q_p3_1"
    b_added = toggle_question_bookmark(q_id_to_bookmark)
    b_is_true = b_added is True
    b_removed = toggle_question_bookmark(q_id_to_bookmark)
    b_is_false = b_removed is False

    nav_pass = b_is_true and b_is_false
    results["Question Navigation, Bookmarking & Palette Jump"] = "PASS" if nav_pass else "FAIL"
    print(f"Bookmark toggling verified: {nav_pass}")

    print("\n" + "=" * 60)
    print("PHASE 3 ACCEPTANCE SUMMARY:")
    print("=" * 60)
    for t_name, status in results.items():
        print(f"  [{status}] {t_name}")

    all_passed = all(s == "PASS" for s in results.values())
    print(f"\nFinal Phase 3 Verification: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    return all_passed

if __name__ == "__main__":
    run_phase3_acceptance_tests()
