from pydantic import BaseModel
from datetime import datetime


class ImportFileResponse(BaseModel):
    id               : int
    import_type      : str
    original_filename: str
    inserted         : int
    skipped          : int
    errors           : int
    imported_by      : str
    imported_at      : datetime

    class Config:
        from_attributes = True