import subprocess
import os
import shutil
from datetime import datetime, timezone
from decouple import config

# Must match BIOLOGIX_TABLES in alembic/env.py and db_admin_router.py —
# this DB is shared with Blue World Verifier, so backups must never touch its tables.
BIOLOGIX_TABLES = [
    "employees", "attendance_logs", "departments", "holidays", "leaves",
    "archived_employees", "archived_attendance_logs", "admin_users",
    "critical_logs", "activity_logs", "import_snapshots", "db_backups",
    "import_files"
]

PG_DUMP_PATH = config("PG_DUMP_PATH", default="pg_dump")
BACKUP_DIR   = config("BACKUP_DIR",   default="./backups")
DATABASE_URL = config("DATABASE_URL")


def run_pg_dump(output_path: str) -> None:
    """
    Runs pg_dump scoped to BIOLOGIX_TABLES only, in custom format (-Fc) —
    restorable elsewhere via `pg_restore`. Raises RuntimeError with a
    clear message on failure, whether pg_dump errored out or isn't
    installed/on PATH at all.
    """
    resolved_path = shutil.which(PG_DUMP_PATH) or PG_DUMP_PATH
    if not shutil.which(PG_DUMP_PATH) and not os.path.isfile(PG_DUMP_PATH):
        raise RuntimeError(
            f"pg_dump not found at '{PG_DUMP_PATH}'. Set PG_DUMP_PATH in .env "
            f"to the full path of pg_dump (e.g. on Windows: "
            f"C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe)"
        )

    table_args = []
    for t in BIOLOGIX_TABLES:
        table_args += ["-t", t]

    cmd = [resolved_path, DATABASE_URL, "-Fc", "-f", output_path, *table_args]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
    except OSError as e:
        raise RuntimeError(f"Failed to execute pg_dump: {e}")

    if result.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {result.stderr.strip()}")


def generate_backup_filename() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"biologix_backup_{ts}.dump"