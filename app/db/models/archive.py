# Archive is for when a User account is deleted, but we want to keep their data for historical purposes. This model will store the relevant information from the User model and any related models that need to be preserved. Prepared by me.

# db/models/archive.py
from sqlalchemy import Column, Integer, String, DateTime, Date, JSON, ForeignKey
from sqlalchemy.sql import func
from db.database import Base

class ArchivedEmployee(Base):
    __tablename__ = "archived_employees"

    id              = Column(Integer, primary_key=True, index=True)
    
    # Original employee fields — denormalized snapshot
    original_user_id    = Column(Integer, nullable=False)   # ZKTeco machine ID
    badge_number        = Column(String, nullable=False)
    name                = Column(String, nullable=True)
    position            = Column(String, nullable=True)
    department_name     = Column(String, nullable=True)     # store name, not FK — dept may be deleted too
    shift               = Column(String, nullable=True)
    work_days           = Column(String, nullable=True)
    
    # Archive metadata
    archived_at         = Column(DateTime(timezone=True), server_default=func.now())
    archived_by         = Column(String, nullable=True)     # admin username who did it
    retention_days      = Column(Integer, default=30)       # IT-configurable per deletion
    purge_after         = Column(DateTime(timezone=True), nullable=False)  # computed at archive time


class ArchivedAttendanceLog(Base):
    __tablename__ = "archived_attendance_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    archived_employee_id = Column(Integer, ForeignKey("archived_employees.id"), nullable=False)
    
    # Mirror of attendance_logs fields — adjust to match your actual columns
    original_log_id     = Column(Integer, nullable=True)
    original_user_id    = Column(Integer, nullable=False)
    punch_time          = Column(DateTime(timezone=True), nullable=True)
    punch_date          = Column(Date, nullable=True)
    punch_type          = Column(String, nullable=True)     # IN / OUT
    hours_worked        = Column(Integer, nullable=True)    # or Float
    raw_data            = Column(JSON, nullable=True)       # optional: full original row as JSON safety net
    
    archived_at         = Column(DateTime(timezone=True), server_default=func.now())