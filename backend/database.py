import sqlite3
import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "study_os.db")

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS pdf_documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        sha256 TEXT UNIQUE NOT NULL,
        total_pages INTEGER DEFAULT 0,
        uploaded_at TEXT NOT NULL,
        status TEXT DEFAULT 'uploaded'
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        pdf_id TEXT NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'queued',
        total_pages INTEGER DEFAULT 0,
        processed_pages INTEGER DEFAULT 0,
        extracted_questions INTEGER DEFAULT 0,
        ocr_pages_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        pdf_id TEXT NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
        source_filename TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        page_end_number INTEGER NOT NULL,
        raw_question_number TEXT,
        question_text TEXT NOT NULL,
        options TEXT NOT NULL, -- JSON array: [{"label": "A", "text": "..."}]
        correct_answer TEXT,   -- "A", "B", "C", "D" or NULL
        explanation TEXT,
        subject TEXT,          -- "Quantitative Aptitude", "Reasoning", "English", "General Studies", or NULL
        topic TEXT,
        confidence REAL DEFAULT 0.85,
        verification_status TEXT DEFAULT 'unverified', -- 'unverified', 'verified', 'flagged', 'incomplete'
        page_image_url TEXT,
        diagram_image_url TEXT,
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of_id TEXT REFERENCES questions(id),
        normalized_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
        question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
        id TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        status TEXT NOT NULL, -- 'in_progress', 'completed', 'abandoned'
        current_index INTEGER DEFAULT 0,
        elapsed_seconds INTEGER DEFAULT 0,
        total_questions INTEGER NOT NULL,
        score REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS practice_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id),
        question_order INTEGER NOT NULL,
        options_json TEXT NOT NULL,
        selected_option TEXT,
        is_correct INTEGER,
        is_marked_for_review INTEGER DEFAULT 0,
        is_visited INTEGER DEFAULT 0,
        time_spent_seconds INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(session_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS revision_items (
        question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
        due_date TEXT NOT NULL,
        interval_days INTEGER DEFAULT 1,
        streak INTEGER DEFAULT 0,
        last_attempt_status TEXT, -- 'correct', 'incorrect', 'skipped', 'correct_difficult'
        mistake_category TEXT,
        user_notes TEXT,
        is_difficult INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revision_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        attempt_date TEXT NOT NULL,
        selected_option TEXT,
        is_correct INTEGER,
        mistake_category TEXT,
        interval_assigned INTEGER NOT NULL,
        due_date_assigned TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_seconds INTEGER NOT NULL,
        completed INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_goals (
        id TEXT PRIMARY KEY DEFAULT 'default',
        daily_hours_target REAL DEFAULT 2.0,
        daily_question_target INTEGER DEFAULT 50,
        subject_targets_json TEXT DEFAULT '{}',
        updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_sha256 ON pdf_documents(sha256);
    CREATE INDEX IF NOT EXISTS idx_questions_pdf ON questions(pdf_id);
    CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(verification_status);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_norm_hash ON questions(normalized_hash);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON import_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_attempts_session ON practice_attempts(session_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_question ON practice_attempts(question_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON practice_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_rev_items_due ON revision_items(due_date);
    CREATE INDEX IF NOT EXISTS idx_rev_items_status ON revision_items(last_attempt_status);
    CREATE INDEX IF NOT EXISTS idx_rev_items_difficult ON revision_items(is_difficult);
    CREATE INDEX IF NOT EXISTS idx_rev_logs_q ON revision_logs(question_id);
    CREATE INDEX IF NOT EXISTS idx_rev_logs_date ON revision_logs(attempt_date);
    CREATE INDEX IF NOT EXISTS idx_study_sess_date ON study_sessions(date);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_page ON questions(page_number);
    CREATE INDEX IF NOT EXISTS idx_attempts_created ON practice_attempts(created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_correct ON practice_attempts(is_correct);
    """)

    conn.commit()
    conn.close()

# --- Helpers ---

def create_document(doc_id: str, filename: str, file_path: str, file_size: int, sha256: str, total_pages: int = 0) -> Dict[str, Any]:
    conn = get_db()
    uploaded_at = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO pdf_documents (id, filename, file_path, file_size, sha256, total_pages, uploaded_at, status) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')",
        (doc_id, filename, file_path, file_size, sha256, total_pages, uploaded_at)
    )
    conn.commit()
    conn.close()
    return {
        "id": doc_id,
        "filename": filename,
        "file_size": file_size,
        "sha256": sha256,
        "total_pages": total_pages,
        "uploaded_at": uploaded_at,
        "status": "uploaded"
    }

def get_document_by_sha256(sha256: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute("SELECT * FROM pdf_documents WHERE sha256 = ?", (sha256,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute("SELECT * FROM pdf_documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_documents() -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM pdf_documents ORDER BY uploaded_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_job(job_id: str, pdf_id: str, total_pages: int) -> Dict[str, Any]:
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO import_jobs (id, pdf_id, status, total_pages, processed_pages, extracted_questions, ocr_pages_count, created_at, updated_at) "
        "VALUES (?, ?, 'queued', ?, 0, 0, 0, ?, ?)",
        (job_id, pdf_id, total_pages, now, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": job_id,
        "pdf_id": pdf_id,
        "status": "queued",
        "total_pages": total_pages,
        "processed_pages": 0,
        "extracted_questions": 0,
        "created_at": now,
        "updated_at": now
    }

def update_job(job_id: str, **kwargs) -> None:
    conn = get_db()
    kwargs['updated_at'] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE import_jobs SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute("SELECT * FROM import_jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def list_jobs() -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("""
        SELECT j.*, p.filename as pdf_filename
        FROM import_jobs j
        JOIN pdf_documents p ON j.pdf_id = p.id
        ORDER BY j.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_log(job_id: str, level: str, message: str) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO processing_logs (job_id, level, message, timestamp) VALUES (?, ?, ?, ?)",
        (job_id, level, message, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

def get_logs(job_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM processing_logs WHERE job_id = ? ORDER BY id ASC",
        (job_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Question Store ---

def insert_question(q: Dict[str, Any]) -> None:
    conn = get_db()
    options_json = json.dumps(q.get("options", [])) if isinstance(q.get("options"), list) else q.get("options", "[]")
    now = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO questions (
            id, pdf_id, source_filename, page_number, page_end_number, raw_question_number,
            question_text, options, correct_answer, explanation, subject, topic,
            confidence, verification_status, page_image_url, diagram_image_url,
            is_duplicate, duplicate_of_id, normalized_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        q["id"], q["pdf_id"], q["source_filename"], q["page_number"], q.get("page_end_number", q["page_number"]),
        q.get("raw_question_number"), q["question_text"], options_json, q.get("correct_answer"),
        q.get("explanation"), q.get("subject"), q.get("topic"), q.get("confidence", 0.85),
        q.get("verification_status", "unverified"), q.get("page_image_url"), q.get("diagram_image_url"),
        1 if q.get("is_duplicate") else 0, q.get("duplicate_of_id"), q.get("normalized_hash"),
        now, now
    ))
    conn.commit()
    conn.close()

def update_question_record(q_id: str, **kwargs) -> Optional[Dict[str, Any]]:
    conn = get_db()
    if 'options' in kwargs and isinstance(kwargs['options'], list):
        kwargs['options'] = json.dumps(kwargs['options'])
    kwargs['updated_at'] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [q_id]
    conn.execute(f"UPDATE questions SET {set_clause} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM questions WHERE id = ?", (q_id,)).fetchone()
    conn.close()
    if row:
        res = dict(row)
        res['options'] = json.loads(res['options']) if res['options'] else []
        return res
    return None

def get_question_record(q_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute("SELECT * FROM questions WHERE id = ?", (q_id,)).fetchone()
    conn.close()
    if row:
        res = dict(row)
        res['options'] = json.loads(res['options']) if res['options'] else []
        return res
    return None

def query_questions(
    pdf_id: Optional[str] = None,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    verification_status: Optional[str] = None,
    attempt_status: Optional[str] = None,
    search: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    conn = get_db()
    conditions = []
    params = []

    if pdf_id:
        conditions.append("pdf_id = ?")
        params.append(pdf_id)
    if subject:
        if subject == "uncategorised":
            conditions.append("subject IS NULL")
        else:
            conditions.append("subject = ?")
            params.append(subject)
    if topic:
        conditions.append("topic = ?")
        params.append(topic)
    if verification_status:
        if verification_status in ('flagged', 'requires_correction'):
            conditions.append("verification_status IN ('flagged', 'requires_correction')")
        elif verification_status in ('incomplete', 'unavailable_answer'):
            conditions.append("verification_status IN ('incomplete', 'unavailable_answer')")
        else:
            conditions.append("verification_status = ?")
            params.append(verification_status)
    if attempt_status:
        if attempt_status == 'unattempted':
            conditions.append("id NOT IN (SELECT DISTINCT question_id FROM practice_attempts WHERE selected_option IS NOT NULL)")
        elif attempt_status == 'incorrect':
            conditions.append("id IN (SELECT DISTINCT question_id FROM practice_attempts WHERE is_correct = 0)")
        elif attempt_status == 'attempted':
            conditions.append("id IN (SELECT DISTINCT question_id FROM practice_attempts WHERE selected_option IS NOT NULL)")
    if is_duplicate is not None:
        conditions.append("is_duplicate = ?")
        params.append(1 if is_duplicate else 0)
    if search:
        conditions.append("(question_text LIKE ? OR raw_question_number LIKE ?)")
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = conn.execute(f"SELECT COUNT(*) FROM questions {where_clause}", params)
    total_count = count_cursor.fetchone()[0]

    query = f"""
        SELECT * FROM questions
        {where_clause}
        ORDER BY page_number ASC, CAST(raw_question_number AS INTEGER) ASC
        LIMIT ? OFFSET ?
    """
    rows = conn.execute(query, params + [limit, offset]).fetchall()
    conn.close()

    items = []
    for r in rows:
        d = dict(r)
        d['options'] = json.loads(d['options']) if d['options'] else []
        items.append(d)

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "items": items
    }

def get_stats() -> Dict[str, Any]:
    conn = get_db()
    total_q = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    verified_q = conn.execute("SELECT COUNT(*) FROM questions WHERE verification_status = 'verified'").fetchone()[0]
    flagged_q = conn.execute("SELECT COUNT(*) FROM questions WHERE verification_status = 'flagged'").fetchone()[0]
    unverified_q = conn.execute("SELECT COUNT(*) FROM questions WHERE verification_status = 'unverified'").fetchone()[0]
    incomplete_q = conn.execute("SELECT COUNT(*) FROM questions WHERE verification_status = 'incomplete'").fetchone()[0]
    duplicates_count = conn.execute("SELECT COUNT(*) FROM questions WHERE is_duplicate = 1").fetchone()[0]
    total_docs = conn.execute("SELECT COUNT(*) FROM pdf_documents").fetchone()[0]

    subject_rows = conn.execute("SELECT COALESCE(subject, 'Uncategorised') as subj, COUNT(*) as cnt FROM questions GROUP BY subject").fetchall()
    by_subject = {r['subj']: r['cnt'] for r in subject_rows}

    conn.close()
    return {
        "total_questions": total_q,
        "verified_questions": verified_q,
        "flagged_questions": flagged_q,
        "unverified_questions": unverified_q,
        "incomplete_questions": incomplete_q,
        "duplicate_questions": duplicates_count,
        "total_documents": total_docs,
        "by_subject": by_subject
    }

# --- Practice Engine Methods ---

def get_topics_list(subject: Optional[str] = None) -> List[str]:
    conn = get_db()
    if subject and subject != "all":
        rows = conn.execute("SELECT DISTINCT topic FROM questions WHERE subject = ? AND topic IS NOT NULL ORDER BY topic", (subject,)).fetchall()
    else:
        rows = conn.execute("SELECT DISTINCT topic FROM questions WHERE topic IS NOT NULL ORDER BY topic").fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]

def toggle_question_bookmark(question_id: str) -> bool:
    conn = get_db()
    existing = conn.execute("SELECT 1 FROM bookmarks WHERE question_id = ?", (question_id,)).fetchone()
    if existing:
        conn.execute("DELETE FROM bookmarks WHERE question_id = ?", (question_id,))
        is_bookmarked = False
    else:
        now = datetime.utcnow().isoformat()
        conn.execute("INSERT INTO bookmarks (question_id, created_at) VALUES (?, ?)", (question_id, now))
        is_bookmarked = True
    conn.commit()
    conn.close()
    return is_bookmarked

def get_bookmarked_ids() -> List[str]:
    conn = get_db()
    rows = conn.execute("SELECT question_id FROM bookmarks").fetchall()
    conn.close()
    return [r[0] for r in rows]

def create_practice_session(config: Dict[str, Any]) -> Dict[str, Any]:
    import random
    import uuid

    pool = config.get("pool", "all_unattempted")
    subject = config.get("subject")
    topic = config.get("topic")
    mode = config.get("mode", "untimed")
    count = config.get("count", 10)
    shuffle_q = config.get("shuffle_questions", True)
    shuffle_opts = config.get("shuffle_options", False)
    include_unverified = config.get("include_unverified", False)

    conn = get_db()

    # Base query for questions
    where_clauses = []
    params: List[Any] = []

    # Verified filter:
    # "Never include unverified questions in scored tests by default"
    if not include_unverified and mode in ["timed", "strict"]:
        # Check if verified questions exist
        verified_count = conn.execute("SELECT COUNT(*) FROM questions WHERE verification_status = 'verified'").fetchone()[0]
        if verified_count > 0:
            where_clauses.append("verification_status = 'verified'")
        else:
            # If no questions are verified yet, allow unverified only if untimed or user agrees
            pass

    # Pool filter
    if pool == "specific_pdf" and config.get("pdf_id"):
        where_clauses.append("pdf_id = ?")
        params.append(config["pdf_id"])
    elif pool == "unattempted" or pool == "all_unattempted":
        where_clauses.append("id NOT IN (SELECT DISTINCT question_id FROM practice_attempts WHERE selected_option IS NOT NULL)")
    elif pool == "incorrect":
        where_clauses.append("id IN (SELECT DISTINCT question_id FROM practice_attempts WHERE is_correct = 0)")
    elif pool == "bookmarked":
        where_clauses.append("id IN (SELECT question_id FROM bookmarks)")

    # Subject & Topic filter (optional)
    if subject and subject != "all":
        where_clauses.append("subject = ?")
        params.append(subject)

    if topic and topic != "all":
        where_clauses.append("topic = ?")
        params.append(topic)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    query = f"SELECT * FROM questions {where_sql}"
    rows = conn.execute(query, params).fetchall()

    candidate_questions = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d["options"]) if d["options"] else []
        candidate_questions.append(d)

    if not candidate_questions:
        conn.close()
        raise ValueError("No questions found matching the chosen criteria.")

    # Shuffle questions if enabled
    if shuffle_q:
        random.shuffle(candidate_questions)

    # Slice question count
    if count != "all" and isinstance(count, int):
        candidate_questions = candidate_questions[:count]

    session_id = f"psess_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()
    config_json = json.dumps(config)

    conn.execute(
        "INSERT INTO practice_sessions (id, config, status, current_index, elapsed_seconds, total_questions, score, created_at, updated_at) "
        "VALUES (?, ?, 'in_progress', 0, 0, ?, 0, ?, ?)",
        (session_id, config_json, len(candidate_questions), now, now)
    )

    attempts_payload = []
    for idx, q in enumerate(candidate_questions):
        opts = list(q["options"])
        if shuffle_opts:
            # Shuffle option items while keeping labels standard
            random.shuffle(opts)

        opts_json = json.dumps(opts)
        conn.execute(
            "INSERT INTO practice_attempts (session_id, question_id, question_order, options_json, is_marked_for_review, is_visited, time_spent_seconds, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)",
            (session_id, q["id"], idx, opts_json, now, now)
        )

        attempts_payload.append({
            "question_id": q["id"],
            "question_order": idx,
            "question_text": q["question_text"],
            "raw_question_number": q["raw_question_number"],
            "source_filename": q["source_filename"],
            "page_number": q["page_number"],
            "page_end_number": q.get("page_end_number", q["page_number"]),
            "subject": q["subject"],
            "topic": q["topic"],
            "options": opts,
            "selected_option": None,
            "is_marked_for_review": 0,
            "is_visited": 1 if idx == 0 else 0,
            "time_spent_seconds": 0,
            "correct_answer": q.get("correct_answer"),
            "explanation": q.get("explanation"),
            "page_image_url": q.get("page_image_url"),
            "is_bookmarked": 0
        })

    # Mark first question visited
    conn.execute(
        "UPDATE practice_attempts SET is_visited = 1 WHERE session_id = ? AND question_order = 0",
        (session_id,)
    )

    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "config": config,
        "status": "in_progress",
        "current_index": 0,
        "elapsed_seconds": 0,
        "total_questions": len(candidate_questions),
        "questions": attempts_payload
    }

def get_active_practice_session() -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM practice_sessions WHERE status = 'in_progress' ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        conn.close()
        return None
    session_id = row["id"]
    conn.close()
    return get_practice_session_details(session_id)

def get_practice_session_details(session_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    s_row = conn.execute("SELECT * FROM practice_sessions WHERE id = ?", (session_id,)).fetchone()
    if not s_row:
        conn.close()
        return None

    session = dict(s_row)
    session["config"] = json.loads(session["config"]) if session["config"] else {}

    # Fetch attempts joined with questions
    att_rows = conn.execute("""
        SELECT a.*, q.question_text, q.raw_question_number, q.source_filename,
               q.page_number, q.page_end_number, q.subject, q.topic,
               q.correct_answer, q.explanation, q.page_image_url
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.session_id = ?
        ORDER BY a.question_order ASC
    """, (session_id,)).fetchall()

    bookmarked_rows = conn.execute("SELECT question_id FROM bookmarks").fetchall()
    bookmarked_set = set(r[0] for r in bookmarked_rows)
    conn.close()

    attempts = []
    for r in att_rows:
        d = dict(r)
        d["options"] = json.loads(d["options_json"]) if d["options_json"] else []
        d["is_bookmarked"] = 1 if d["question_id"] in bookmarked_set else 0
        attempts.append(d)

    session["questions"] = attempts
    return session

def update_practice_session_progress(
    session_id: str,
    current_index: int,
    elapsed_seconds: int,
    attempts: List[Dict[str, Any]]
) -> None:
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE practice_sessions SET current_index = ?, elapsed_seconds = ?, updated_at = ? WHERE id = ?",
        (current_index, elapsed_seconds, now, session_id)
    )

    for att in attempts:
        q_id = att.get("question_id")
        if not q_id:
            continue
        conn.execute("""
            UPDATE practice_attempts
            SET selected_option = ?,
                is_marked_for_review = ?,
                is_visited = ?,
                time_spent_seconds = ?,
                updated_at = ?
            WHERE session_id = ? AND question_id = ?
        """, (
            att.get("selected_option"),
            1 if att.get("is_marked_for_review") else 0,
            1 if att.get("is_visited") else 0,
            att.get("time_spent_seconds", 0),
            now,
            session_id,
            q_id
        ))

    conn.commit()
    conn.close()

def submit_practice_session(
    session_id: str,
    elapsed_seconds: int,
    attempts: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    conn = get_db()
    now = datetime.utcnow().isoformat()

    # Save any final attempts before scoring
    if attempts:
        for att in attempts:
            q_id = att.get("question_id")
            if not q_id:
                continue
            conn.execute("""
                UPDATE practice_attempts
                SET selected_option = ?,
                    is_marked_for_review = ?,
                    is_visited = ?,
                    time_spent_seconds = ?,
                    updated_at = ?
                WHERE session_id = ? AND question_id = ?
            """, (
                att.get("selected_option"),
                1 if att.get("is_marked_for_review") else 0,
                1 if att.get("is_visited") else 0,
                att.get("time_spent_seconds", 0),
                now,
                session_id,
                q_id
            ))

    s_row = conn.execute("SELECT * FROM practice_sessions WHERE id = ?", (session_id,)).fetchone()
    if not s_row:
        conn.close()
        raise ValueError("Session not found")

    config = json.loads(s_row["config"]) if s_row["config"] else {}
    correct_marks = float(config.get("correct_marks", 2.0))
    negative_marks = float(config.get("negative_marks", 0.5))

    # Evaluate all attempts
    rows = conn.execute("""
        SELECT a.*, q.correct_answer
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.session_id = ?
    """, (session_id,)).fetchall()

    correct_count = 0
    incorrect_count = 0
    skipped_count = 0

    for r in rows:
        sel = r["selected_option"]
        cor = r["correct_answer"]
        q_id = r["question_id"]

        if sel is None or sel == "":
            is_correct = None
            skipped_count += 1
        elif cor and sel.upper() == cor.upper():
            is_correct = 1
            correct_count += 1
        else:
            is_correct = 0
            incorrect_count += 1

        conn.execute(
            "UPDATE practice_attempts SET is_correct = ? WHERE session_id = ? AND question_id = ?",
            (is_correct, session_id, q_id)
        )
        record_question_attempt(conn, q_id, sel, is_correct)

    attempted_count = correct_count + incorrect_count
    accuracy = round((correct_count / attempted_count * 100.0), 1) if attempted_count > 0 else 0.0
    total_score = round((correct_count * correct_marks) - (incorrect_count * negative_marks), 2)

    conn.execute("""
        UPDATE practice_sessions
        SET status = 'completed',
            elapsed_seconds = ?,
            score = ?,
            completed_at = ?,
            updated_at = ?
        WHERE id = ?
    """, (elapsed_seconds, total_score, now, now, session_id))

    conn.commit()
    conn.close()

    # Return full results payload
    return get_practice_session_details(session_id)

def abandon_practice_session(session_id: str) -> None:
    conn = get_db()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE practice_sessions SET status = 'abandoned', updated_at = ? WHERE id = ?",
        (now, session_id)
    )
    conn.commit()
    conn.close()

# --- Phase 4: Smart Revision & Mistake Tracking Engine ---

def record_question_attempt(
    conn,
    question_id: str,
    selected_option: Optional[str],
    is_correct: Optional[int],
    mistake_category: Optional[str] = None,
    is_difficult: bool = False,
    notes: Optional[str] = None,
    attempt_date: Optional[str] = None
):
    from datetime import datetime, timedelta
    now_dt = datetime.utcnow()
    date_str = attempt_date or now_dt.strftime("%Y-%m-%d")
    now_iso = now_dt.isoformat()

    existing = conn.execute("SELECT * FROM revision_items WHERE question_id = ?", (question_id,)).fetchone()
    current_streak = existing["streak"] if existing else 0
    current_difficult = existing["is_difficult"] if existing else 0
    if is_difficult:
        current_difficult = 1

    if is_correct == 1:
        if current_difficult == 1:
            interval_days = 2
            new_streak = 0
            status = 'correct_difficult'
        elif current_streak >= 1:
            interval_days = 14
            new_streak = current_streak + 1
            status = 'correct'
        else:
            interval_days = 5
            new_streak = 1
            status = 'correct'
    elif is_correct == 0:
        interval_days = 1
        new_streak = 0
        status = 'incorrect'
    else:
        interval_days = 1
        new_streak = 0
        status = 'skipped'

    due_date = (now_dt + timedelta(days=interval_days)).strftime("%Y-%m-%d")
    effective_mistake = mistake_category or (existing["mistake_category"] if existing else None)

    if existing:
        conn.execute("""
            UPDATE revision_items
            SET due_date = ?,
                interval_days = ?,
                streak = ?,
                last_attempt_status = ?,
                mistake_category = COALESCE(?, mistake_category),
                is_difficult = ?,
                updated_at = ?
            WHERE question_id = ?
        """, (due_date, interval_days, new_streak, status, mistake_category, current_difficult, now_iso, question_id))
    else:
        conn.execute("""
            INSERT INTO revision_items (
                question_id, due_date, interval_days, streak,
                last_attempt_status, mistake_category, user_notes,
                is_difficult, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (question_id, due_date, interval_days, new_streak, status, effective_mistake, notes, current_difficult, now_iso, now_iso))

    conn.execute("""
        INSERT INTO revision_logs (
            question_id, attempt_date, selected_option, is_correct,
            mistake_category, interval_assigned, due_date_assigned, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (question_id, date_str, selected_option, is_correct, effective_mistake, interval_days, due_date, notes, now_iso))

def get_revision_stats() -> Dict[str, Any]:
    from datetime import datetime
    conn = get_db()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    due_count = conn.execute("SELECT COUNT(*) FROM revision_items WHERE due_date <= ?", (today_str,)).fetchone()[0]
    incorrect_count = conn.execute("SELECT COUNT(*) FROM revision_items WHERE last_attempt_status = 'incorrect'").fetchone()[0]
    skipped_count = conn.execute("SELECT COUNT(*) FROM revision_items WHERE last_attempt_status = 'skipped'").fetchone()[0]
    bookmarked_count = conn.execute("SELECT COUNT(*) FROM bookmarks").fetchone()[0]
    difficult_count = conn.execute("SELECT COUNT(*) FROM revision_items WHERE is_difficult = 1").fetchone()[0]
    total_attempted = conn.execute("SELECT COUNT(*) FROM revision_items").fetchone()[0]

    conn.close()
    return {
        "due_count": due_count,
        "incorrect_count": incorrect_count,
        "skipped_count": skipped_count,
        "bookmarked_count": bookmarked_count,
        "difficult_count": difficult_count,
        "total_attempted": total_attempted
    }

def get_revision_items_list(
    filter_type: str = "due",
    subject: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    from datetime import datetime
    conn = get_db()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    conditions = []
    params: List[Any] = []

    if filter_type == "due":
        conditions.append("r.due_date <= ?")
        params.append(today_str)
    elif filter_type == "incorrect":
        conditions.append("r.last_attempt_status = 'incorrect'")
    elif filter_type == "skipped":
        conditions.append("r.last_attempt_status = 'skipped'")
    elif filter_type == "bookmarked":
        conditions.append("b.question_id IS NOT NULL")
    elif filter_type == "difficult":
        conditions.append("r.is_difficult = 1")
    elif filter_type == "all_attempted":
        # Any question with attempts or revision items
        conditions.append("(r.question_id IS NOT NULL OR b.question_id IS NOT NULL)")

    if subject and subject != "all":
        conditions.append("q.subject = ?")
        params.append(subject)

    if search:
        conditions.append("(q.question_text LIKE ? OR q.raw_question_number LIKE ?)")
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_query = f"""
        SELECT COUNT(DISTINCT q.id)
        FROM questions q
        LEFT JOIN revision_items r ON q.id = r.question_id
        LEFT JOIN bookmarks b ON q.id = b.question_id
        {where_clause}
    """
    total = conn.execute(count_query, params).fetchone()[0]

    main_query = f"""
        SELECT q.*,
               r.due_date, r.interval_days, r.streak, r.last_attempt_status,
               r.mistake_category, r.user_notes, r.is_difficult,
               CASE WHEN b.question_id IS NOT NULL THEN 1 ELSE 0 END as is_bookmarked
        FROM questions q
        LEFT JOIN revision_items r ON q.id = r.question_id
        LEFT JOIN bookmarks b ON q.id = b.question_id
        {where_clause}
        ORDER BY
            CASE WHEN r.due_date <= '{today_str}' THEN 0 ELSE 1 END ASC,
            r.due_date ASC,
            q.page_number ASC
        LIMIT ? OFFSET ?
    """
    rows = conn.execute(main_query, params + [limit, offset]).fetchall()

    items = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d["options"]) if d["options"] else []

        # Fetch attempt history for this question
        history_rows = conn.execute("""
            SELECT id, attempt_date, selected_option, is_correct, mistake_category,
                   interval_assigned, due_date_assigned, created_at
            FROM revision_logs
            WHERE question_id = ?
            ORDER BY id DESC
        """, (d["id"],)).fetchall()
        d["attempts_history"] = [dict(h) for h in history_rows]

        # Latest attempt details
        latest = history_rows[0] if history_rows else None
        d["latest_attempt"] = dict(latest) if latest else None

        items.append(d)

    conn.close()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }

def record_reattempt(
    question_id: str,
    selected_option: str,
    mistake_category: Optional[str] = None,
    is_difficult: bool = False,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_db()
    q = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    if not q:
        conn.close()
        raise ValueError("Question not found")

    correct_answer = q["correct_answer"]
    is_correct = 1 if (correct_answer and selected_option.upper() == correct_answer.upper()) else 0

    record_question_attempt(
        conn=conn,
        question_id=question_id,
        selected_option=selected_option,
        is_correct=is_correct,
        mistake_category=mistake_category,
        is_difficult=is_difficult,
        notes=notes
    )

    conn.commit()
    conn.close()

    updated_item = get_revision_item_by_id(question_id)
    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "item": updated_item
    }

def get_revision_item_by_id(question_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute("""
        SELECT q.*,
               r.due_date, r.interval_days, r.streak, r.last_attempt_status,
               r.mistake_category, r.user_notes, r.is_difficult,
               CASE WHEN b.question_id IS NOT NULL THEN 1 ELSE 0 END as is_bookmarked
        FROM questions q
        LEFT JOIN revision_items r ON q.id = r.question_id
        LEFT JOIN bookmarks b ON q.id = b.question_id
        WHERE q.id = ?
    """, (question_id,)).fetchone()
    if not row:
        conn.close()
        return None

    d = dict(row)
    d["options"] = json.loads(d["options"]) if d["options"] else []

    history_rows = conn.execute("""
        SELECT id, attempt_date, selected_option, is_correct, mistake_category,
               interval_assigned, due_date_assigned, created_at
        FROM revision_logs
        WHERE question_id = ?
        ORDER BY id DESC
    """, (question_id,)).fetchall()
    d["attempts_history"] = [dict(h) for h in history_rows]
    d["latest_attempt"] = dict(history_rows[0]) if history_rows else None

    conn.close()
    return d

def classify_mistake(question_id: str, mistake_category: str) -> None:
    conn = get_db()
    now_iso = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE revision_items SET mistake_category = ?, updated_at = ? WHERE question_id = ?",
        (mistake_category, now_iso, question_id)
    )
    # Also update most recent log
    conn.execute("""
        UPDATE revision_logs
        SET mistake_category = ?
        WHERE id = (SELECT id FROM revision_logs WHERE question_id = ? ORDER BY id DESC LIMIT 1)
    """, (mistake_category, question_id))
    conn.commit()
    conn.close()

def toggle_difficult(question_id: str) -> bool:
    conn = get_db()
    row = conn.execute("SELECT is_difficult FROM revision_items WHERE question_id = ?", (question_id,)).fetchone()
    now_iso = datetime.utcnow().isoformat()
    if row:
        new_val = 0 if row["is_difficult"] == 1 else 1
        conn.execute("UPDATE revision_items SET is_difficult = ?, updated_at = ? WHERE question_id = ?", (new_val, now_iso, question_id))
    else:
        new_val = 1
        from datetime import datetime, timedelta
        due_date = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
        conn.execute("""
            INSERT INTO revision_items (question_id, due_date, interval_days, streak, last_attempt_status, is_difficult, created_at, updated_at)
            VALUES (?, ?, 2, 0, 'correct_difficult', 1, ?, ?)
        """, (question_id, due_date, now_iso, now_iso))
    conn.commit()
    conn.close()
    return bool(new_val)

# --- PHASE 5: ANALYTICS & PREPARATION INTELLIGENCE ---

def record_study_session(
    session_id: str,
    date: str,
    start_time: int,
    end_time: Optional[int],
    duration_seconds: int,
    completed: bool = True
) -> Dict[str, Any]:
    conn = get_db()
    now_iso = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO study_sessions (id, date, start_time, end_time, duration_seconds, completed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            date=excluded.date,
            start_time=excluded.start_time,
            end_time=excluded.end_time,
            duration_seconds=excluded.duration_seconds,
            completed=excluded.completed
    """, (session_id, date, start_time, end_time, duration_seconds, 1 if completed else 0, now_iso))
    conn.commit()
    conn.close()
    return {"id": session_id, "status": "saved"}

def get_study_goals() -> Dict[str, Any]:
    conn = get_db()
    row = conn.execute("SELECT * FROM study_goals WHERE id = 'default'").fetchone()
    conn.close()
    if row:
        return {
            "daily_hours_target": row["daily_hours_target"],
            "daily_question_target": row["daily_question_target"],
            "subject_targets": json.loads(row["subject_targets_json"]) if row["subject_targets_json"] else {}
        }
    return {
        "daily_hours_target": 2.0,
        "daily_question_target": 50,
        "subject_targets": {}
    }

def save_study_goals(daily_hours_target: float, daily_question_target: int, subject_targets: Dict[str, int]) -> Dict[str, Any]:
    conn = get_db()
    now_iso = datetime.utcnow().isoformat()
    targets_json = json.dumps(subject_targets or {})
    conn.execute("""
        INSERT INTO study_goals (id, daily_hours_target, daily_question_target, subject_targets_json, updated_at)
        VALUES ('default', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            daily_hours_target=excluded.daily_hours_target,
            daily_question_target=excluded.daily_question_target,
            subject_targets_json=excluded.subject_targets_json,
            updated_at=excluded.updated_at
    """, (daily_hours_target, daily_question_target, targets_json, now_iso))
    conn.commit()
    conn.close()
    return get_study_goals()

def get_analytics_overview(
    date_range: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    subject: Optional[str] = None
) -> Dict[str, Any]:
    from datetime import datetime, timedelta
    conn = get_db()
    today_dt = datetime.utcnow()
    today_str = today_dt.strftime("%Y-%m-%d")
    seven_days_ago_str = (today_dt - timedelta(days=7)).strftime("%Y-%m-%d")

    # Determine date filter boundaries
    date_filter_sql = ""
    date_filter_params: List[Any] = []

    if date_range == "today":
        date_filter_sql = " AND substr(created_at, 1, 10) = ? "
        date_filter_params.append(today_str)
    elif date_range == "7d":
        threshold = (today_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        date_filter_sql = " AND substr(created_at, 1, 10) >= ? "
        date_filter_params.append(threshold)
    elif date_range == "30d":
        threshold = (today_dt - timedelta(days=30)).strftime("%Y-%m-%d")
        date_filter_sql = " AND substr(created_at, 1, 10) >= ? "
        date_filter_params.append(threshold)
    elif date_range == "90d":
        threshold = (today_dt - timedelta(days=90)).strftime("%Y-%m-%d")
        date_filter_sql = " AND substr(created_at, 1, 10) >= ? "
        date_filter_params.append(threshold)
    elif date_range == "custom" and start_date:
        if end_date:
            date_filter_sql = " AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ? "
            date_filter_params.extend([start_date, end_date])
        else:
            date_filter_sql = " AND substr(created_at, 1, 10) >= ? "
            date_filter_params.append(start_date)

    # 1. Total Questions in Library
    sub_q = ""
    sub_params: List[Any] = []
    if subject and subject != "all":
        sub_q = " WHERE subject = ? "
        sub_params.append(subject)

    total_questions = conn.execute(f"SELECT COUNT(*) FROM questions {sub_q}", sub_params).fetchone()[0]

    # 2. Distinct Questions Attempted (Unique Questions)
    # Combining practice_attempts and revision_logs
    pa_filter = "WHERE a.selected_option IS NOT NULL"
    pa_params: List[Any] = []
    if date_filter_sql:
        pa_filter += date_filter_sql.replace("created_at", "a.created_at")
        pa_params.extend(date_filter_params)
    if subject and subject != "all":
        pa_filter += " AND q.subject = ?"
        pa_params.append(subject)

    unique_attempted_query = f"""
        SELECT COUNT(DISTINCT a.question_id)
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
    """
    unique_questions_attempted = conn.execute(unique_attempted_query, pa_params).fetchone()[0]
    unique_questions_remaining = max(0, total_questions - unique_questions_attempted)

    # 3. Total Attempts & Accuracy
    attempts_stats_query = f"""
        SELECT COUNT(*) as total_attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_attempts,
               COALESCE(AVG(CASE WHEN a.time_spent_seconds > 0 THEN a.time_spent_seconds ELSE NULL END), 0) as avg_time
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
    """
    att_row = conn.execute(attempts_stats_query, pa_params).fetchone()
    total_attempts = att_row["total_attempts"] if att_row else 0
    correct_attempts = att_row["correct_attempts"] if att_row else 0
    avg_time_per_question = round(att_row["avg_time"], 1) if att_row and att_row["avg_time"] else 0.0

    # Also account for revision_logs in total attempts count
    rev_filter = "WHERE r.selected_option IS NOT NULL"
    rev_params: List[Any] = []
    if date_filter_sql:
        rev_filter += date_filter_sql.replace("created_at", "r.created_at")
        rev_params.extend(date_filter_params)
    if subject and subject != "all":
        rev_filter += " AND q.subject = ?"
        rev_params.append(subject)

    rev_stats_query = f"""
        SELECT COUNT(*) as rev_total,
               COALESCE(SUM(CASE WHEN r.is_correct = 1 THEN 1 ELSE 0 END), 0) as rev_correct
        FROM revision_logs r
        JOIN questions q ON r.question_id = q.id
        {rev_filter}
    """
    rev_row = conn.execute(rev_stats_query, rev_params).fetchone()
    rev_attempts = rev_row["rev_total"] if rev_row else 0
    rev_correct = rev_row["rev_correct"] if rev_row else 0

    all_total_attempts = total_attempts + rev_attempts
    all_correct_attempts = correct_attempts + rev_correct
    overall_accuracy = round((all_correct_attempts / all_total_attempts) * 100, 1) if all_total_attempts > 0 else 0.0
    revision_success_rate = round((rev_correct / rev_attempts) * 100, 1) if rev_attempts > 0 else 0.0

    # 4. Study Times (from study_sessions)
    today_time = conn.execute("SELECT COALESCE(SUM(duration_seconds), 0) FROM study_sessions WHERE date = ?", (today_str,)).fetchone()[0]
    weekly_time = conn.execute("SELECT COALESCE(SUM(duration_seconds), 0) FROM study_sessions WHERE date >= ?", (seven_days_ago_str,)).fetchone()[0]
    total_active_time = conn.execute("SELECT COALESCE(SUM(duration_seconds), 0) FROM study_sessions").fetchone()[0]

    # 5. Revision Questions Due
    rev_due_count = conn.execute("SELECT COUNT(*) FROM revision_items WHERE due_date <= ?", (today_str,)).fetchone()[0]

    # 6. Subject-Wise Analytics
    sub_breakdown_query = f"""
        SELECT q.subject,
               COUNT(*) as total_attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_attempts,
               COALESCE(AVG(CASE WHEN a.time_spent_seconds > 0 THEN a.time_spent_seconds ELSE NULL END), 0) as avg_time,
               COUNT(DISTINCT a.question_id) as unique_questions
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
        GROUP BY q.subject
        ORDER BY total_attempts DESC
    """
    sub_rows = conn.execute(sub_breakdown_query, pa_params).fetchall()
    subject_wise = []
    for sr in sub_rows:
        t = sr["total_attempts"]
        c = sr["correct_attempts"]
        acc = round((c / t) * 100, 1) if t > 0 else 0.0
        subject_wise.append({
            "subject": sr["subject"] or "Uncategorised",
            "total_attempts": t,
            "correct_attempts": c,
            "accuracy_pct": acc,
            "avg_time_seconds": round(sr["avg_time"], 1),
            "unique_questions": sr["unique_questions"]
        })

    # 7. Topic-Wise Analytics
    topic_breakdown_query = f"""
        SELECT q.subject, q.topic,
               COUNT(*) as total_attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_attempts,
               COALESCE(AVG(CASE WHEN a.time_spent_seconds > 0 THEN a.time_spent_seconds ELSE NULL END), 0) as avg_time
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
        GROUP BY q.subject, q.topic
        ORDER BY total_attempts DESC
    """
    top_rows = conn.execute(topic_breakdown_query, pa_params).fetchall()
    topic_wise = []
    for tr in top_rows:
        t = tr["total_attempts"]
        c = tr["correct_attempts"]
        acc = round((c / t) * 100, 1) if t > 0 else 0.0
        topic_wise.append({
            "subject": tr["subject"] or "Uncategorised",
            "topic": tr["topic"] or "General",
            "total_attempts": t,
            "correct_attempts": c,
            "accuracy_pct": acc,
            "avg_time_seconds": round(tr["avg_time"], 1)
        })

    # 8. Activity Trends (Daily)
    trend_query = f"""
        SELECT substr(a.created_at, 1, 10) as day_date,
               COUNT(*) as attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct,
               COALESCE(SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END), 0) as incorrect
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
        GROUP BY day_date
        ORDER BY day_date ASC
        LIMIT 30
    """
    trend_rows = conn.execute(trend_query, pa_params).fetchall()
    trends = []
    for dr in trend_rows:
        d_str = dr["day_date"]
        att = dr["attempts"]
        cor = dr["correct"]
        inc = dr["incorrect"]
        acc = round((cor / att) * 100, 1) if att > 0 else 0.0
        # Study seconds for that day
        d_sec = conn.execute("SELECT COALESCE(SUM(duration_seconds), 0) FROM study_sessions WHERE date = ?", (d_str,)).fetchone()[0]
        trends.append({
            "date": d_str,
            "total_attempts": att,
            "correct": cor,
            "incorrect": inc,
            "accuracy_pct": acc,
            "study_seconds": d_sec
        })

    # 9. Monthly Improvement
    month_query = f"""
        SELECT substr(a.created_at, 1, 7) as month_str,
               COUNT(*) as attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        {pa_filter}
        GROUP BY month_str
        ORDER BY month_str ASC
    """
    month_rows = conn.execute(month_query, pa_params).fetchall()
    monthly_improvement = []
    for mr in month_rows:
        m_att = mr["attempts"]
        m_cor = mr["correct"]
        m_acc = round((m_cor / m_att) * 100, 1) if m_att > 0 else 0.0
        monthly_improvement.append({
            "month": mr["month_str"],
            "total_attempts": m_att,
            "correct": m_cor,
            "accuracy_pct": m_acc
        })

    # 10. Mistake Category Distribution
    mistakes_query = """
        SELECT mistake_category, COUNT(*) as count
        FROM revision_logs
        WHERE mistake_category IS NOT NULL AND mistake_category != ''
        GROUP BY mistake_category
        ORDER BY count DESC
    """
    mistake_rows = conn.execute(mistakes_query).fetchall()
    total_mistakes = sum(mr["count"] for mr in mistake_rows)
    mistake_distribution = []
    for mr in mistake_rows:
        c = mr["count"]
        pct = round((c / total_mistakes) * 100, 1) if total_mistakes > 0 else 0.0
        mistake_distribution.append({
            "category": mr["mistake_category"],
            "count": c,
            "percentage": pct
        })

    # 11. Preparation Intelligence Recommendations
    # a) Weakest topics (accuracy < 60% with attempts)
    weakest_topics = [t for t in topic_wise if t["accuracy_pct"] < 60.0]
    weakest_topics.sort(key=lambda x: (x["accuracy_pct"], -x["total_attempts"]))

    # b) Topics taking unusually long (> 1.25x average and > 30s)
    threshold_time = max(30.0, avg_time_per_question * 1.25)
    unusually_long_topics = [t for t in topic_wise if t["avg_time_seconds"] > threshold_time and t["total_attempts"] >= 1]
    unusually_long_topics.sort(key=lambda x: -x["avg_time_seconds"])

    # c) Questions repeatedly answered incorrectly (>= 2 incorrect attempts)
    repeat_wrong_query = """
        SELECT q.id, q.raw_question_number, q.subject, q.topic, q.question_text,
               COUNT(*) as fail_count
        FROM (
            SELECT question_id FROM practice_attempts WHERE is_correct = 0
            UNION ALL
            SELECT question_id FROM revision_logs WHERE is_correct = 0
        ) f
        JOIN questions q ON f.question_id = q.id
        GROUP BY q.id
        HAVING fail_count >= 2
        ORDER BY fail_count DESC
        LIMIT 10
    """
    repeat_wrong_rows = conn.execute(repeat_wrong_query).fetchall()
    repeatedly_incorrect = [dict(r) for r in repeat_wrong_rows]

    # d) Topics not practised recently (last attempt > 7 days ago or unpracticed)
    all_topics_rows = conn.execute("SELECT DISTINCT subject, topic FROM questions WHERE topic IS NOT NULL AND topic != ''").fetchall()
    neglected_topics = []
    for tr in all_topics_rows:
        subj = tr["subject"]
        top = tr["topic"]
        # check latest attempt date for this topic
        last_att = conn.execute("""
            SELECT MAX(a.created_at) as last_time
            FROM practice_attempts a
            JOIN questions q ON a.question_id = q.id
            WHERE q.subject = ? AND q.topic = ?
        """, (subj, top)).fetchone()
        last_time = last_att["last_time"] if last_att else None
        if not last_time:
            neglected_topics.append({"subject": subj, "topic": top, "status": "Never Practised", "last_attempt": None})
        elif last_time[:10] < seven_days_ago_str:
            neglected_topics.append({"subject": subj, "topic": top, "status": f"Inactive since {last_time[:10]}", "last_attempt": last_time[:10]})

    # e) Overdue Revision Questions
    overdue_rows = conn.execute("""
        SELECT q.id, q.raw_question_number, q.subject, q.topic, r.due_date, r.interval_days, r.streak
        FROM revision_items r
        JOIN questions q ON r.question_id = q.id
        WHERE r.due_date <= ?
        ORDER BY r.due_date ASC
        LIMIT 15
    """, (today_str,)).fetchall()
    overdue_questions = [dict(r) for r in overdue_rows]

    # Generate actionable intelligence recommendations based on actual data
    actionable_recommendations = []
    if overdue_questions:
        actionable_recommendations.append({
            "type": "overdue_revision",
            "priority": "high",
            "title": f"{len(overdue_questions)} Overdue Revision Drill{'s' if len(overdue_questions) > 1 else ''}",
            "description": f"You have {len(overdue_questions)} questions that have reached their spaced repetition gate. Review them now to prevent retention decay.",
            "target_section": "revision-centre"
        })

    if weakest_topics:
        w = weakest_topics[0]
        actionable_recommendations.append({
            "type": "weak_topic",
            "priority": "high",
            "title": f"Reinforce {w['topic']} ({w['subject']})",
            "description": f"Current accuracy is {w['accuracy_pct']}% across {w['total_attempts']} attempt(s). Focus targeted drills on this topic.",
            "target_section": "practice-arena"
        })

    if repeatedly_incorrect:
        actionable_recommendations.append({
            "type": "repeated_mistakes",
            "priority": "medium",
            "title": f"{len(repeatedly_incorrect)} Repeatedly Failed Questions",
            "description": f"{len(repeatedly_incorrect)} question(s) have been answered wrong 2 or more times. Inspect mistake categories and read explanations.",
            "target_section": "revision-centre"
        })

    # Priority Six: General Studies Performance Intelligence
    gs_stat = next((s for s in subject_wise if "general studies" in (s.get("subject") or "").lower()), None)
    other_active_subjects = [s for s in subject_wise if s != gs_stat and s.get("total_attempts", 0) >= 3]
    if gs_stat and gs_stat.get("total_attempts", 0) >= 3 and other_active_subjects:
        avg_other_acc = sum(s["accuracy_pct"] for s in other_active_subjects) / len(other_active_subjects)
        if gs_stat["accuracy_pct"] < avg_other_acc:
            actionable_recommendations.insert(0, {
                "type": "gs_retention_alert",
                "priority": "high",
                "title": "General Studies Performance Alert",
                "description": f"General Studies accuracy ({gs_stat['accuracy_pct']}%) is trailing other subjects ({round(avg_other_acc, 1)}% avg). Factual recall drills and daily spaced revision are strongly recommended.",
                "target_section": "practice-arena"
            })

    if unusually_long_topics:
        u = unusually_long_topics[0]
        actionable_recommendations.append({
            "type": "speed_optimization",
            "priority": "medium",
            "title": f"Speed Bottleneck in {u['topic']}",
            "description": f"Average time spent is {u['avg_time_seconds']}s per question (benchmark: {avg_time_per_question}s). Practice speed drills to reduce calculation overhead.",
            "target_section": "practice-arena"
        })

    if neglected_topics:
        n = neglected_topics[0]
        actionable_recommendations.append({
            "type": "retention_warning",
            "priority": "low",
            "title": f"Topic Dormancy: {n['topic']}",
            "description": f"You haven't practiced {n['topic']} in over a week ({n['status']}). Schedule a refresh session.",
            "target_section": "practice-arena"
        })

    # Goals and Today's progress
    goals = get_study_goals()
    today_questions_count = conn.execute("""
        SELECT COUNT(*) FROM practice_attempts WHERE substr(created_at, 1, 10) = ?
    """, (today_str,)).fetchone()[0]

    coverage_pct = round((unique_questions_attempted / total_questions) * 100, 1) if total_questions > 0 else 0.0

    conn.close()

    return {
        "dashboard_metrics": {
            "total_questions_in_library": total_questions,
            "unique_questions_attempted": unique_questions_attempted,
            "unique_questions_remaining": unique_questions_remaining,
            "unique_question_coverage_pct": coverage_pct,
            "total_attempts": all_total_attempts,
            "overall_accuracy": overall_accuracy,
            "today_study_time_seconds": today_time,
            "weekly_study_time_seconds": weekly_time,
            "total_active_study_time_seconds": total_active_time,
            "revision_due_count": rev_due_count,
        },
        "performance_analytics": {
            "subject_wise": subject_wise,
            "topic_wise": topic_wise,
            "avg_time_per_question": avg_time_per_question,
            "trends": trends,
            "monthly_improvement": monthly_improvement,
            "mistake_distribution": mistake_distribution,
            "revision_success_rate": revision_success_rate,
        },
        "preparation_intelligence": {
            "weakest_topics": weakest_topics[:5],
            "unusually_long_topics": unusually_long_topics[:5],
            "repeatedly_incorrect_questions": repeatedly_incorrect,
            "neglected_topics": neglected_topics[:5],
            "overdue_questions": overdue_questions,
            "actionable_recommendations": actionable_recommendations,
        },
        "goals_progress": {
            "daily_hours_target": goals["daily_hours_target"],
            "daily_question_target": goals["daily_question_target"],
            "subject_targets": goals["subject_targets"],
            "today_study_seconds": today_time,
            "today_hours_achieved": round(today_time / 3600.0, 2),
            "today_questions_achieved": today_questions_count,
        }
    }

# --- CSV REPORT GENERATION ---

def export_attempts_history_csv() -> str:
    import csv
    import io
    conn = get_db()
    rows = conn.execute("""
        SELECT a.id, a.created_at, a.question_id, q.raw_question_number, q.subject, q.topic,
               a.selected_option, a.is_correct, a.time_spent_seconds
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.selected_option IS NOT NULL
        ORDER BY a.created_at DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Attempt ID", "Timestamp", "Question ID", "Question Number",
        "Subject", "Topic", "Selected Option", "Is Correct", "Time Spent (Seconds)"
    ])
    for r in rows:
        writer.writerow([
            r["id"], r["created_at"], r["question_id"], r["raw_question_number"] or "",
            r["subject"] or "", r["topic"] or "", r["selected_option"] or "",
            1 if r["is_correct"] == 1 else 0, r["time_spent_seconds"] or 0
        ])
    return output.getvalue()

def export_incorrect_questions_csv() -> str:
    import csv
    import io
    conn = get_db()
    rows = conn.execute("""
        SELECT q.id, q.raw_question_number, q.subject, q.topic, q.question_text, q.correct_answer,
               r.mistake_category,
               COALESCE((
                   SELECT COUNT(*) FROM practice_attempts pa WHERE pa.question_id = q.id AND pa.is_correct = 0
               ), 0) + COALESCE((
                   SELECT COUNT(*) FROM revision_logs rl WHERE rl.question_id = q.id AND rl.is_correct = 0
               ), 0) as fail_count
        FROM questions q
        LEFT JOIN revision_items r ON q.id = r.question_id
        WHERE r.last_attempt_status = 'incorrect' OR r.last_attempt_status = 'correct_difficult'
        ORDER BY fail_count DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Question ID", "Question Number", "Subject", "Topic", "Question Text",
        "Correct Answer", "Mistake Category", "Total Incorrect Attempts"
    ])
    for r in rows:
        q_text = (r["question_text"] or "").replace("\n", " ")
        writer.writerow([
            r["id"], r["raw_question_number"] or "", r["subject"] or "", r["topic"] or "",
            q_text, r["correct_answer"] or "", r["mistake_category"] or "Unclassified",
            r["fail_count"]
        ])
    return output.getvalue()

def export_revision_records_csv() -> str:
    import csv
    import io
    conn = get_db()
    rows = conn.execute("""
        SELECT r.question_id, q.raw_question_number, q.subject, q.topic,
               r.due_date, r.interval_days, r.streak, r.last_attempt_status,
               r.mistake_category, r.is_difficult, r.updated_at
        FROM revision_items r
        JOIN questions q ON r.question_id = q.id
        ORDER BY r.due_date ASC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Question ID", "Question Number", "Subject", "Topic", "Due Date",
        "Interval Days", "Streak", "Last Attempt Status", "Mistake Category",
        "Is Difficult", "Last Updated"
    ])
    for r in rows:
        writer.writerow([
            r["question_id"], r["raw_question_number"] or "", r["subject"] or "", r["topic"] or "",
            r["due_date"], r["interval_days"], r["streak"], r["last_attempt_status"] or "",
            r["mistake_category"] or "", 1 if r["is_difficult"] == 1 else 0, r["updated_at"]
        ])
    return output.getvalue()

def export_study_time_history_csv() -> str:
    import csv
    import io
    conn = get_db()
    rows = conn.execute("""
        SELECT id, date, start_time, end_time, duration_seconds, completed, created_at
        FROM study_sessions
        ORDER BY date DESC, start_time DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Session ID", "Date", "Start Timestamp", "End Timestamp",
        "Duration Seconds", "Duration Formatted (HH:MM:SS)", "Status"
    ])
    for r in rows:
        sec = r["duration_seconds"] or 0
        hrs = sec // 3600
        mins = (sec % 3600) // 60
        secs = sec % 60
        fmt = f"{hrs:02d}:{mins:02d}:{secs:02d}"
        writer.writerow([
            r["id"], r["date"], r["start_time"], r["end_time"] or "",
            sec, fmt, "Completed" if r["completed"] == 1 else "Active/Paused"
        ])
    return output.getvalue()

def export_performance_summary_csv() -> str:
    import csv
    import io
    conn = get_db()
    rows = conn.execute("""
        SELECT q.subject, q.topic,
               COUNT(*) as total_attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_attempts,
               COALESCE(SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END), 0) as incorrect_attempts,
               COALESCE(AVG(CASE WHEN a.time_spent_seconds > 0 THEN a.time_spent_seconds ELSE NULL END), 0) as avg_time
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.selected_option IS NOT NULL
        GROUP BY q.subject, q.topic
        ORDER BY q.subject ASC, total_attempts DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Subject", "Topic", "Total Attempts", "Correct Attempts",
        "Incorrect Attempts", "Accuracy (%)", "Average Time (Seconds)"
    ])
    for r in rows:
        t = r["total_attempts"]
        c = r["correct_attempts"]
        i = r["incorrect_attempts"]
        acc = round((c / t) * 100, 1) if t > 0 else 0.0
        writer.writerow([
            r["subject"] or "Uncategorised", r["topic"] or "General",
            t, c, i, acc, round(r["avg_time"], 1)
        ])
    return output.getvalue()

# --- BACKUP & RECOVERY SYSTEM ---

BACKUP_DIR = os.path.join(os.path.dirname(DB_PATH), "backups")
UPLOADS_DIR = os.path.join(os.path.dirname(DB_PATH), "uploads")

def create_database_backup(include_pdfs: bool = True) -> Dict[str, Any]:
    import zipfile
    import hashlib
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    db_backup_filename = f"study_os_backup_{timestamp}.db"
    db_backup_path = os.path.join(BACKUP_DIR, db_backup_filename)

    # 1. Safe SQLite online backup
    src_conn = get_db()
    dest_conn = sqlite3.connect(db_backup_path)
    src_conn.backup(dest_conn)
    dest_conn.close()

    # Query metrics from source
    total_q = src_conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    total_att = src_conn.execute("SELECT COUNT(*) FROM practice_attempts WHERE selected_option IS NOT NULL").fetchone()[0]
    total_pdfs = src_conn.execute("SELECT COUNT(*) FROM pdf_documents").fetchone()[0]
    src_conn.close()

    # Hash DB backup
    with open(db_backup_path, "rb") as f:
        db_sha256 = hashlib.sha256(f.read()).hexdigest()

    manifest = {
        "backup_id": f"backup_{timestamp}",
        "created_at": datetime.utcnow().isoformat(),
        "total_questions": total_q,
        "total_attempts": total_att,
        "total_pdfs": total_pdfs,
        "db_sha256": db_sha256,
        "db_filename": db_backup_filename
    }

    bundle_filename = f"study_os_full_backup_{timestamp}.zip"
    bundle_path = os.path.join(BACKUP_DIR, bundle_filename)

    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add database
        zf.write(db_backup_path, arcname="study_os.db")
        # Add manifest
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        # Add original PDFs if requested
        if include_pdfs and os.path.exists(UPLOADS_DIR):
            for fname in os.listdir(UPLOADS_DIR):
                fpath = os.path.join(UPLOADS_DIR, fname)
                if os.path.isfile(fpath) and fname.lower().endswith(".pdf"):
                    zf.write(fpath, arcname=f"uploads/{fname}")

    bundle_size = os.path.getsize(bundle_path)
    return {
        "backup_id": manifest["backup_id"],
        "filename": bundle_filename,
        "db_filename": db_backup_filename,
        "file_size": bundle_size,
        "total_questions": total_q,
        "total_attempts": total_att,
        "total_pdfs": total_pdfs,
        "created_at": manifest["created_at"]
    }

def restore_database_backup(backup_target: str) -> Dict[str, Any]:
    import zipfile
    import shutil
    import tempfile

    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    # Resolve safe path within BACKUP_DIR
    clean_target = os.path.basename(backup_target)
    target_path = os.path.join(BACKUP_DIR, clean_target)
    if not os.path.exists(target_path):
        # Also check if user passed full path
        if os.path.exists(backup_target):
            target_path = backup_target
        else:
            raise ValueError(f"Backup file not found: {clean_target}")

    # Temporary validation workspace
    temp_dir = tempfile.mkdtemp()
    extracted_db_path = None

    try:
        if clean_target.lower().endswith(".zip"):
            with zipfile.ZipFile(target_path, "r") as zf:
                zf.extractall(temp_dir)
            extracted_db_path = os.path.join(temp_dir, "study_os.db")
            if not os.path.exists(extracted_db_path):
                raise ValueError("Backup bundle missing study_os.db")
        elif clean_target.lower().endswith(".db"):
            extracted_db_path = target_path
        else:
            raise ValueError(f"Unsupported backup file type: {clean_target}")

        # Integrity check on candidate DB
        test_conn = sqlite3.connect(extracted_db_path)
        check = test_conn.execute("PRAGMA integrity_check;").fetchone()[0]
        if check != "ok":
            test_conn.close()
            raise ValueError(f"Corrupt backup database: {check}")

        # Schema validation
        tables = [r[0] for r in test_conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        required_tables = ["pdf_documents", "questions", "practice_sessions", "revision_items"]
        missing = [t for t in required_tables if t not in tables]
        if missing:
            test_conn.close()
            raise ValueError(f"Backup missing required tables: {missing}")

        q_count = test_conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        pdf_count = test_conn.execute("SELECT COUNT(*) FROM pdf_documents").fetchone()[0]
        test_conn.close()

        # Safe live restore: copy extracted_db_path to DB_PATH
        # First checkpoint WAL
        try:
            live_conn = get_db()
            live_conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            live_conn.close()
        except Exception:
            pass

        shutil.copy2(extracted_db_path, DB_PATH)

        # Restore PDFs if present in bundle
        temp_uploads = os.path.join(temp_dir, "uploads")
        if os.path.exists(temp_uploads):
            for fname in os.listdir(temp_uploads):
                src_f = os.path.join(temp_uploads, fname)
                dest_f = os.path.join(UPLOADS_DIR, fname)
                if os.path.isfile(src_f) and not os.path.exists(dest_f):
                    shutil.copy2(src_f, dest_f)

        return {
            "status": "restored",
            "integrity_check": "ok",
            "restored_questions": q_count,
            "restored_pdfs": pdf_count,
            "restored_from": clean_target
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def list_backups() -> List[Dict[str, Any]]:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backups = []
    for fname in sorted(os.listdir(BACKUP_DIR), reverse=True):
        fpath = os.path.join(BACKUP_DIR, fname)
        if os.path.isfile(fpath) and (fname.endswith(".zip") or fname.endswith(".db")):
            size = os.path.getsize(fpath)
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat()
            backups.append({
                "filename": fname,
                "file_size": size,
                "modified_at": mtime,
                "type": "bundle" if fname.endswith(".zip") else "database_snapshot"
            })
    return backups

def export_question_library_json() -> str:
    conn = get_db()
    rows = conn.execute("""
        SELECT q.id, q.pdf_id, q.source_filename, q.page_number, q.page_end_number,
               q.raw_question_number, q.question_text, q.options, q.correct_answer,
               q.explanation, q.subject, q.topic, q.confidence, q.verification_status,
               q.created_at
        FROM questions q
        ORDER BY q.source_filename ASC, q.page_number ASC, CAST(q.raw_question_number AS INTEGER) ASC
    """).fetchall()
    conn.close()

    items = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d["options"]) if d["options"] else []
        items.append(d)

    return json.dumps({"total_questions": len(items), "questions": items}, indent=2)

def export_attempt_history_json() -> str:
    conn = get_db()
    pa_rows = conn.execute("""
        SELECT a.id, a.session_id, a.question_id, q.raw_question_number, q.subject, q.topic,
               a.selected_option, a.is_correct, a.time_spent_seconds, a.created_at
        FROM practice_attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE a.selected_option IS NOT NULL
        ORDER BY a.created_at DESC
    """).fetchall()

    rev_rows = conn.execute("""
        SELECT r.id, r.question_id, q.raw_question_number, q.subject, q.topic,
               r.selected_option, r.is_correct, r.mistake_category,
               r.interval_assigned, r.due_date_assigned, r.created_at
        FROM revision_logs r
        JOIN questions q ON r.question_id = q.id
        ORDER BY r.created_at DESC
    """).fetchall()
    conn.close()

    return json.dumps({
        "practice_attempts": [dict(r) for r in pa_rows],
        "revision_attempts": [dict(r) for r in rev_rows]
    }, indent=2)


