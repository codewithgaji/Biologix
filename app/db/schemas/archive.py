from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class ArchivedAttendanceLogResponse(BaseModel):
    id                   : int
    archived_employee_id : int
    original_log_id      : Optional[int] = None
    original_user_id     : int
    punch_time           : Optional[datetime] = None
    punch_date           : Optional[date] = None
    punch_type           : Optional[str] = None
    hours_worked         : Optional[int] = None
    raw_data             : Optional[dict] = None
    archived_at          : datetime

    class Config:
        from_attributes = True


class ArchivedEmployeeResponse(BaseModel):
    id               : int
    original_user_id : int
    badge_number     : str
    name             : Optional[str] = None
    position         : Optional[str] = None
    department_name  : Optional[str] = None
    shift            : Optional[str] = None
    work_days        : Optional[str] = None
    archived_at      : datetime
    archived_by      : Optional[str] = None
    retention_days   : int
    purge_after      : datetime
    attendance_logs  : List[ArchivedAttendanceLogResponse] = []

    class Config:
        from_attributes = True


class ArchivedEmployeeSummary(BaseModel):
    """
    Lightweight version for the list view — no logs included.
    Use this for the archive table page. Fetch full detail (with logs) per employee separately.
    """
    id               : int
    original_user_id : int
    badge_number     : str
    name             : Optional[str] = None
    position         : Optional[str] = None
    department_name  : Optional[str] = None
    archived_at      : datetime
    archived_by      : Optional[str] = None
    retention_days   : int
    purge_after      : datetime
    log_count        : Optional[int] = None     # computed, not a DB column

    class Config:
        from_attributes = True