from sqlalchemy import Column, Integer, String, Enum, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base
import enum

class RoleEnum(str, enum.Enum):
    admin = "admin"
    user = "user"

class ShiftEnum(str, enum.Enum): # This is used for their shifts.
    morning = "morning"       # 6am - 2pm
    afternoon = "afternoon"   # 2pm - 10pm
    night = "night"           # 7pm - 7am
    day = "day"               # 8am - 6pm

class WorkDaysEnum(str, enum.Enum):
    
    mon_fri = "mon_fri"
    mon_sat = "mon_sat"



class Employee(Base):
    __tablename__ = "employees"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, unique=True, nullable=False, index=True)
    name          = Column(String, nullable=False)
    position = Column(String, nullable=True) # The position of the employee in the org
    badge_number  = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department    = relationship("Department", foreign_keys=[department_id])
    role          = Column(Enum(RoleEnum), default=RoleEnum.user)
    shift         = Column(Enum(ShiftEnum), nullable=True)
    work_days     = Column(Enum(WorkDaysEnum), nullable=True)
    