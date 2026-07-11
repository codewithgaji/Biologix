from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from db.models.audit_log import AuditAction, ActivityAction


class CriticalLogResponse(BaseModel):
    id          : int
    action      : AuditAction
    performed_by: str
    target_type : Optional[str] = None
    target_id   : Optional[str] = None
    target_label: Optional[str] = None
    old_value   : Optional[Any] = None
    new_value   : Optional[Any] = None
    notes       : Optional[str] = None
    timestamp   : datetime

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    id          : int
    action      : ActivityAction
    performed_by: str
    target_type : Optional[str] = None
    target_id   : Optional[str] = None
    target_label: Optional[str] = None
    old_value   : Optional[Any] = None
    new_value   : Optional[Any] = None
    notes       : Optional[str] = None
    timestamp   : datetime

    class Config:
        from_attributes = True


class AuditLogSummary(BaseModel):
    """Lightweight version for list views — no old/new value blobs."""
    id          : int
    action      : str
    performed_by: str
    target_label: Optional[str] = None
    notes       : Optional[str] = None
    timestamp   : datetime

    class Config:
        from_attributes = True