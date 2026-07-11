from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta

from db.database import get_db
from db.models.employee import Employee
from db.models.attendance import AttendanceLog
from db.models.department import Department
from db.models.archive import ArchivedEmployee, ArchivedAttendanceLog
from db.models.admin_user import AdminUser
from db.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from db.models.audit_log import AuditAction, ActivityAction
from core.security.dependencies import (
    get_current_user,
    get_current_editor,
    get_current_admin,
)
from core.audit import log_critical, log_activity

# ─── Router ───────────────────────────────────────────────────────────────────
# No router-level dependency — each route declares its own so roles are explicit
router = APIRouter(
    prefix="/employees",
    tags=["Employees"],
)


# ─── GET all employees — viewer and above ─────────────────────────────────────
@router.get("/", response_model=List[EmployeeResponse])
def get_all_employees(
    db          : Session  = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    return db.query(Employee).all()


# ─── GET single employee — viewer and above ───────────────────────────────────
@router.get("/{user_id}", response_model=EmployeeResponse)
def get_employee(
    user_id     : int,
    db          : Session   = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")
    return employee


# ─── POST create employee — editor and above ──────────────────────────────────
@router.post("/", response_model=EmployeeResponse)
def create_employee(
    payload       : EmployeeCreate,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    existing = db.query(Employee).filter(Employee.user_id == payload.user_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Employee with Machine ID {payload.user_id} already exists"
        )

    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.flush()  # get employee.id before commit

    log_critical(
        db           = db,
        action       = AuditAction.employee_created,
        performed_by = current_editor.email,
        target_type  = "employee",
        target_id    = str(payload.badge_number),
        target_label = payload.name,
        new_value    = {
            "user_id"     : payload.user_id,
            "badge_number": payload.badge_number,
            "name"        : payload.name,
            "position"    : payload.position,
        },
    )

    db.commit()
    db.refresh(employee)
    return employee


# ─── PATCH bulk department — editor and above ─────────────────────────────────
@router.patch("/bulk/department")
def bulk_update_department(
    payload       : dict,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    user_ids      = payload.get("user_ids", [])
    department_id = payload.get("department_id")

    if not user_ids or department_id is None:
        raise HTTPException(status_code=400, detail="user_ids and department_id are required")

    # Resolve department name for the log
    dept = db.query(Department).filter(Department.id == department_id).first()
    dept_name = dept.name if dept else str(department_id)

    updated = 0
    for uid in user_ids:
        employee = db.query(Employee).filter(Employee.user_id == uid).first()
        if employee:
            old_dept_id        = employee.department_id
            employee.department_id = department_id

            log_activity(
                db           = db,
                action       = ActivityAction.employee_updated,
                performed_by = current_editor.email,
                target_type  = "employee",
                target_id    = str(employee.badge_number),
                target_label = employee.name,
                old_value    = {"department_id": old_dept_id},
                new_value    = {"department_id": department_id, "department_name": dept_name},
                notes        = "Bulk department update",
            )
            updated += 1

    db.commit()
    return {"message": f"{updated} employees updated successfully", "updated": updated}


# ─── PATCH single employee — editor and above ─────────────────────────────────
@router.patch("/{user_id}", response_model=EmployeeResponse)
def update_employee(
    user_id       : int,
    payload       : EmployeeUpdate,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")

    # Capture old values for the audit log before overwriting
    changes = payload.model_dump(exclude_unset=True)
    old_values = {field: getattr(employee, field) for field in changes}

    # Serialize enum values so they're JSON-safe
    old_serialized = {
        k: (v.value if hasattr(v, "value") else v)
        for k, v in old_values.items()
    }
    new_serialized = {
        k: (v.value if hasattr(v, "value") else v)
        for k, v in changes.items()
    }

    for field, value in changes.items():
        setattr(employee, field, value)

    log_activity(
        db           = db,
        action       = ActivityAction.employee_updated,
        performed_by = current_editor.email,
        target_type  = "employee",
        target_id    = str(employee.badge_number),
        target_label = employee.name,
        old_value    = old_serialized,
        new_value    = new_serialized,
    )

    db.commit()
    db.refresh(employee)
    return employee


# ─── DELETE employee (archive) — admin only ───────────────────────────────────
@router.delete("/{badge_number}")
def delete_employee(
    badge_number  : str,
    retention_days: int     = 30,
    db            : Session  = Depends(get_db),
    current_admin : AdminUser = Depends(get_current_admin),
):
    employee = db.query(Employee).filter(Employee.badge_number == badge_number).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    dept_name = None
    if employee.department_id:
        dept      = db.query(Department).filter(Department.id == employee.department_id).first()
        dept_name = dept.name if dept else None

    # ── Archive the employee record ───────────────────────────────────────────
    purge_after = datetime.now(timezone.utc) + timedelta(days=retention_days)
    archive = ArchivedEmployee(
        original_user_id = employee.user_id,
        badge_number     = employee.badge_number,
        name             = employee.name,
        position         = employee.position,
        department_name  = dept_name,
        shift            = str(employee.shift.value) if employee.shift else None,
        work_days        = str(employee.work_days.value) if employee.work_days else None,
        archived_by      = current_admin.email,          # ← fixed, no longer hardcoded
        retention_days   = retention_days,
        purge_after      = purge_after,
    )
    db.add(archive)
    db.flush()

    # ── Archive attendance logs ───────────────────────────────────────────────
    logs = db.query(AttendanceLog).filter(AttendanceLog.user_id == employee.user_id).all()
    for log in logs:
        db.add(ArchivedAttendanceLog(
            archived_employee_id = archive.id,
            original_log_id      = log.id,
            original_user_id     = log.user_id,
            punch_time           = log.timestamp,
            punch_date           = log.date,
            punch_type           = log.punch_status.value if log.punch_status else None,
            hours_worked         = None,
            raw_data             = {
                "id"          : log.id,
                "user_id"     : log.user_id,
                "timestamp"   : str(log.timestamp),
                "date"        : str(log.date),
                "punch_status": log.punch_status.value if log.punch_status else None,
                "punch_type"  : log.punch_type.value if log.punch_type else None,
                "created_at"  : str(log.created_at),
            },
        ))

    # ── Delete from live tables ───────────────────────────────────────────────
    db.query(AttendanceLog).filter(
        AttendanceLog.user_id == employee.user_id
    ).delete(synchronize_session=False)

    db.delete(employee)

    # ── Audit log — critical, permanent ──────────────────────────────────────
    log_critical(
        db           = db,
        action       = AuditAction.employee_archived,
        performed_by = current_admin.email,
        target_type  = "employee",
        target_id    = badge_number,
        target_label = employee.name,
        old_value    = {
            "badge_number"  : employee.badge_number,
            "user_id"       : employee.user_id,
            "department"    : dept_name,
            "position"      : employee.position,
            "shift"         : str(employee.shift.value) if employee.shift else None,
            "logs_archived" : len(logs),
        },
        notes = f"Archived with {retention_days}d retention. Purges {purge_after.date()}",
    )

    db.commit()

    return {
        "message"      : f"{employee.name} archived and removed",
        "badge_number" : badge_number,
        "logs_archived": len(logs),
        "purge_after"  : purge_after.isoformat(),
    }