from pydantic import BaseModel
from typing import Optional

class DepartmentBase(BaseModel):
    name: str
    is_reportable: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    name: str
    is_reportable: bool
    employee_count: int = 0

    class Config:
        from_attributes = True