from pydantic import BaseModel
from typing import Optional
from db.models.attendance import PunchTypeEnum, PunchStatusEnum
from datetime import datetime, date


# This is the base model
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


# This shows the attendance summary for a user on a given day. It is used to show the attendance summary for a user on the frontend. It is also used to show the attendance summary for a user on the backend when exporting the attendance data to excel.
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