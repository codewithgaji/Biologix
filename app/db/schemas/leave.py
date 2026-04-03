from pydantic import BaseModel, model_validator
from datetime import date, datetime
from typing import Optional
from db.models.leave import LeaveTypeEnum


# This is the model to create a users leave.
class LeaveCreate(BaseModel):
  applies_to_all: bool = False
  user_id : Optional[int] = None # This is optional because if applies_to_all is true, then user_id will be null.
  leave_type: LeaveTypeEnum
  date_from: date
  date_to: date
  description: Optional[str] = None

  @model_validator(mode="after")
  def validate_target(self):
    if not self.applies_to_all and self.user_id is None:
      raise ValueError("Either applies_to_all must be true or user_id must be provided") # One of this must be true.
    if self.date_to < self.date_from:
      raise ValueError("date_to must be greater than or equal to date_from") # The end date must be greater than or equal to the start date.
    return self
  

class LeaveUpdate(BaseModel):
  applies_to_all: Optional[bool] = None
  user_id: Optional[int] = None
  leave_type: Optional[LeaveTypeEnum] = None
  date_from: Optional[date] = None
  date_to: Optional[date] = None
  description: Optional[str] = None


class LeaveOut(BaseModel):
  id: int
  applies_to_all: bool
  user_id: Optional[int] = None
  leave_type: LeaveTypeEnum
  date_from: date
  date_to: date
  description: Optional[str] = None
  created_at: datetime

  employee_name: Optional[str] = None # This is used to show the employee name on the frontend when we get the leave data. It is populated from the Employee model using the user_id field.
  badge_number: Optional[str] = None

  class Config:
    from_attributes = True