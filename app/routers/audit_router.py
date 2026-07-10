from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone, timedelta

from db.database import get_db
from db.models.admin_user import AdminUser
from db.models.audit_log import CriticalLog, ActivityLog, AuditAction, ActivityAction
from db.schemas.audit_log import CriticalLogResponse, ActivityLogResponse, AuditLogSummary
from core.security.dependencies import get_current_admin

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/audit",
    tags=["Audit"],
)


# ─── GET critical logs — paginated, admin only ────────────────────────────────
@router.get("/critical")
def get_critical_logs(
    db           : Session        = Depends(get_db),
    current_admin: AdminUser      = Depends(get_current_admin),
    page         : int            = Query(1, ge=1),
    page_size    : int            = Query(50, ge=1, le=200),
    action       : Optional[str]  = Query(None),
    performed_by : Optional[str]  = Query(None),
    date_from    : Optional[datetime] = Query(None),
    date_to      : Optional[datetime] = Query(None),
):
    q = db.query(CriticalLog)

    if action:
        # Partial match against action enum value
        from sqlalchemy import cast, String
        q = q.filter(cast(CriticalLog.action, String).ilike(f"%{action}%"))
    if performed_by:
        q = q.filter(CriticalLog.performed_by.ilike(f"%{performed_by}%"))
    if date_from:
        q = q.filter(CriticalLog.timestamp >= date_from)
    if date_to:
        q = q.filter(CriticalLog.timestamp <= date_to)

    total  = q.count()
    offset = (page - 1) * page_size
    logs   = q.order_by(CriticalLog.timestamp.desc()).offset(offset).limit(page_size).all()

    return {
        "total"    : total,
        "page"     : page,
        "page_size": page_size,
        "pages"    : -(-total // page_size),   # ceiling division
        "logs"     : [CriticalLogResponse.model_validate(l) for l in logs],
    }


# ─── GET single critical log — admin only ────────────────────────────────────
@router.get("/critical/{log_id}")
def get_critical_log(
    log_id       : int,
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    from fastapi import HTTPException
    log = db.query(CriticalLog).filter(CriticalLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return CriticalLogResponse.model_validate(log)


# ─── GET activity logs — paginated, admin only ────────────────────────────────
@router.get("/activity")
def get_activity_logs(
    db           : Session        = Depends(get_db),
    current_admin: AdminUser      = Depends(get_current_admin),
    page         : int            = Query(1, ge=1),
    page_size    : int            = Query(50, ge=1, le=200),
    action       : Optional[str]  = Query(None),
    performed_by : Optional[str]  = Query(None),
    target_label : Optional[str]  = Query(None),
    date_from    : Optional[datetime] = Query(None),
    date_to      : Optional[datetime] = Query(None),
):
    q = db.query(ActivityLog)

    if performed_by:
        q = q.filter(ActivityLog.performed_by.ilike(f"%{performed_by}%"))
    if target_label:
        q = q.filter(ActivityLog.target_label.ilike(f"%{target_label}%"))
    if date_from:
        q = q.filter(ActivityLog.timestamp >= date_from)
    if date_to:
        q = q.filter(ActivityLog.timestamp <= date_to)

    total  = q.count()
    offset = (page - 1) * page_size
    logs   = q.order_by(ActivityLog.timestamp.desc()).offset(offset).limit(page_size).all()

    return {
        "total"    : total,
        "page"     : page,
        "page_size": page_size,
        "pages"    : -(-total // page_size),
        "logs"     : [ActivityLogResponse.model_validate(l) for l in logs],
    }


# ─── DELETE purge activity logs older than N days — admin only ───────────────
@router.delete("/activity/purge")
def purge_activity_logs(
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
    older_than_days: int     = Query(90, ge=1),
):
    from core.audit import log_critical
    from db.models.audit_log import AuditAction

    cutoff  = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    deleted = db.query(ActivityLog).filter(
        ActivityLog.timestamp <= cutoff
    ).delete(synchronize_session=False)

    # Log the purge itself — critical so it's permanent
    log_critical(
        db           = db,
        action       = AuditAction.archive_purged,   # closest action available
        performed_by = current_admin.email,
        target_type  = "activity_log",
        target_id    = None,
        target_label = f"Activity logs older than {older_than_days} days",
        old_value    = {"deleted_count": deleted, "cutoff": cutoff.isoformat()},
        notes        = f"Manual purge triggered by {current_admin.email}",
    )

    db.commit()
    return {
        "message"      : f"Purged {deleted} activity log entries",
        "deleted_count": deleted,
        "cutoff"       : cutoff.isoformat(),
    }


# ─── GET audit summary — counts per action type, admin only ──────────────────
@router.get("/summary")
def get_audit_summary(
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    from sqlalchemy import func

    critical_count  = db.query(func.count(CriticalLog.id)).scalar()
    activity_count  = db.query(func.count(ActivityLog.id)).scalar()

    # Most recent entry in each
    latest_critical = db.query(CriticalLog).order_by(
        CriticalLog.timestamp.desc()
    ).first()
    latest_activity = db.query(ActivityLog).order_by(
        ActivityLog.timestamp.desc()
    ).first()

    # Activity logs older than 90 days (eligible for purge)
    cutoff      = datetime.now(timezone.utc) - timedelta(days=90)
    purgeable   = db.query(func.count(ActivityLog.id)).filter(
        ActivityLog.timestamp <= cutoff
    ).scalar()

    return {
        "critical_logs" : {
            "total" : critical_count,
            "latest": latest_critical.timestamp.isoformat() if latest_critical else None,
        },
        "activity_logs" : {
            "total"           : activity_count,
            "purgeable_count" : purgeable,
            "latest"          : latest_activity.timestamp.isoformat() if latest_activity else None,
        },
    }