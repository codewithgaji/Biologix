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
    user_id       = Column(Integer, ForeignKey("employees.user_id"), nullable=False, index=True)
    timestamp     = Column(DateTime, nullable=False)
    date          = Column(Date, nullable=False, index=True)
    punch_status  = Column(Enum(PunchStatusEnum), nullable=False)
    punch_type    = Column(Enum(PunchTypeEnum), nullable=True)
    created_at    = Column(DateTime, nullable=True)

    employee      = relationship("Employee", foreign_keys=[user_id]) # This backtracks to the original user so we can know whose attendance is being registered.