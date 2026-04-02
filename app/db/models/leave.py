from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Enum, Boolean, Text
from datetime import datetime
from sqlalchemy.orm import relationship
from db.database import Base
import enum

# This allows me to know which type of leave the employee is taking.
class LeaveTypeEnum(str, enum.Enum):
  paid = "paid"
  unpaid = "unpaid"


# This is the leave model itself.

class Leave(Base):
  
  __tablename__ = "leaves"

  id            = Column(Integer, primary_key=True, index=True)
  
  # if "applies_to_all" is true, then the leave applies to all employees. If it is false, then the leave applies to a specific employee which is determined by the "user_id" field.
  applies_to_all = Column(Boolean, default=False)
  user_id       = Column(Integer, ForeignKey("employees.user_id"), nullable=True) # This is nullable because if applies_to_all is true, then user_id will be null.
  leave_type = Column(Enum(LeaveTypeEnum), nullable=False),
  date_from = Column(Date, nullable=False),
  date_to = Column(Date, nullable=False),
  description = Column(Text, nullable=True),
  created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
  employee  = relationship("Employee", back_populates="leaves", foreign_keys=[user_id]) # This backtracks to the original user so we can know whose leave is being registered. Then it populates the "leaves" field in the Employee model with the list of leaves that the employee has taken.