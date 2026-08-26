from datetime import datetime, timezone
import os

from db.database import SessionLocal
from db.models.backup import DbBackup
from core.backup import run_pg_dump, generate_backup_filename, BACKUP_DIR


def run_scheduled_backup():
    """
    Weekly automated backup — Sunday 3AM per handoff doc Priority 5.
    Saves to local disk and records metadata in db_backups.

    NOTE: local disk is EPHEMERAL on Railway/Render (wiped on redeploy).
    If you deploy there, point BACKUP_DIR at a persistent volume, or
    swap this for Supabase Storage before relying on it for real recovery.
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)

    filename    = generate_backup_filename()
    output_path = os.path.join(BACKUP_DIR, filename)

    run_pg_dump(output_path)
    size_bytes = os.path.getsize(output_path)

    db = SessionLocal()
    try:
        backup = DbBackup(
            filename     = filename,
            size_bytes   = size_bytes,
            storage_path = output_path,
            created_at   = datetime.now(timezone.utc),
        )
        db.add(backup)
        db.commit()
    finally:
        db.close()