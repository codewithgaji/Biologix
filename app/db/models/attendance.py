from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Enum, Time
from sqlalchemy.orm import relationship
from db.database import Base
import enum

class PunchStatusEnum(str, enum.Enum):
    check_in  = "check_in"
    check_out = "check_out"

class PunchTypeEnum(str, enum.Enum):  
    fingerprint = "fingerprint"   # 1
    card        = "card"          # 3
    face        = "face"          # 15



# This is used to map the timing and the user
class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("employees.user_id"), nullable=False, index=True) # This is used to link the attendance log to the employee. We use user_id instead of employee_id because we want to link it to the user table which is used for authentication and authorization.
    timestamp     = Column(DateTime, nullable=False)
    date          = Column(Date, nullable=False, index=True)
    punch_status  = Column(Enum(PunchStatusEnum), nullable=False)
    punch_type    = Column(Enum(PunchTypeEnum), nullable=True) # This allows us to know how the employee punched in or out, whether it was through fingerprint, card, or face recognition. This can be useful for auditing and security purposes.
    created_at    = Column(DateTime, nullable=True)
    employee      = relationship("Employee", foreign_keys=[user_id]) # This backtracks to the original user so we can know whose attendance is being registered.