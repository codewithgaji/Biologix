from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from db.database import Base

class Department(Base):
    __tablename__ = "departments"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    employees = relationship("Employee", back_populates="department")
    is_reportable = Column(Boolean, default=True) # This flag is used to determine if department is reportable/exportable.