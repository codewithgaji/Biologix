from sqlalchemy.orm import Session
from datetime import datetime, timezone
from db.models.audit_log import (
    CriticalLog, ActivityLog,
    AuditAction, ActivityAction
)
from typing import Any, Optional


def log_critical(
    db          : Session,
    action      : AuditAction,
    performed_by: str,                    # admin_user email
    target_type : Optional[str] = None,
    target_id   : Optional[str] = None,
    target_label: Optional[str] = None,
    old_value   : Optional[Any] = None,
    new_value   : Optional[Any] = None,
    notes       : Optional[str] = None,
):
    """
    Write a permanent critical log entry.
    Call this for: employee deletion, archiving, imports, exports,
    role changes, user approval/suspension, snapshot reversions, purges.
    """
    entry = CriticalLog(
        action       = action,
        performed_by = performed_by,
        target_type  = target_type,
        target_id    = str(target_id) if target_id is not None else None,
        target_label = target_label,
        old_value    = old_value,
        new_value    = new_value,
        notes        = notes,
        timestamp    = datetime.now(timezone.utc),
    )
    db.add(entry)
    # NOTE: do NOT commit here — let the calling router commit
    # so the log and the action are in the same transaction.
    # If the action fails and rolls back, the log rolls back too.


def log_activity(
    db          : Session,
    action      : ActivityAction,
    performed_by: str,
    target_type : Optional[str] = None,
    target_id   : Optional[str] = None,
    target_label: Optional[str] = None,
    old_value   : Optional[Any] = None,
    new_value   : Optional[Any] = None,
    notes       : Optional[str] = None,
):
    """
    Write a purgeable activity log entry.
    Call this for: employee field edits, leave/holiday/department
    create and delete, login and logout events.
    """
    entry = ActivityLog(
        action       = action,
        performed_by = performed_by,
        target_type  = target_type,
        target_id    = str(target_id) if target_id is not None else None,
        target_label = target_label,
        old_value    = old_value,
        new_value    = new_value,
        notes        = notes,
        timestamp    = datetime.now(timezone.utc),
    )
    db.add(entry)