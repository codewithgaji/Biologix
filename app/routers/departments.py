from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from db.models.department import Department
from db.models.admin_user import AdminUser
from db.models.audit_log import ActivityAction
from core.security.dependencies import get_current_user, get_current_admin
from core.audit import log_activity

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/departments",
    tags=["Departments"],
)


# ─── GET all departments — viewer and above ───────────────────────────────────
@router.get("/")
def get_all_departments(
    db          : Session   = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    return db.query(Department).all()


# ─── POST create department — admin only ──────────────────────────────────────
@router.post("/")
def create_department(
    payload      : dict,
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name is required")

    existing = db.query(Department).filter(Department.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Department '{name}' already exists")

    dept = Department(
        name          = name,
        is_reportable = payload.get("is_reportable", True),
    )
    db.add(dept)
    db.flush()

    log_activity(
        db           = db,
        action       = ActivityAction.department_created,
        performed_by = current_admin.email,
        target_type  = "department",
        target_id    = str(dept.id),
        target_label = name,
        new_value    = {"name": name, "is_reportable": dept.is_reportable},
    )

    db.commit()
    return dept


# ─── PATCH update department — admin only ────────────────────────────────────
@router.patch("/{department_id}")
def update_department(
    department_id: int,
    payload      : dict,
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Snapshot before mutation
    old_values = {"name": dept.name, "is_reportable": dept.is_reportable}

    allowed = {"name", "is_reportable"}
    for field, value in payload.items():
        if field in allowed:
            setattr(dept, field, value)

    new_values = {"name": dept.name, "is_reportable": dept.is_reportable}

    log_activity(
        db           = db,
        action       = ActivityAction.department_updated,
        performed_by = current_admin.email,
        target_type  = "department",
        target_id    = str(dept.id),
        target_label = dept.name,
        old_value    = old_values,
        new_value    = new_values,
    )

    db.commit()
    return dept

# ─── DELETE department — admin only ──────────────────────────────────────────
@router.delete("/{department_id}")
def delete_department(
    department_id: int,
    db           : Session   = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Guard — block deletion if employees are still assigned
    from db.models.employee import Employee
    assigned_count = db.query(Employee).filter(
        Employee.department_id == department_id
    ).count()

    if assigned_count > 0:
        raise HTTPException(
            status_code = 400,
            detail      = f"Cannot delete '{dept.name}' — {assigned_count} employee(s) are still assigned to it. Reassign them first."
        )

    dept_name = dept.name

    log_activity(
        db           = db,
        action       = ActivityAction.department_deleted,
        performed_by = current_admin.email,
        target_type  = "department",
        target_id    = str(department_id),
        target_label = dept_name,
        old_value    = {"name": dept_name, "is_reportable": dept.is_reportable},
    )

    db.delete(dept)
    db.commit()
    return {"message": f"Department '{dept_name}' deleted"}