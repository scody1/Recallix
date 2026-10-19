import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "study_os.db")

def audit_database():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("==================================================")
    print(" STUDY OS — ACTUAL DATABASE AUDIT INSPECTION")
    print("==================================================")
    print(f"Database File: {os.path.abspath(DB_PATH)}")
    print(f"Database Size: {os.path.getsize(DB_PATH)} bytes")

    tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
    print("\n--- TABLE RECORD COUNTS ---")
    for t in tables:
        count = cursor.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:20s}: {count:4d} records")

    print("\n--- UPLOADED PDF DOCUMENTS ---")
    docs = cursor.execute("SELECT id, filename, uploaded_at, total_pages, status, file_size FROM pdf_documents").fetchall()
    for d in docs:
        print(f"  [{d['id'][:8]}] {d['filename']:35s} | Pages: {d['total_pages']} | Size: {d['file_size']}B | Uploaded: {d['uploaded_at']}")

    print("\n--- TEST RECORDS VS PRODUCTION DATA IDENTIFICATION ---")
    test_docs = [d for d in docs if "test" in d["filename"].lower() or "sample" in d["filename"].lower()]
    real_docs = [d for d in docs if d not in test_docs]
    print(f"  Automated Test Documents Identified: {len(test_docs)}")
    for td in test_docs:
        q_count = cursor.execute("SELECT COUNT(*) FROM questions WHERE pdf_id = ?", (td["id"],)).fetchone()[0]
        print(f"    - ID: {td['id']} | Filename: {td['filename']} | Associated Questions: {q_count}")

    print(f"  Candidate Real / Base Documents: {len(real_docs)}")
    for rd in real_docs:
        q_count = cursor.execute("SELECT COUNT(*) FROM questions WHERE pdf_id = ?", (rd["id"],)).fetchone()[0]
        print(f"    - ID: {rd['id']} | Filename: {rd['filename']} | Associated Questions: {q_count}")

    print("\n--- PRACTICE SESSIONS AUDIT ---")
    sessions = cursor.execute("SELECT id, status, total_questions, score, created_at FROM practice_sessions ORDER BY created_at DESC LIMIT 10").fetchall()
    for s in sessions:
        print(f"  [{s['id']}] Status: {s['status']:12s} | Qs: {s['total_questions']} | Score: {s['score']} | Date: {s['created_at']}")

    print("\n--- REVISION QUEUE AUDIT ---")
    rev_count = cursor.execute("SELECT COUNT(*) FROM revision_items").fetchone()[0]
    rev_logs = cursor.execute("SELECT COUNT(*) FROM revision_logs").fetchone()[0]
    print(f"  Revision Items: {rev_count} | Revision Logs: {rev_logs}")

    conn.close()

if __name__ == "__main__":
    audit_database()
