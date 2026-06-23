# routers/archive_router.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timezone

from db.database import get_db
from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
from db.schemas.archive import ArchivedEmployeeResponse, ArchivedEmployeeSummary
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/archive",
    tags=["Archive"],
    dependencies=[Depends(get_current_admin)]
)


@router.get("/", response_model=List[ArchivedEmployeeSummary])
def get_archived_employees(db: Session = Depends(get_db)):
    """
    List all archived employees with log count.
    Used for the archive table page.
    """
    rows = db.query(ArchivedEmployee).order_by(ArchivedEmployee.archived_at.desc()).all()

    result = []
    for emp in rows:
        log_count = db.query(func.count(ArchivedAttendanceLog.id)).filter(
            ArchivedAttendanceLog.archived_employee_id == emp.id
        ).scalar()
        summary = ArchivedEmployeeSummary(
            id               = emp.id,
            original_user_id = emp.original_user_id,
            badge_number     = emp.badge_number,
            name             = emp.name,
            position         = emp.position,
            department_name  = emp.department_name,
            archived_at      = emp.archived_at,
            archived_by      = emp.archived_by,
            retention_days   = emp.retention_days,
            purge_after      = emp.purge_after,
            log_count        = log_count,
        )
        result.append(summary)
    return result


@router.get("/{archive_id}", response_model=ArchivedEmployeeResponse)
def get_archived_employee_detail(archive_id: int, db: Session = Depends(get_db)):
    """
    Full detail for one archived employee including all their attendance logs.
    Used when admin clicks into a row to inspect.
    """
    record = db.query(ArchivedEmployee).filter(ArchivedEmployee.id == archive_id).first()
    if not record:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Archive record not found")
    return record


@router.delete("/purge", summary="Manually trigger purge of expired archives")
def manual_purge(db: Session = Depends(get_db)):
    """
    IT can trigger this manually in addition to the nightly cron.
    """
    now     = datetime.now(timezone.utc)
    expired = db.query(ArchivedEmployee).filter(ArchivedEmployee.purge_after <= now).all()

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
    return {
        "purged_employees" : purged_employees,
        "purged_logs"      : purged_logs,
        "purged_before"    : now.isoformat(),
    }