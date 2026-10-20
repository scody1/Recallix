import os
import sys
import sqlite3
import shutil

ORIGINAL_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "study_os.db")
ARCHIVE_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "study_os_test_archive.db")

def verify_and_archive():
    print("=" * 65)
    print(" STEP 1: INSPECTING ORIGINAL DATABASE")
    print("=" * 65)

    if not os.path.exists(ORIGINAL_DB_PATH):
        raise FileNotFoundError(f"Original database not found at {ORIGINAL_DB_PATH}")

    if os.path.exists(ARCHIVE_DB_PATH):
        raise FileExistsError(f"Archive database already exists at {ARCHIVE_DB_PATH}. Aborting to avoid overwrite.")

    orig_conn = sqlite3.connect(ORIGINAL_DB_PATH)
    orig_conn.row_factory = sqlite3.Row

    # 1. Integrity check on original
    integrity = orig_conn.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"Original database integrity check failed: {integrity}")
    print(f"-> Original DB Integrity Check: {integrity}")

    # 2. Get list of user tables (excluding sqlite internal tables)
    tables_cursor = orig_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    tables = [row["name"] for row in tables_cursor.fetchall()]
    print(f"-> Discovered {len(tables)} tables: {', '.join(tables)}")

    # 3. Count rows per table in original
    orig_counts = {}
    for tbl in tables:
        count = orig_conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        orig_counts[tbl] = count
        print(f"   - {tbl:25s}: {count:6d} records")

    print("\n" + "=" * 65)
    print(" STEP 2: CREATING VERIFIED SQLITE BACKUP")
    print("=" * 65)

    # Use SQLite's online backup API for transactionally complete copy
    archive_conn = sqlite3.connect(ARCHIVE_DB_PATH)
    archive_conn.row_factory = sqlite3.Row
    orig_conn.backup(archive_conn)
    archive_conn.commit()
    print(f"-> Backup written to: {ARCHIVE_DB_PATH} ({os.path.getsize(ARCHIVE_DB_PATH) / 1024:.1f} KB)")

    print("\n" + "=" * 65)
    print(" STEP 3: INDEPENDENT VERIFICATION OF ARCHIVED DATABASE")
    print("=" * 65)

    archive_integrity = archive_conn.execute("PRAGMA integrity_check").fetchone()[0]
    if archive_integrity != "ok":
        archive_conn.close()
        orig_conn.close()
        raise RuntimeError(f"Archived database integrity check failed: {archive_integrity}")
    print(f"-> Archived DB Integrity Check: {archive_integrity}")

    # Check tables in archived DB
    arch_tables_cursor = archive_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    arch_tables = [row["name"] for row in arch_tables_cursor.fetchall()]

    if tables != arch_tables:
        archive_conn.close()
        orig_conn.close()
        raise AssertionError(f"Table mismatch! Original: {tables}, Archive: {arch_tables}")

    print(f"-> Table lists match exactly ({len(arch_tables)} tables)")

    # Compare row counts
    arch_counts = {}
    mismatch_found = False
    for tbl in arch_tables:
        c = archive_conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        arch_counts[tbl] = c
        match_str = "MATCH" if c == orig_counts[tbl] else "MISMATCH!"
        print(f"   - {tbl:25s}: Original={orig_counts[tbl]:5d} | Archive={c:5d} -> {match_str}")
        if c != orig_counts[tbl]:
            mismatch_found = True

    if mismatch_found:
        archive_conn.close()
        orig_conn.close()
        raise AssertionError("Record count mismatch between original and archive! Aborting.")

    # Compare table schemas (CREATE TABLE statements)
    for tbl in tables:
        orig_sql = orig_conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (tbl,)).fetchone()[0]
        arch_sql = archive_conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (tbl,)).fetchone()[0]
        if orig_sql != arch_sql:
            raise AssertionError(f"Schema definition mismatch for table '{tbl}'!")

    print("-> Schema definitions for all tables match byte-for-byte!")

    archive_conn.close()
    orig_conn.close()

    print("\n" + "=" * 65)
    print(" STEP 4: BACKUP INDEPENDENTLY VERIFIED — INITIALIZING FRESH DB")
    print("=" * 65)

    # Remove the active test db file and associated WAL/SHM files
    wal_path = ORIGINAL_DB_PATH + "-wal"
    shm_path = ORIGINAL_DB_PATH + "-shm"

    if os.path.exists(ORIGINAL_DB_PATH):
        os.remove(ORIGINAL_DB_PATH)
    if os.path.exists(wal_path):
        os.remove(wal_path)
    if os.path.exists(shm_path):
        os.remove(shm_path)

    # Now import and call init_db from backend.database to generate fresh schema
    from backend.database import init_db, get_db
    init_db()

    # Verify fresh database
    fresh_conn = get_db()
    fresh_integrity = fresh_conn.execute("PRAGMA integrity_check").fetchone()[0]
    print(f"-> Fresh DB Integrity Check: {fresh_integrity}")

    fresh_tables_cursor = fresh_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    fresh_tables = [row["name"] for row in fresh_tables_cursor.fetchall()]
    print(f"-> Fresh DB initialized with {len(fresh_tables)} tables: {', '.join(fresh_tables)}")

    fresh_counts = {}
    for tbl in fresh_tables:
        c = fresh_conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        fresh_counts[tbl] = c
        print(f"   - {tbl:25s}: {c} records")

    fresh_conn.close()

    print("\n" + "=" * 65)
    print(" ARCHIVE AND RESET SUMMARY")
    print("=" * 65)
    print(f"Archive Database Location : {ARCHIVE_DB_PATH}")
    print(f"Fresh Database Location   : {ORIGINAL_DB_PATH}")
    print("Status                    : COMPLETE & VERIFIED")

    return {
        "archive_path": ARCHIVE_DB_PATH,
        "original_counts": orig_counts,
        "archive_counts": arch_counts,
        "fresh_counts": fresh_counts
    }

if __name__ == "__main__":
    verify_and_archive()
