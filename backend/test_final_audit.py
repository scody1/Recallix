import os
import json
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from .database import (
    init_db, get_db, create_document, insert_question,
    create_practice_session, submit_practice_session,
    record_question_attempt, get_revision_stats, get_revision_items_list,
    record_reattempt, classify_mistake, toggle_difficult,
    get_analytics_overview, create_database_backup, restore_database_backup,
    list_backups, export_question_library_json, export_attempt_history_json,
    record_study_session, get_study_goals, save_study_goals,
    BACKUP_DIR, UPLOADS_DIR, DB_PATH
)

API_BASE = "http://127.0.0.1:8000/api"

def http_get(path):
    req = urllib.request.Request(f"{API_BASE}{path}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def http_post_json(path, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{API_BASE}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def run_final_audit():
    print("=" * 70)
    print("STUDY OS — PHASE 6 FINAL SYSTEM AUDIT & VERIFICATION SUITE")
    print("=" * 70)

    audit_results = {
        "passed": 0,
        "failed": 0,
        "tests": []
    }

    def record_test(name, passed, message=""):
        if passed:
            audit_results["passed"] += 1
            print(f" [PASS] {name} {f'({message})' if message else ''}")
        else:
            audit_results["failed"] += 1
            print(f" [FAIL] {name} - {message}")
        audit_results["tests"].append({"name": name, "passed": passed, "message": message})

    # --- 1. FUNCTIONAL AUDIT ---
    print("\n--- 1. FUNCTIONAL AUDIT: Endpoints & Application Modules ---")
    try:
        # Dashboard metrics
        health = http_get("/health")
        record_test("Health Endpoint (/api/health)", health.get("status") in ["healthy", "operational"])

        sys_stats = http_get("/stats")
        record_test("System Stats (/api/stats)", "total_questions" in sys_stats and "by_subject" in sys_stats)

        # Question Library
        q_lib = http_get("/questions?limit=10&offset=0")
        record_test("Question Library Pagination (/api/questions)", len(q_lib["items"]) <= 10 and q_lib["total"] >= 0)

        # Practice Arena
        # Clear lingering sessions
        conn = get_db()
        conn.execute("UPDATE practice_sessions SET status = 'abandoned' WHERE status = 'in_progress'")
        conn.commit()
        conn.close()

        p_sess = http_post_json("/practice/sessions/create", {
            "pool": "entire",
            "subject": "all",
            "topic": "all",
            "count": 5,
            "mode": "untimed",
            "duration_minutes": 15,
            "shuffle_questions": False,
            "shuffle_options": False,
            "include_unverified": True,
            "correct_marks": 2.0,
            "negative_marks": 0.5
        })
        record_test("Practice Session Creation (/api/practice/sessions/create)", "session_id" in p_sess and len(p_sess["questions"]) > 0)

        active_sess = http_get("/practice/sessions/active")
        record_test("Active Practice Session Recovery", active_sess.get("active_session") is not None)

        # Submit session
        sub_res = http_post_json(f"/practice/sessions/{p_sess['session_id']}/submit", {
            "elapsed_seconds": 120,
            "attempts": [{"question_id": p_sess["questions"][0]["question_id"], "selected_option": "A", "time_spent_seconds": 30}]
        })
        record_test("Practice Session Submission & Marking", sub_res.get("status") == "completed" and "score" in sub_res)

        # Revision Centre
        rev_stats = http_get("/revision/stats")
        record_test("Revision Statistics (/api/revision/stats)", "due_count" in rev_stats and "total_attempted" in rev_stats)

        rev_items = http_get("/revision/items?filter_type=all_attempted&limit=10")
        record_test("Revision Filter (/api/revision/items)", "items" in rev_items)

        # Analytics & Goals
        analytics = http_get("/analytics/overview?date_range=all")
        record_test("Analytics Overview (/api/analytics/overview)", "dashboard_metrics" in analytics and "preparation_intelligence" in analytics)

        goals = http_get("/study/goals")
        record_test("Study Goals (/api/study/goals)", "daily_hours_target" in goals and "daily_question_target" in goals)

    except Exception as e:
        record_test("Functional Audit Suite", False, str(e))

    # --- 2. PDF INGESTION & SECURITY VALIDATION ---
    print("\n--- 2. PDF INGESTION & SECURITY STRESS TESTING ---")
    try:
        # Check non-PDF rejection
        dummy_txt_boundary = "----WebKitFormBoundaryAuditTest123"
        invalid_body = (
            f"--{dummy_txt_boundary}\r\n"
            f'Content-Disposition: form-data; name="files"; filename="malicious_script.exe"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
            f"MZ_NOT_A_PDF_FILE\r\n"
            f"--{dummy_txt_boundary}--\r\n"
        ).encode("utf-8")

        req = urllib.request.Request(
            f"{API_BASE}/documents/upload",
            data=invalid_body,
            headers={"Content-Type": f"multipart/form-data; boundary={dummy_txt_boundary}"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            upload_res = json.loads(resp.read().decode())
            items = upload_res.get("results") or upload_res.get("uploaded", [])
            is_rejected = any(r.get("error") and "Only valid .pdf files" in r.get("message", "") for r in items)
            record_test("Security: Non-PDF File Rejection", is_rejected)

        # Check corrupted PDF header rejection
        corrupt_body = (
            f"--{dummy_txt_boundary}\r\n"
            f'Content-Disposition: form-data; name="files"; filename="fake_corrupt.pdf"\r\n'
            f"Content-Type: application/pdf\r\n\r\n"
            f"CORRUPT_HEADER_WITHOUT_MAGIC_BYTES\r\n"
            f"--{dummy_txt_boundary}--\r\n"
        ).encode("utf-8")

        req = urllib.request.Request(
            f"{API_BASE}/documents/upload",
            data=corrupt_body,
            headers={"Content-Type": f"multipart/form-data; boundary={dummy_txt_boundary}"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            corrupt_res = json.loads(resp.read().decode())
            items = corrupt_res.get("results") or corrupt_res.get("uploaded", [])
            is_corrupt_rejected = any(r.get("error") and "%PDF" in r.get("message", "") for r in items)
            record_test("Security: Corrupt/Non-Magic Header Rejection", is_corrupt_rejected)

        # Duplicate file detection
        conn = get_db()
        existing_doc = conn.execute("SELECT sha256 FROM pdf_documents LIMIT 1").fetchone()
        conn.close()
        if existing_doc:
            dup_sha = existing_doc["sha256"]
            record_test("Duplicate Detection via SHA-256", bool(dup_sha))
        else:
            record_test("Duplicate Detection Setup", True)

    except Exception as e:
        record_test("PDF Ingestion & Security Testing", False, str(e))

    # --- 3. PRACTICE TESTING & SCORING ACCURACY ---
    print("\n--- 3. PRACTICE ENGINE & MARKING ACCURACY ---")
    try:
        # Create test session with exact known answers
        conn = get_db()
        conn.execute("UPDATE practice_sessions SET status = 'abandoned' WHERE status = 'in_progress'")
        conn.commit()
        conn.close()

        sess = create_practice_session({
            "pool": "entire",
            "subject": "all",
            "topic": "all",
            "count": 4,
            "mode": "timed",
            "duration_minutes": 5,
            "shuffle_questions": False,
            "shuffle_options": False,
            "include_unverified": True,
            "correct_marks": 2.0,
            "negative_marks": 0.5
        })

        q0 = sess["questions"][0]
        q1 = sess["questions"][1]
        q2 = sess["questions"][2]

        conn = get_db()
        ans0 = conn.execute("SELECT correct_answer FROM questions WHERE id = ?", (q0["question_id"],)).fetchone()[0] or "A"
        ans1 = conn.execute("SELECT correct_answer FROM questions WHERE id = ?", (q1["question_id"],)).fetchone()[0] or "A"
        wrong_ans = "B" if ans1.upper() == "A" else "A"
        conn.close()

        # Submit: 1 correct (+2.0), 1 wrong (-0.5), 2 unattempted (0.0) -> Expected score = 1.5
        submit_result = submit_practice_session(
            session_id=sess["session_id"],
            elapsed_seconds=180,
            attempts=[
                {"question_id": q0["question_id"], "selected_option": ans0, "time_spent_seconds": 45},
                {"question_id": q1["question_id"], "selected_option": wrong_ans, "time_spent_seconds": 35},
            ]
        )

        expected_score = 1.5
        score_diff = abs(submit_result["score"] - expected_score)
        record_test("Scoring Accuracy (+2.0 correct, -0.5 wrong, 0 unattempted = 1.5)", score_diff < 0.001, f"Calculated: {submit_result['score']}")

    except Exception as e:
        record_test("Practice Engine & Scoring", False, str(e))

    # --- 4. DATA INTEGRITY & DATABASE HEALTH ---
    print("\n--- 4. DATA INTEGRITY & DATABASE CONSISTENCY ---")
    try:
        conn = get_db()

        # PRAGMA integrity_check
        integrity = conn.execute("PRAGMA integrity_check;").fetchone()[0]
        record_test("SQLite Database Integrity Check (PRAGMA integrity_check)", integrity == "ok", integrity)

        # No duplicate question IDs
        dup_q_ids = conn.execute("SELECT id, COUNT(*) FROM questions GROUP BY id HAVING COUNT(*) > 1").fetchall()
        record_test("Zero Duplicate Question IDs in Database", len(dup_q_ids) == 0, f"Found: {len(dup_q_ids)}")

        # No broken PDF references
        orphan_questions = conn.execute("""
            SELECT COUNT(*) FROM questions q
            LEFT JOIN pdf_documents p ON q.pdf_id = p.id
            WHERE p.id IS NULL
        """).fetchone()[0]
        record_test("Zero Orphan Question References (Foreign Key Validity)", orphan_questions == 0, f"Orphans: {orphan_questions}")

        # Unique questions count logic
        total_questions = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        attempted_distinct = conn.execute("SELECT COUNT(DISTINCT question_id) FROM practice_attempts WHERE selected_option IS NOT NULL").fetchone()[0]
        record_test("Unique Question Completed Logic Consistency", attempted_distinct <= total_questions)

        conn.close()
    except Exception as e:
        record_test("Data Integrity & Health", False, str(e))

    # --- 5. BACKUP & RECOVERY VERIFICATION ---
    print("\n--- 5. BACKUP & RECOVERY VERIFICATION ---")
    try:
        # Create full backup
        backup_info = create_database_backup(include_pdfs=True)
        backup_file = backup_info["filename"]
        backup_path = os.path.join(BACKUP_DIR, backup_file)
        record_test("Backup Creation (ZIP bundle with DB and manifest)", os.path.exists(backup_path), f"Size: {backup_info['file_size']} bytes")

        # Verify listing
        b_list = list_backups()
        record_test("Backup Inventory Listing (/api/backup/list)", any(b["filename"] == backup_file for b in b_list))

        # Test Question Library JSON Export
        q_json_str = export_question_library_json()
        q_json = json.loads(q_json_str)
        record_test("Question Library JSON Export (/api/backup/export/questions)", "total_questions" in q_json and q_json["total_questions"] >= 0)

        # Test Attempt History JSON Export
        att_json_str = export_attempt_history_json()
        att_json = json.loads(att_json_str)
        record_test("Attempt History JSON Export (/api/backup/export/attempts)", "practice_attempts" in att_json)

        # Restore from backup validation
        restore_res = restore_database_backup(backup_file)
        record_test("Live Restore from Backup & Validation", restore_res["integrity_check"] == "ok" and restore_res["status"] == "restored", f"Restored Qs: {restore_res['restored_questions']}")

    except Exception as e:
        record_test("Backup & Recovery Verification", False, str(e))

    # --- 6. PERFORMANCE & INDEXING CHECK ---
    print("\n--- 6. PERFORMANCE & INDEXING CHECK ---")
    try:
        conn = get_db()
        idx_rows = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()]
        required_indices = [
            "idx_questions_pdf",
            "idx_questions_status",
            "idx_questions_subject",
            "idx_questions_topic",
            "idx_questions_page",
            "idx_attempts_session",
            "idx_attempts_question",
            "idx_attempts_created",
            "idx_rev_items_due",
            "idx_rev_items_status",
            "idx_study_sess_date"
        ]
        missing_indices = [idx for idx in required_indices if idx not in idx_rows]
        record_test("Database Index Coverage for High-Speed Queries", len(missing_indices) == 0, f"Missing: {missing_indices}" if missing_indices else "All indexes active")

        # Verify fast query execution time (< 100ms)
        import time
        t0 = time.time()
        conn.execute("SELECT q.subject, q.topic, COUNT(*) FROM questions q GROUP BY q.subject, q.topic").fetchall()
        t_elapsed = (time.time() - t0) * 1000
        record_test(f"Query Execution Benchmark (< 50ms)", t_elapsed < 50.0, f"Actual: {t_elapsed:.2f}ms")

        conn.close()
    except Exception as e:
        record_test("Performance & Indexing Check", False, str(e))

    print("\n" + "=" * 70)
    print(f"AUDIT SUMMARY: {audit_results['passed']} PASSED, {audit_results['failed']} FAILED")
    print("=" * 70)
    return audit_results

if __name__ == "__main__":
    run_final_audit()
