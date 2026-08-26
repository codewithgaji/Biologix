# def summation(num: list[int], target: int):
#   seen = {}
#   for i, num in enumerate(num):
#       complement = target - num
#       if complement in seen:
#           return [seen[complement], i]
#       seen[num] = i


# summation([6, 4, 5, 2, 7, 5, 2, 3, 9, 3], 8)


# def twoSum(nums: list[int], target: int) -> list[int]:
#     seen = {}  # value -> index

#     for i, num in enumerate(nums): # Enumerate helps us to get the position and number sitting at that position.
#         complement = target - num   # what we NEED to find

#         if complement in seen:      # already encountered it earlier?
#             return [seen[complement], i]

#         seen[num] = i               # store current number for future lookups



# from fastapi import Depends, HTTPException, Security, status
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from sqlalchemy.orm import Session
# from db.database import get_db
# from db.models.admin_user import AdminUser, AdminRole, AdminStatus
# from core.security.authHandler import AuthHandler

# security = HTTPBearer()


# def _get_verified_user(
#     credentials: HTTPAuthorizationCredentials = Security(security),
#     db         : Session = Depends(get_db),
# ) -> AdminUser:
#     token   = credentials.credentials
#     payload = AuthHandler.decode_jwt(token)

#     if not payload:
#         raise HTTPException(
#             status_code = status.HTTP_401_UNAUTHORIZED,
#             detail      = "Invalid or expired token",
#         )

#     user_id = payload.get("user_id")
#     if not user_id:
#         raise HTTPException(
#             status_code = status.HTTP_401_UNAUTHORIZED,
#             detail      = "Invalid token payload",
#         )

#     user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
#     if not user:
#         raise HTTPException(
#             status_code = status.HTTP_401_UNAUTHORIZED,
#             detail      = "User no longer exists",
#         )

#     if user.status == AdminStatus.pending:
#         raise HTTPException(
#             status_code = status.HTTP_403_FORBIDDEN,
#             detail      = "Account pending approval. Contact your administrator.",
#         )

#     if user.status == AdminStatus.suspended:
#         raise HTTPException(
#             status_code = status.HTTP_403_FORBIDDEN,
#             detail      = "Account suspended. Contact your administrator.",
#         )

#     return user


# def get_current_user(
#     user: AdminUser = Depends(_get_verified_user),
# ) -> AdminUser:
#     """Any active user regardless of role — viewer and above."""
#     return user


# def get_current_editor(
#     user: AdminUser = Depends(_get_verified_user),
# ) -> AdminUser:
#     """Editor and above — create/edit employees, manage leaves, import."""
#     if user.role not in (AdminRole.editor, AdminRole.admin):
#         raise HTTPException(
#             status_code = status.HTTP_403_FORBIDDEN,
#             detail      = "You don't have permission to perform this action",
#         )
#     return user


# def get_current_payroll(
#     user: AdminUser = Depends(_get_verified_user),
# ) -> AdminUser:
#     """Payroll and above — export only."""
#     if user.role not in (AdminRole.payroll, AdminRole.admin):
#         raise HTTPException(
#             status_code = status.HTTP_403_FORBIDDEN,
#             detail      = "You don't have permission to perform this action",
#         )
#     return user


# def get_current_admin(
#     user: AdminUser = Depends(_get_verified_user),
# ) -> AdminUser:
#     """Admin only — user management, role changes, audit logs, purge."""
#     if user.role != AdminRole.admin:
#         raise HTTPException(
#             status_code = status.HTTP_403_FORBIDDEN,
#             detail      = "Admin access required",
#         )
#     return user

# import jwt
# from decouple import config
# import time

# JWT_SECRET    = config("JWT_SECRET")
# JWT_ALGORITHM = config("JWT_ALGORITHM")

# SESSION_DURATION = 60 * 60 * 1  # 1 hours in seconds

# class AuthHandler(object):
#     @staticmethod
#     def sign_jwt(user_id: int, role: str, status: str) -> str:
#         payload = {
#             "user_id": user_id,
#             "role": role,
#             "status": status,
#             "expires": time.time() + SESSION_DURATION
#         }
#         token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
#         # PyJWT 2.x returns string, older returns bytes
#         return token if isinstance(token, str) else token.decode("utf-8")

#     @staticmethod
#     def decode_jwt(token: str) -> dict:
#         try:
#             decoded_token = jwt.decode(
#                 token,
#                 JWT_SECRET,
#                 algorithms=[JWT_ALGORITHM]
#             )
#             return decoded_token if decoded_token["expires"] >= time.time() else None
#         except jwt.ExpiredSignatureError:
#             print("Token has expired")
#             return {}
#         except jwt.InvalidTokenError as e:
#             print(f"Invalid token: {e}")
#             return {}

# from bcrypt import hashpw, gensalt, checkpw

# class HashHelper(object):
#   @staticmethod
#   def verify_password(plain_password: str, hashed_password: str):
#     if checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8')): # This confirms the plain_password, matches with the hashpassword.
#       return True
#     else:
#       return False
    
#   @staticmethod  
#   def get_password_hash(plain_password: str):
#     return hashpw(plain_password.encode('utf-8'), gensalt()).decode('utf-8') # Generating a salt is generating a random string that is added to the password before hashing it. This makes it more difficult for attackers to crack the password using precomputed hash tables (rainbow tables).
    
# from sqlalchemy.orm import Session
# from datetime import datetime, timezone
# from db.models.audit_log import (
#     CriticalLog, ActivityLog,
#     AuditAction, ActivityAction
# )
# from typing import Any, Optional


# def log_critical(
#     db          : Session,
#     action      : AuditAction,
#     performed_by: str,                    # admin_user email
#     target_type : Optional[str] = None,
#     target_id   : Optional[str] = None,
#     target_label: Optional[str] = None,
#     old_value   : Optional[Any] = None,
#     new_value   : Optional[Any] = None,
#     notes       : Optional[str] = None,
# ):
#     """
#     Write a permanent critical log entry.
#     Call this for: employee deletion, archiving, imports, exports,
#     role changes, user approval/suspension, snapshot reversions, purges.
#     """
#     entry = CriticalLog(
#         action       = action,
#         performed_by = performed_by,
#         target_type  = target_type,
#         target_id    = str(target_id) if target_id is not None else None,
#         target_label = target_label,
#         old_value    = old_value,
#         new_value    = new_value,
#         notes        = notes,
#         timestamp    = datetime.now(timezone.utc),
#     )
#     db.add(entry)
#     # NOTE: do NOT commit here — let the calling router commit
#     # so the log and the action are in the same transaction.
#     # If the action fails and rolls back, the log rolls back too.


# def log_activity(
#     db          : Session,
#     action      : ActivityAction,
#     performed_by: str,
#     target_type : Optional[str] = None,
#     target_id   : Optional[str] = None,
#     target_label: Optional[str] = None,
#     old_value   : Optional[Any] = None,
#     new_value   : Optional[Any] = None,
#     notes       : Optional[str] = None,
# ):
#     """
#     Write a purgeable activity log entry.
#     Call this for: employee field edits, leave/holiday/department
#     create and delete, login and logout events.
#     """
#     entry = ActivityLog(
#         action       = action,
#         performed_by = performed_by,
#         target_type  = target_type,
#         target_id    = str(target_id) if target_id is not None else None,
#         target_label = target_label,
#         old_value    = old_value,
#         new_value    = new_value,
#         notes        = notes,
#         timestamp    = datetime.now(timezone.utc),
#     )
#     db.add(entry)

# from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum
# from sqlalchemy.sql import func
# from db.database import Base
# import enum

# # I'm doing this for accountability.... incase i'm not around to see what changes are being made to the admin users table.
# class AdminRole(str, enum.Enum):
#     viewer  = "viewer"
#     editor  = "editor"
#     payroll = "payroll"
#     admin   = "admin"


# class AdminStatus(str, enum.Enum):
#     pending   = "pending"
#     active    = "active"
#     suspended = "suspended"


# class AdminUser(Base):
#     __tablename__ = "admin_users"

#     id            = Column(Integer, primary_key=True, index=True)
#     full_name     = Column(String,  nullable=False)
#     email         = Column(String,  nullable=False, unique=True, index=True)
#     password_hash = Column(String,  nullable=False)
#     role          = Column(SAEnum(AdminRole),   nullable=False, default=AdminRole.viewer)
#     status        = Column(SAEnum(AdminStatus), nullable=False, default=AdminStatus.pending)

#     # Absolute, out-of-band tier. Independent of `role`. There is no API route
#     # anywhere in this app that sets this column — it is only ever flipped by
#     # direct database access (see migration below). This is intentional:
#     # an endpoint that can grant/revoke it is itself something a stolen
#     # session token could abuse.
#     is_superuser  = Column(Boolean, nullable=False, default=False, server_default="false")

#     created_at    = Column(DateTime(timezone=True), server_default=func.now())
#     updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
#     last_login_at = Column(DateTime(timezone=True), nullable=True)

# from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Enum as SAEnum
# from sqlalchemy.sql import func
# from db.database import Base
# import enum


# class AuditAction(str, enum.Enum):
#     # Employee lifecycle
#     employee_created  = "employee_created"
#     employee_deleted  = "employee_deleted"
#     employee_archived = "employee_archived"

#     # User management
#     user_registered   = "user_registered"
#     user_approved     = "user_approved"
#     user_suspended    = "user_suspended"
#     role_changed      = "role_changed"

#     # Data operations
#     data_imported     = "data_imported"
#     data_exported     = "data_exported"
#     snapshot_reverted = "snapshot_reverted"

#     # Archive
#     archive_purged    = "archive_purged"


# class ActivityAction(str, enum.Enum):
#     # Employee edits
#     employee_updated  = "employee_updated"   # name, position, shift, dept

#     # Leave
#     leave_created     = "leave_created"
#     leave_deleted     = "leave_deleted"

#     # Holiday
#     holiday_created   = "holiday_created"
#     holiday_deleted   = "holiday_deleted"

#     # Department
#     department_created = "department_created"
#     department_updated = "department_updated"
#     department_deleted = "department_deleted"

#     # Session
#     user_login        = "user_login"
#     user_logout       = "user_logout"


# class CriticalLog(Base):
#     """
#     Permanent log — never purged.
#     Covers high-stakes actions: deletions, role changes, imports, exports.
#     """
#     __tablename__ = "critical_logs"

#     id          = Column(Integer, primary_key=True, index=True)
#     action      = Column(SAEnum(AuditAction), nullable=False)
#     performed_by= Column(String,  nullable=False)           # admin_user email
#     target_type = Column(String,  nullable=True)            # "employee" | "admin_user" | "archive" etc.
#     target_id   = Column(String,  nullable=True)            # badge_number or user id as string
#     target_label= Column(String,  nullable=True)            # human-readable e.g. "Oladimeji Israel"
#     old_value   = Column(JSON,    nullable=True)            # before state
#     new_value   = Column(JSON,    nullable=True)            # after state
#     notes       = Column(Text,    nullable=True)            # optional context
#     timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# class ActivityLog(Base):
#     """
#     Activity log — purgeable after 90 days.
#     Covers routine edits and session events.
#     """
#     __tablename__ = "activity_logs"

#     id          = Column(Integer, primary_key=True, index=True)
#     action      = Column(SAEnum(ActivityAction), nullable=False)
#     performed_by= Column(String,  nullable=False)           # admin_user email
#     target_type = Column(String,  nullable=True)
#     target_id   = Column(String,  nullable=True)
#     target_label= Column(String,  nullable=True)
#     old_value   = Column(JSON,    nullable=True)
#     new_value   = Column(JSON,    nullable=True)
#     notes       = Column(Text,    nullable=True)
#     timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)

# from dotenv import load_dotenv
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker
# import os


# load_dotenv()



# DATABASE_URL=os.getenv("DATABASE_URL")
# engine = create_engine(DATABASE_URL)


# SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)

# Base = declarative_base()

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()  


# # routers/archive_router.py

# from fastapi import APIRouter, Depends, Query
# from sqlalchemy.orm import Session
# from sqlalchemy import func
# from typing import List
# from datetime import datetime, timezone

# from db.database import get_db
# from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
# from db.schemas.archive import ArchivedEmployeeResponse, ArchivedEmployeeSummary
# from core.security.dependencies import get_current_user

# router = APIRouter(
#     prefix="/archive",
#     tags=["Archive"],
#     dependencies=[Depends(get_current_user)]
# )


# @router.get("/", response_model=List[ArchivedEmployeeSummary])
# def get_archived_employees(db: Session = Depends(get_db)):
#     """
#     List all archived employees with log count.
#     Used for the archive table page.
#     """
#     rows = db.query(ArchivedEmployee).order_by(ArchivedEmployee.archived_at.desc()).all()

#     result = []
#     for emp in rows:
#         log_count = db.query(func.count(ArchivedAttendanceLog.id)).filter(
#             ArchivedAttendanceLog.archived_employee_id == emp.id
#         ).scalar()
#         summary = ArchivedEmployeeSummary(
#             id               = emp.id,
#             original_user_id = emp.original_user_id,
#             badge_number     = emp.badge_number,
#             name             = emp.name,
#             position         = emp.position,
#             department_name  = emp.department_name,
#             archived_at      = emp.archived_at,
#             archived_by      = emp.archived_by,
#             retention_days   = emp.retention_days,
#             purge_after      = emp.purge_after,
#             log_count        = log_count,
#         )
#         result.append(summary)
#     return result


# @router.get("/{archive_id}", response_model=ArchivedEmployeeResponse)
# def get_archived_employee_detail(archive_id: int, db: Session = Depends(get_db)):
#     """
#     Full detail for one archived employee including all their attendance logs.
#     Used when admin clicks into a row to inspect.
#     """
#     record = db.query(ArchivedEmployee).filter(ArchivedEmployee.id == archive_id).first()
#     if not record:
#         from fastapi import HTTPException
#         raise HTTPException(status_code=404, detail="Archive record not found")
#     return record


# @router.delete("/purge", summary="Manually trigger purge of expired archives")
# def manual_purge(db: Session = Depends(get_db)):
#     """
#     IT can trigger this manually in addition to the nightly cron.
#     """
#     now     = datetime.now(timezone.utc)
#     expired = db.query(ArchivedEmployee).filter(ArchivedEmployee.purge_after <= now).all()

#     purged_employees = 0
#     purged_logs      = 0

#     for record in expired:
#         log_count = db.query(ArchivedAttendanceLog).filter(
#             ArchivedAttendanceLog.archived_employee_id == record.id
#         ).delete(synchronize_session=False)
#         purged_logs      += log_count
#         db.delete(record)
#         purged_employees += 1

#     db.commit()
#     return {
#         "purged_employees" : purged_employees,
#         "purged_logs"      : purged_logs,
#         "purged_before"    : now.isoformat(),
#     }

# from sqlalchemy.orm import Session
# from datetime import datetime, timedelta
# from db.models.employee import Employee, RoleEnum
# from db.models.attendance import AttendanceLog, PunchStatusEnum, PunchTypeEnum


# PUNCH_TYPE_MAP = {
#     "1" : PunchTypeEnum.fingerprint,
#     "3" : PunchTypeEnum.card,
#     "15": PunchTypeEnum.face,
# }


# PUNCH_STATUS_MAP = {
#     "0": PunchStatusEnum.check_in,
#     "1": PunchStatusEnum.check_out,
# }



# def parse_user_dat(file_bytes: bytes, db: Session) -> dict:
#     """
#     Parses user.dat binary file and inserts employees into the database.
#     Skips employees that already exist.
#     """
#     import struct

#     RECORD_SIZE = 72
#     inserted    = 0
#     skipped     = 0
#     errors      = 0

#     for offset in range(0, len(file_bytes) - RECORD_SIZE + 1, RECORD_SIZE):
#         try:
#             chunk     = file_bytes[offset:offset + RECORD_SIZE]
#             user_id   = struct.unpack_from('<H', chunk, 0x00)[0]
#             privilege = struct.unpack_from('<H', chunk, 0x02)[0]
#             name      = chunk[0x0b:0x0b+24].split(b'\x00')[0].decode('utf-8', errors='ignore').strip()
#             badge     = chunk[0x30:0x30+8].split(b'\x00')[0].decode('utf-8', errors='ignore').strip()

#             if not name or user_id == 0 or name == "Master":
#                 continue

#             role = RoleEnum.admin if privilege == 14 else RoleEnum.user

#             existing = db.query(Employee).filter(Employee.user_id == user_id).first()
#             if existing:
#                 skipped += 1
#                 continue

#             employee = Employee(
#                 user_id      = user_id,
#                 name         = name,
#                 badge_number = badge or None,
#                 role         = role,
#             )
#             db.add(employee)
#             inserted += 1

#         except Exception:
#             errors += 1
#             continue

#     db.commit()
#     return {
#         "inserted": inserted,
#         "skipped" : skipped,
#         "errors"  : errors,
#     }



# def parse_attlog_dat(file_bytes: bytes, db: Session, force_status: str = None):
#     lines = file_bytes.decode("utf-8", errors="ignore").splitlines()

#     # Load ALL employees once, one query instead of one per line
#     all_employees = db.query(Employee).all()
#     employee_map = {emp.badge_number: emp for emp in all_employees}

#     inserted = 0
#     skipped  = 0
#     errors   = 0

#     records_to_insert = []

#     for line in lines:
#         try:
#             parts = line.strip().split()
#             if len(parts) < 4:
#                 skipped += 1
#                 continue

#             badge_number    = str(parts[0])
#             timestamp       = datetime.strptime(parts[1] + " " + parts[2], "%Y-%m-%d %H:%M:%S")
#             attendance_date = timestamp.date()

#             if force_status:
#                 punch_status = PunchStatusEnum(force_status)
#             else:
#                 raw_status   = parts[4] if len(parts) > 4 else "1"
#                 punch_status = PUNCH_STATUS_MAP.get(raw_status, PunchStatusEnum.check_in)

#             # Dict lookup instead of DB query
#             employee = employee_map.get(badge_number)
#             if not employee:
#                 skipped += 1
#                 continue

#             records_to_insert.append(AttendanceLog(
#                 user_id      = employee.user_id,
#                 timestamp    = timestamp,
#                 date         = attendance_date,
#                 punch_status = punch_status,
#                 punch_type   = PunchTypeEnum.fingerprint,
#             ))
#             inserted += 1

#         except Exception:
#             errors += 1
#             continue

#     # Bulk insert instead of one-by-one
#     if records_to_insert:
#         db.bulk_save_objects(records_to_insert)

#     db.commit()

#     return {"inserted": inserted, "skipped": skipped, "errors": errors}









# alembic current

# alembic heads

# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.

# INFO  [alembic.runtime.migration] Will assume transactional DDL.

# 6852890b01ea

# f5ccdb24d0ce (head)

# (venv) 

# Gaji@DESKTOP-I646K7K MINGW64 ~/Documents/Biologics/app (biologics_v2)

# $ alembic upgrade head

# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.

# INFO  [alembic.runtime.migration] Will assume transactional DDL.

# INFO  [alembic.runtime.migration] Running upgrade 6852890b01ea -> f5ccdb24d0ce, test check

# (venv) 

# Gaji@DESKTOP-I646K7K MINGW64 ~/Documents/Biologics/app (biologics_v2)

# $ alembic