from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
from db.database import Base
from dotenv import load_dotenv

from db.models.employee import Employee
from db.models.department import Department
from db.models.attendance import AttendanceLog
from db.models.holiday import Holiday
from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
from db.models.admin_user import AdminUser
from db.models.audit_log import CriticalLog, ActivityLog
from db.models.leave import Leave

import os

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ── Whitelist — ONLY these tables will be considered by autogenerate ──────────
BIOLOGIX_TABLES = {
    "employees",
    "attendance_logs",
    "departments",
    "holidays",
    "leaves",
    "archived_employees",
    "archived_attendance_logs",
    "admin_users",
    "critical_logs",
    "activity_logs",
    "import_snapshots",
    "db_backups",
    "import_files"
}

def include_name(name, type_, parent_names):
    if type_ == "table":
        return name in BIOLOGIX_TABLES
    return True


def run_migrations_offline() -> None:
    url = os.getenv("DATABASE_URL")
    context.configure(
        url             = url,
        target_metadata = target_metadata,
        literal_binds   = True,
        include_name    = include_name,   # ← add this
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        {"sqlalchemy.url": os.getenv("DATABASE_URL")},
        prefix    = "sqlalchemy.",
        poolclass = pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection      = connection,
            target_metadata = target_metadata,
            include_name    = include_name,   # ← add this
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()