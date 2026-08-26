from sqlalchemy import Column, Integer, String, DateTime, BigInteger
from sqlalchemy.sql import func
from db.database import Base


class DbBackup(Base):
    __tablename__ = "db_backups"

    id           = Column(Integer,  primary_key=True, index=True)
    filename     = Column(String,   nullable=False)
    size_bytes   = Column(BigInteger, nullable=False)
    storage_path = Column(String,   nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), index=True)