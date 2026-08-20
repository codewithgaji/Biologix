from pydantic import BaseModel
from typing import List
from datetime import datetime


class TableStat(BaseModel):
    table_name: str
    row_count : int
    total_size: str
    size_bytes: int


class DbStatsResponse(BaseModel):
    total_size: str
    tables    : List[TableStat]


class BackupRecord(BaseModel):
    id           : int
    filename     : str
    size_bytes   : int
    created_at   : datetime

    class Config:
        from_attributes = True