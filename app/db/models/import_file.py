from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from db.database import Base


class ImportFile(Base):
    __tablename__ = "import_files"

    id                = Column(Integer, primary_key=True, index=True)
    import_type       = Column(String,  nullable=False)   # "users" | "attendance"
    original_filename = Column(String,  nullable=False)
    storage_path      = Column(String,  nullable=False)
    inserted          = Column(Integer, nullable=False, default=0)
    skipped           = Column(Integer, nullable=False, default=0)
    errors            = Column(Integer, nullable=False, default=0)
    imported_by       = Column(String,  nullable=False)   # admin_user email
    imported_at       = Column(DateTime(timezone=True), server_default=func.now(), index=True)