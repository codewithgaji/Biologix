from pydantic import BaseModel
from typing import Optional
from db.models.employee import RoleEnum, ShiftEnum, WorkDaysEnum


class EmployeeBase(BaseModel): # This is used to create the employee base with the user data
    user_id      : int
    name         : str
    badge_number : Optional[str] = None
    role         : Optional[RoleEnum] = RoleEnum.user
    shift        : Optional[ShiftEnum] = None
    work_days    : Optional[WorkDaysEnum] = None


class EmployeeCreate(EmployeeBase):
    department_id: Optional[int] = None  # FK to departments table on creation


class EmployeeUpdate(BaseModel):
    name         : Optional[str] = None
    badge_number : Optional[str] = None
    department_id: Optional[int] = None  # FK — must be int to match the model
    role         : Optional[RoleEnum] = None
    shift        : Optional[ShiftEnum] = None
    work_days    : Optional[WorkDaysEnum] = None


class EmployeeResponse(EmployeeBase):
    id            : int
    department_id : Optional[int] = None  # returned so frontend can show current dept in dropdown

    class Config:
        from_attributes = True