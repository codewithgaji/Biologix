from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date

from db.database import get_db
from db.models.admin_user import AdminUser
from db.models.attendance import AttendanceLog
from db.models.audit_log import AuditAction
from db.schemas.db_admin import DbStatsResponse, TableStat
from core.security.dependencies import get_current_superuser
from core.audit import log_critical

import os
import tempfile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from db.models.backup import DbBackup
from db.schemas.db_admin import BackupRecord
from core.backup import run_pg_dump, generate_backup_filename

# Must match BIOLOGIX_TABLES in alembic/env.py — this DB is shared with
# Blue World Verifier, so stats/purge/backup must never touch its tables.
BIOLOGIX_TABLES = {
    "employees", "attendance_logs", "departments", "holidays", "leaves",
    "archived_employees", "archived_attendance_logs", "admin_users",
    "critical_logs", "activity_logs", "import_snapshots",
}

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix = "/db-admin",
    tags   = ["DB Admin"],
)


# ─── GET DB stats — superuser only ────────────────────────────────────────────
@router.get("/stats", response_model=DbStatsResponse)
def get_db_stats(
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    total_size_row = db.execute(
        text("SELECT pg_size_pretty(pg_database_size(current_database())) AS total_size")
    ).first()

    table_rows = db.execute(text("""
        SELECT
            relname AS table_name,
            n_live_tup AS row_count,
            pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS total_size,
            pg_total_relation_size(quote_ident(relname)) AS size_bytes
        FROM pg_stat_user_tables
        WHERE relname = ANY(:table_names)
        ORDER BY size_bytes DESC
    """), {"table_names": list(BIOLOGIX_TABLES)}).fetchall()

    tables = [
        TableStat(
            table_name = row.table_name,
            row_count  = row.row_count,
            total_size = row.total_size,
            size_bytes = row.size_bytes,
        )
        for row in table_rows
    ]

    return DbStatsResponse(
        total_size = total_size_row.total_size,
        tables     = tables,
    )


# ─── GET purge preview — superuser only ───────────────────────────────────────
@router.get("/purge/attendance/preview")
def preview_attendance_purge(
    date_from         : date      = Query(...),
    date_to           : date      = Query(...),
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be before date_to")

    count = db.query(AttendanceLog).filter(
        AttendanceLog.date >= date_from,
        AttendanceLog.date <= date_to,
    ).count()

    return {
        "count"     : count,
        "date_from" : date_from.isoformat(),
        "date_to"   : date_to.isoformat(),
    }


# ─── DELETE purge attendance by date range — superuser only ──────────────────
@router.delete("/purge/attendance")
def purge_attendance(
    date_from         : date      = Query(...),
    date_to           : date      = Query(...),
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be before date_to")

    deleted = db.query(AttendanceLog).filter(
        AttendanceLog.date >= date_from,
        AttendanceLog.date <= date_to,
    ).delete(synchronize_session=False)

    log_critical(
        db           = db,
        action       = AuditAction.attendance_purged,
        performed_by = current_superuser.email,
        target_type  = "attendance_logs",
        notes        = f"Purged {deleted} records between {date_from} and {date_to}",
    )

    db.commit()

    return {
        "deleted"   : deleted,
        "date_from" : date_from.isoformat(),
        "date_to"   : date_to.isoformat(),
    }





# ─── GET manual backup download — superuser only ─────────────────────────────
@router.get("/backup/download")
def download_backup(
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    filename = generate_backup_filename()
    tmp_path = os.path.join(tempfile.gettempdir(), filename)

    try:
        run_pg_dump(tmp_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    log_critical(
        db           = db,
        action       = AuditAction.data_exported,
        performed_by = current_superuser.email,
        target_type  = "database_backup",
        notes        = f"Manual backup downloaded: {filename}",
    )
    db.commit()

    return FileResponse(
        path       = tmp_path,
        filename   = filename,
        media_type = "application/octet-stream",
        background = BackgroundTask(os.remove, tmp_path),
    )


# ─── GET backup history — superuser only 
@router.get("/backup/history", response_model=list[BackupRecord])
def get_backup_history(
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    return db.query(DbBackup).order_by(DbBackup.created_at.desc()).all()


# ─── GET download a specific historical backup — superuser only ─────────────
@router.get("/backup/{backup_id}/download")
def download_historical_backup(
    backup_id         : int,
    db                : Session   = Depends(get_db),
    current_superuser : AdminUser = Depends(get_current_superuser),
):
    record = db.query(DbBackup).filter(DbBackup.id == backup_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Backup not found")

    if not os.path.exists(record.storage_path):
        raise HTTPException(status_code=410, detail="Backup file no longer exists on disk")

    return FileResponse(
        path       = record.storage_path,
        filename   = record.filename,
        media_type = "application/octet-stream",
    )