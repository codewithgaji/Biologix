from sqlalchemy import Column, Integer, String, Date
from db.database import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(Date, nullable=False, unique=True)