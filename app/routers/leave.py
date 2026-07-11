from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta

from db.database import get_db
from db.models.leave import Leave
from db.models.employee import Employee, WorkDaysEnum
from db.models.admin_user import AdminUser
from db.models.audit_log import ActivityAction
from db.schemas.leave import LeaveCreate, LeaveUpdate, LeaveOut
from core.security.dependencies import get_current_user, get_current_editor
from core.audit import log_activity

# ─── Router ───────────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/leaves",
    tags=["Leaves"],
)


# ─── Helpers ──────────────────────────────────────────────────────────────────
def is_working_day_for_employee(d: date, work_days: WorkDaysEnum) -> bool:
    weekday = d.weekday()
    if weekday == 6:
        return False
    if weekday == 5:
        return work_days == WorkDaysEnum.mon_sat
    return True


def enrich(leave: Leave) -> LeaveOut:
    out = LeaveOut.model_validate(leave)
    if leave.employee:
        out.employee_name = leave.employee.name
        out.badge_number  = leave.employee.badge_number
    return out


# ─── GET all leaves — viewer and above ───────────────────────────────────────
@router.get("/", response_model=List[LeaveOut])
def get_leaves(
    user_id  : Optional[int]  = Query(None),
    date_from: Optional[date] = Query(None),
    date_to  : Optional[date] = Query(None),
    db       : Session        = Depends(get_db),
    current_user: AdminUser   = Depends(get_current_user),
):
    q = db.query(Leave)
    if user_id is not None:
        q = q.filter((Leave.user_id == user_id) | (Leave.applies_to_all == True))
    if date_from:
        q = q.filter(Leave.date_to >= date_from)
    if date_to:
        q = q.filter(Leave.date_from <= date_to)
    return [enrich(leave) for leave in q.order_by(Leave.date_from.desc()).all()]


# ─── GET search employee by badge — viewer and above ─────────────────────────
@router.get("/search/employee", response_model=List[dict])
def search_employee_by_badge(
    badge       : str     = Query(...),
    db          : Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    employees = db.query(Employee).filter(
        Employee.badge_number.ilike(f"%{badge}%")
    ).limit(10).all()

    return [
        {
            "user_id"     : emp.user_id,
            "badge_number": emp.badge_number,
            "name"        : emp.name,
            "department"  : emp.department.name if emp.department else None,
        }
        for emp in employees
    ]


# ─── GET leave dates for user — viewer and above ──────────────────────────────
@router.get("/dates/{user_id}")
def get_leave_dates_for_user(
    user_id     : int,
    db          : Session        = Depends(get_db),
    current_user: AdminUser      = Depends(get_current_user),
    date_from   : Optional[date] = Query(None),
    date_to     : Optional[date] = Query(None),
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    work_days = employee.work_days or WorkDaysEnum.mon_fri

    q = db.query(Leave).filter(
        (Leave.user_id == user_id) | (Leave.applies_to_all == True)
    )
    if date_from:
        q = q.filter(Leave.date_to >= date_from)
    if date_to:
        q = q.filter(Leave.date_from <= date_to)

    leaves = q.all()
    result = []

    for leave in leaves:
        current = max(leave.date_from, date_from) if date_from else leave.date_from
        end     = min(leave.date_to,   date_to)   if date_to   else leave.date_to

        while current <= end:
            if not leave.applies_to_all or is_working_day_for_employee(current, work_days):
                result.append({
                    "date"       : str(current),
                    "leave_type" : leave.leave_type.value,
                    "description": leave.description,
                })
            current += timedelta(days=1)

    return result


# ─── GET single leave — viewer and above ─────────────────────────────────────
@router.get("/{leave_id}", response_model=LeaveOut)
def get_leave(
    leave_id    : int,
    db          : Session   = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    return enrich(leave)


# ─── POST create leave — editor and above ────────────────────────────────────
@router.post("/", response_model=LeaveOut, status_code=201)
def create_leave(
    payload       : LeaveCreate,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    if not payload.applies_to_all and payload.user_id is not None:
        employee = db.query(Employee).filter(
            Employee.user_id == payload.user_id
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

    leave = Leave(**payload.model_dump())
    db.add(leave)
    db.flush()

    # Build a readable label for the log
    if payload.applies_to_all:
        target_label = "All Employees"
        target_id    = "all"
    else:
        emp          = db.query(Employee).filter(Employee.user_id == payload.user_id).first()
        target_label = emp.name if emp else str(payload.user_id)
        target_id    = str(emp.badge_number) if emp else str(payload.user_id)

    log_activity(
        db           = db,
        action       = ActivityAction.leave_created,
        performed_by = current_editor.email,
        target_type  = "leave",
        target_id    = target_id,
        target_label = target_label,
        new_value    = {
            "leave_type"   : payload.leave_type,
            "date_from"    : str(payload.date_from),
            "date_to"      : str(payload.date_to),
            "applies_to_all": payload.applies_to_all,
            "description"  : payload.description,
        },
    )

    db.commit()
    db.refresh(leave)
    return enrich(leave)


# ─── PATCH update leave — editor and above ───────────────────────────────────
@router.patch("/{leave_id}", response_model=LeaveOut)
def update_leave(
    leave_id      : int,
    payload       : LeaveUpdate,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    changes    = payload.model_dump(exclude_unset=True)
    old_values = {field: getattr(leave, field) for field in changes}

    for field, value in changes.items():
        setattr(leave, field, value)

    log_activity(
        db           = db,
        action       = ActivityAction.leave_created,   # reusing closest action — no leave_updated enum
        performed_by = current_editor.email,
        target_type  = "leave",
        target_id    = str(leave.id),
        target_label = leave.employee.name if leave.employee else "All Employees",
        old_value    = {k: str(v) for k, v in old_values.items()},
        new_value    = {k: str(v) for k, v in changes.items()},
        notes        = "Leave record updated",
    )

    db.commit()
    db.refresh(leave)
    return enrich(leave)


# ─── DELETE leave — editor and above ─────────────────────────────────────────
@router.delete("/{leave_id}", status_code=204)
def delete_leave(
    leave_id      : int,
    db            : Session   = Depends(get_db),
    current_editor: AdminUser = Depends(get_current_editor),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    target_label = leave.employee.name if leave.employee else "All Employees"
    target_id    = str(leave.employee.badge_number) if leave.employee else "all"

    log_activity(
        db           = db,
        action       = ActivityAction.leave_deleted,
        performed_by = current_editor.email,
        target_type  = "leave",
        target_id    = target_id,
        target_label = target_label,
        old_value    = {
            "leave_type": leave.leave_type.value,
            "date_from" : str(leave.date_from),
            "date_to"   : str(leave.date_to),
            "description": leave.description,
        },
    )

    db.delete(leave)
    db.commit()


# ─── GET debug employee — viewer and above ────────────────────────────────────
@router.get("/debug/{user_id}")
def debug_employee(
    user_id     : int,
    db          : Session   = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.user_id == user_id).first()
    return {
        "work_days_raw"  : emp.work_days,
        "work_days_value": emp.work_days.value if emp.work_days else None,
        "is_mon_sat"     : emp.work_days == WorkDaysEnum.mon_sat,
    }