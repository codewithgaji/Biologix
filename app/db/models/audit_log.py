from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Enum as SAEnum
from sqlalchemy.sql import func
from db.database import Base
import enum


class AuditAction(str, enum.Enum):
    # Employee lifecycle
    employee_created  = "employee_created"
    employee_deleted  = "employee_deleted"
    employee_archived = "employee_archived"

    # User management
    user_registered   = "user_registered"
    user_approved     = "user_approved"
    user_suspended    = "user_suspended"
    role_changed      = "role_changed"

    # Data operations
    data_imported     = "data_imported"
    data_exported     = "data_exported"
    snapshot_reverted = "snapshot_reverted"

    # Archive
    archive_purged    = "archive_purged"

    # DB Admin
    attendance_purged = "attendance_purged"


class ActivityAction(str, enum.Enum):
    # Employee edits
    employee_updated  = "employee_updated"   # name, position, shift, dept

    # Leave
    leave_created     = "leave_created"
    leave_deleted     = "leave_deleted"

    # Holiday
    holiday_created   = "holiday_created"
    holiday_deleted   = "holiday_deleted"

    # Department
    department_created = "department_created"
    department_updated = "department_updated"
    department_deleted = "department_deleted"

    # Session
    user_login        = "user_login"
    user_logout       = "user_logout"


class CriticalLog(Base):
    """
    Permanent log — never purged.
    Covers high-stakes actions: deletions, role changes, imports, exports.
    """
    __tablename__ = "critical_logs"

    id          = Column(Integer, primary_key=True, index=True)
    action      = Column(SAEnum(AuditAction), nullable=False)
    performed_by= Column(String,  nullable=False)           # admin_user email
    target_type = Column(String,  nullable=True)            # "employee" | "admin_user" | "archive" etc.
    target_id   = Column(String,  nullable=True)            # badge_number or user id as string
    target_label= Column(String,  nullable=True)            # human-readable e.g. "Oladimeji Israel"
    old_value   = Column(JSON,    nullable=True)            # before state
    new_value   = Column(JSON,    nullable=True)            # after state
    notes       = Column(Text,    nullable=True)            # optional context
    timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class ActivityLog(Base):
    """
    Activity log — purgeable after 90 days.
    Covers routine edits and session events.
    """
    __tablename__ = "activity_logs"

    id          = Column(Integer, primary_key=True, index=True)
    action      = Column(SAEnum(ActivityAction), nullable=False)
    performed_by= Column(String,  nullable=False)           # admin_user email
    target_type = Column(String,  nullable=True)
    target_id   = Column(String,  nullable=True)
    target_label= Column(String,  nullable=True)
    old_value   = Column(JSON,    nullable=True)
    new_value   = Column(JSON,    nullable=True)
    notes       = Column(Text,    nullable=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)