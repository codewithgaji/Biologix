from pydantic import BaseModel
from typing import Optional
from db.models.attendance import PunchTypeEnum, PunchStatusEnum
from datetime import datetime, date


class AttendanceBase(BaseModel):
  user_id: int
  timestamp: datetime
  date: date
  punch_status: PunchStatusEnum
  punch_type: Optional[PunchTypeEnum] = None

class AttendanceCreate(AttendanceBase):
  created_at: Optional[datetime] = None

  class Config:
    from_attributes = True


class AttendanceSummary(BaseModel):
  user_id: int
  employee_name: str
  date: date
  badge_number: Optional[str] = None
  department_name: Optional[str] = None
  clock_in: Optional[datetime | None] = None
  clock_out: Optional[datetime | None] = None
  hours_worked : Optional[float] = None
  status: str

class AttendanceResponse(BaseModel):
  id: int
  user_id: int
  timestamp: datetime
  date: date
  punch_status: PunchStatusEnum
  punch_type: Optional[PunchTypeEnum] = None
  created_at: Optional[datetime] = None

  class Config:
    from_attributes = True