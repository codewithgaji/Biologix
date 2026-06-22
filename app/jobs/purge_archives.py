from datetime import datetime, timezone
from db.database import SessionLocal
from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
import logging

logger = logging.getLogger(__name__)

def purge_expired_archives_job():
    db = SessionLocal()
    try:
        now     = datetime.now(timezone.utc)
        expired = db.query(ArchivedEmployee).filter(
            ArchivedEmployee.purge_after <= now
        ).all()

        purged_employees = 0
        purged_logs      = 0

        for record in expired:
            log_count = db.query(ArchivedAttendanceLog).filter(
                ArchivedAttendanceLog.archived_employee_id == record.id
            ).delete(synchronize_session=False)
            purged_logs      += log_count
            db.delete(record)
            purged_employees += 1

        db.commit()
        logger.info(f"[Purge Job] {purged_employees} employees, {purged_logs} logs purged at {now}")

    except Exception as e:
        db.rollback()
        logger.error(f"[Purge Job] Failed: {e}")
    finally:
        db.close()