import os
import hashlib
import uuid
import threading
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .database import (
    init_db, create_document, get_document_by_sha256, get_document,
    list_documents, create_job, update_job, get_job, list_jobs,
    add_log, get_logs, insert_question, update_question_record,
    get_question_record, query_questions, get_stats,
    get_topics_list, toggle_question_bookmark, get_bookmarked_ids,
    create_practice_session, get_active_practice_session,
    get_practice_session_details, update_practice_session_progress,
    submit_practice_session, abandon_practice_session,
    get_revision_stats, get_revision_items_list, record_reattempt,
    classify_mistake, toggle_difficult,
    record_study_session, get_study_goals, save_study_goals,
    get_analytics_overview, export_attempts_history_csv,
    export_incorrect_questions_csv, export_revision_records_csv,
    export_study_time_history_csv, export_performance_summary_csv,
    create_database_backup, restore_database_backup, list_backups,
    export_question_library_json, export_attempt_history_json,
    BACKUP_DIR
)
from .extractor import PDFExtractor, ASSETS_DIR, PYMUPDF_AVAILABLE, PYTESSERACT_AVAILABLE

# Ensure directories exist
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# Initialize database
init_db()

app = FastAPI(title="RECALLIX — PDF Ingestion & Question Extraction Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve rendered page snapshots
app.mount("/assets/pages", StaticFiles(directory=ASSETS_DIR), name="page_assets")

# Background job worker thread
active_jobs_lock = threading.Lock()
active_workers: Dict[str, bool] = {}

def process_pdf_job(job_id: str, pdf_id: str, file_path: str, filename: str):
    try:
        update_job(job_id, status="processing")
        add_log(job_id, "INFO", f"Started ingestion for document: {filename}")

        def progress_cb(current_page, total_pages, message):
            # Check for cancellation
            job = get_job(job_id)
            if job and job.get("status") == "cancelled":
                raise InterruptedError("Job cancelled by user.")
            update_job(job_id, processed_pages=current_page, total_pages=total_pages)
            if current_page % 5 == 0 or current_page == total_pages:
                add_log(job_id, "INFO", f"Processed page {current_page}/{total_pages}")

        extractor = PDFExtractor(file_path=file_path, pdf_id=pdf_id, filename=filename)
        questions, meta = extractor.process(progress_callback=progress_cb)

        # Insert extracted questions into SQLite
        inserted_count = 0
        for q in questions:
            insert_question(q)
            inserted_count += 1

        update_job(
            job_id,
            status="completed",
            processed_pages=meta["total_pages"],
            total_pages=meta["total_pages"],
            extracted_questions=inserted_count,
            ocr_pages_count=meta.get("ocr_pages_count", 0)
        )
        add_log(job_id, "INFO", f"Successfully completed. Extracted {inserted_count} structured questions.")

    except InterruptedError:
        update_job(job_id, status="cancelled", error_message="Cancelled by user.")
        add_log(job_id, "WARN", "Job processing cancelled by user.")
    except Exception as e:
        update_job(job_id, status="failed", error_message=str(e))
        add_log(job_id, "ERROR", f"Processing failed: {str(e)}")

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "state": "operational",
        "pymupdf_available": PYMUPDF_AVAILABLE,
        "pytesseract_available": PYTESSERACT_AVAILABLE,
        "database": "sqlite_ready"
    }

@app.get("/api/stats")
def get_system_stats():
    return get_stats()

@app.post("/api/documents/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    results = []

    for file in files:
        safe_filename = os.path.basename(file.filename or "uploaded.pdf")
        if not safe_filename.lower().endswith(".pdf"):
            results.append({
                "filename": safe_filename,
                "error": True,
                "message": "Security Error: Only valid .pdf files are accepted."
            })
            continue

        content = await file.read()
        file_size = len(content)

        if file_size > 150 * 1024 * 1024:
            results.append({
                "filename": safe_filename,
                "error": True,
                "message": "File exceeds 150MB maximum upload limit."
            })
            continue

        if not content.startswith(b"%PDF"):
            results.append({
                "filename": safe_filename,
                "error": True,
                "message": "File validation failed: missing valid %PDF magic header."
            })
            continue

        sha256 = hashlib.sha256(content).hexdigest()

        # Duplicate file detection
        existing = get_document_by_sha256(sha256)
        if existing:
            results.append({
                "filename": safe_filename,
                "is_duplicate": True,
                "document_id": existing["id"],
                "message": f"Duplicate file detected: already uploaded as {existing['filename']}"
            })
            continue

        # Save to filesystem
        doc_id = str(uuid.uuid4())
        saved_filename = f"{sha256}.pdf"
        saved_path = os.path.join(UPLOAD_DIR, saved_filename)

        with open(saved_path, "wb") as f:
            f.write(content)

        # Get total pages and validate PDF integrity
        total_pages = 0
        try:
            import fitz
            doc = fitz.open(saved_path)
            total_pages = len(doc)
            doc.close()
        except Exception as e:
            if os.path.exists(saved_path):
                os.remove(saved_path)
            results.append({
                "filename": safe_filename,
                "error": True,
                "message": f"Malformed or corrupted PDF file: {str(e)}"
            })
            continue

        doc_record = create_document(
            doc_id=doc_id,
            filename=file.filename,
            file_path=saved_path,
            file_size=file_size,
            sha256=sha256,
            total_pages=total_pages
        )

        # Create background ingestion job
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        job_record = create_job(job_id=job_id, pdf_id=doc_id, total_pages=total_pages)

        # Dispatch background processing thread
        thread = threading.Thread(
            target=process_pdf_job,
            args=(job_id, doc_id, saved_path, file.filename),
            daemon=True
        )
        thread.start()

        results.append({
            "filename": file.filename,
            "is_duplicate": False,
            "document_id": doc_id,
            "job_id": job_id,
            "total_pages": total_pages,
            "status": "processing"
        })

    return {"uploaded": results, "results": results}

@app.get("/api/jobs")
def get_all_jobs():
    return list_jobs()

@app.get("/api/jobs/{job_id}")
def get_single_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    logs = get_logs(job_id)
    return {"job": job, "logs": logs}

@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    update_job(job_id, status="cancelled", error_message="Cancelled by user.")
    add_log(job_id, "WARN", "Cancellation requested by user.")
    return {"status": "cancelled", "job_id": job_id}

@app.post("/api/jobs/{job_id}/retry")
def retry_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    doc = get_document(job["pdf_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Underlying document not found")

    new_job_id = f"job_{uuid.uuid4().hex[:10]}"
    create_job(new_job_id, doc["id"], doc["total_pages"])

    thread = threading.Thread(
        target=process_pdf_job,
        args=(new_job_id, doc["id"], doc["file_path"], doc["filename"]),
        daemon=True
    )
    thread.start()

    return {"status": "retrying", "new_job_id": new_job_id}

@app.get("/api/questions")
def get_questions(
    pdf_id: Optional[str] = None,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    verification_status: Optional[str] = None,
    attempt_status: Optional[str] = None,
    search: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
):
    return query_questions(
        pdf_id=pdf_id,
        subject=subject,
        topic=topic,
        verification_status=verification_status,
        attempt_status=attempt_status,
        search=search,
        is_duplicate=is_duplicate,
        limit=limit,
        offset=offset
    )

@app.get("/api/questions/{question_id}")
def get_question(question_id: str):
    q = get_question_record(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q

class QuestionUpdatePayload(BaseModel):
    question_text: Optional[str] = None
    options: Optional[List[Dict[str, str]]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    verification_status: Optional[str] = None

@app.patch("/api/questions/{question_id}")
def update_question(question_id: str, payload: QuestionUpdatePayload):
    fields = payload.dict(exclude_unset=True)
    updated = update_question_record(question_id, **fields)
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated

@app.post("/api/questions/{question_id}/reprocess-page")
def reprocess_page(question_id: str):
    q = get_question_record(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    doc = get_document(q["pdf_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Source document not found")

    import fitz
    fitz_doc = fitz.open(doc["file_path"])
    page_idx = max(0, q["page_number"] - 1)
    if page_idx < len(fitz_doc):
        page = fitz_doc[page_idx]
        text = page.get_text("text")
        fitz_doc.close()
        return {"reprocessed_text": text, "page_number": q["page_number"]}

    fitz_doc.close()
    return {"message": "Page reprocessed"}

# --- Practice Engine Routes ---

@app.get("/api/documents")
def get_documents_list():
    return list_documents()

@app.get("/api/practice/topics")
def get_topics(subject: Optional[str] = None):
    return {"topics": get_topics_list(subject)}

@app.post("/api/practice/bookmarks/{question_id}/toggle")
def toggle_bookmark(question_id: str):
    is_bookmarked = toggle_question_bookmark(question_id)
    return {"question_id": question_id, "is_bookmarked": is_bookmarked}

@app.get("/api/practice/bookmarks")
def get_bookmarks():
    return {"bookmarked_ids": get_bookmarked_ids()}

class PracticeConfigPayload(BaseModel):
    pool: str = "all_unattempted"
    pdf_id: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    count: Any = 10
    mode: str = "untimed"
    duration_minutes: int = 15
    shuffle_questions: bool = True
    shuffle_options: bool = False
    include_unverified: bool = False
    correct_marks: float = 2.0
    negative_marks: float = 0.5

@app.post("/api/practice/sessions/create")
def create_session(payload: PracticeConfigPayload):
    try:
        session = create_practice_session(payload.dict())
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/practice/sessions/active")
def get_active_session():
    session = get_active_practice_session()
    return {"active_session": session}

@app.get("/api/practice/sessions/{session_id}")
def get_session(session_id: str):
    session = get_practice_session_details(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")
    return session

class ProgressPayload(BaseModel):
    current_index: int
    elapsed_seconds: int
    attempts: List[Dict[str, Any]]

@app.post("/api/practice/sessions/{session_id}/progress")
def save_progress(session_id: str, payload: ProgressPayload):
    update_practice_session_progress(
        session_id=session_id,
        current_index=payload.current_index,
        elapsed_seconds=payload.elapsed_seconds,
        attempts=payload.attempts
    )
    return {"status": "saved"}

class SubmitPayload(BaseModel):
    elapsed_seconds: int
    attempts: Optional[List[Dict[str, Any]]] = None

@app.post("/api/practice/sessions/{session_id}/submit")
def submit_session(session_id: str, payload: SubmitPayload):
    try:
        results = submit_practice_session(
            session_id=session_id,
            elapsed_seconds=payload.elapsed_seconds,
            attempts=payload.attempts
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/practice/sessions/{session_id}/abandon")
def abandon_session(session_id: str):
    abandon_practice_session(session_id)
    return {"status": "abandoned"}

# --- PHASE 4: SMART REVISION & MISTAKE TRACKER ---

@app.get("/api/revision/stats")
def get_revision_statistics():
    return get_revision_stats()

@app.get("/api/revision/items")
def get_revision_items(
    filter_type: str = "due",
    subject: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    return get_revision_items_list(
        filter_type=filter_type,
        subject=subject,
        search=search,
        limit=limit,
        offset=offset
    )

class ReattemptPayload(BaseModel):
    question_id: str
    selected_option: str
    mistake_category: Optional[str] = None
    is_difficult: bool = False
    notes: Optional[str] = None

@app.post("/api/revision/reattempt")
def api_record_reattempt(payload: ReattemptPayload):
    try:
        res = record_reattempt(
            question_id=payload.question_id,
            selected_option=payload.selected_option,
            mistake_category=payload.mistake_category,
            is_difficult=payload.is_difficult,
            notes=payload.notes
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/revision/items/{question_id}/reattempt")
def api_record_reattempt_item(question_id: str, payload: Dict[str, Any]):
    try:
        res = record_reattempt(
            question_id=question_id,
            selected_option=payload.get("selected_option", ""),
            mistake_category=payload.get("mistake_category"),
            is_difficult=payload.get("is_difficult", False),
            notes=payload.get("notes")
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

class ClassifyPayload(BaseModel):
    question_id: str
    mistake_category: str

@app.post("/api/revision/classify")
def api_classify_mistake(payload: ClassifyPayload):
    classify_mistake(payload.question_id, payload.mistake_category)
    return {"status": "success", "mistake_category": payload.mistake_category}

class ToggleDifficultPayload(BaseModel):
    question_id: str

@app.post("/api/revision/toggle-difficult")
def api_toggle_difficult(payload: ToggleDifficultPayload):
    new_state = toggle_difficult(payload.question_id)
    return {"question_id": payload.question_id, "is_difficult": new_state}

# --- PHASE 5: ANALYTICS & PREPARATION INTELLIGENCE ---

class StudySessionPayload(BaseModel):
    id: str
    date: str
    start_time: int
    end_time: Optional[int] = None
    duration_seconds: int
    completed: bool = True

@app.post("/api/study/sessions")
def api_record_study_session(payload: StudySessionPayload):
    return record_study_session(
        session_id=payload.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration_seconds=payload.duration_seconds,
        completed=payload.completed
    )

class StudyGoalsPayload(BaseModel):
    daily_hours_target: float
    daily_question_target: int
    subject_targets: Optional[Dict[str, int]] = None

@app.get("/api/study/goals")
def api_get_study_goals():
    return get_study_goals()

@app.post("/api/study/goals")
def api_save_study_goals(payload: StudyGoalsPayload):
    return save_study_goals(
        daily_hours_target=payload.daily_hours_target,
        daily_question_target=payload.daily_question_target,
        subject_targets=payload.subject_targets or {}
    )

@app.get("/api/analytics/overview")
def api_get_analytics_overview(
    date_range: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    subject: Optional[str] = None
):
    return get_analytics_overview(
        date_range=date_range,
        start_date=start_date,
        end_date=end_date,
        subject=subject
    )

@app.get("/api/reports/export")
def api_export_report(report_type: str = "attempts_history"):
    if report_type == "attempts_history":
        csv_content = export_attempts_history_csv()
        filename = "study_os_attempts_history.csv"
    elif report_type == "incorrect_questions":
        csv_content = export_incorrect_questions_csv()
        filename = "study_os_incorrect_questions.csv"
    elif report_type == "revision_records":
        csv_content = export_revision_records_csv()
        filename = "study_os_revision_records.csv"
    elif report_type == "study_time_history":
        csv_content = export_study_time_history_csv()
        filename = "study_os_study_time_history.csv"
    elif report_type == "performance_summary":
        csv_content = export_performance_summary_csv()
        filename = "study_os_performance_summary.csv"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

# --- PHASE 6: BACKUP & RECOVERY SYSTEM ---

@app.post("/api/backup/create")
def api_create_backup(include_pdfs: bool = True):
    try:
        res = create_database_backup(include_pdfs=include_pdfs)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")

@app.get("/api/backup/list")
def api_list_backups():
    return {"backups": list_backups()}

class RestorePayload(BaseModel):
    backup_target: str

@app.post("/api/backup/restore")
def api_restore_backup(payload: RestorePayload):
    try:
        res = restore_database_backup(payload.backup_target)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

@app.get("/api/backup/download/{filename}")
def api_download_backup(filename: str):
    clean_name = os.path.basename(filename)
    file_path = os.path.join(BACKUP_DIR, clean_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup file not found")

    with open(file_path, "rb") as f:
        content = f.read()

    media_type = "application/zip" if clean_name.endswith(".zip") else "application/x-sqlite3"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{clean_name}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.get("/api/backup/export/questions")
def api_export_questions_json():
    json_data = export_question_library_json()
    return Response(
        content=json_data,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="study_os_questions_export.json"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.get("/api/backup/export/attempts")
def api_export_attempts_json():
    json_data = export_attempt_history_json()
    return Response(
        content=json_data,
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="study_os_attempts_export.json"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

