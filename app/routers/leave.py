from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta

from db.database import get_db
from db.models.leave import Leave
from db.models.employee import Employee, WorkDaysEnum
from db.schemas.leave import LeaveCreate, LeaveUpdate, LeaveOut
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/leaves",
    tags=["Leaves"],
    dependencies=[Depends(get_current_admin)]
)


def is_working_day_for_employee(d: date, work_days: WorkDaysEnum) -> bool:
    """
    Checks if a given date is a working day for the employee
    based on their work_days schedule.
    
    mon_fri → Monday to Friday only (weekday 0–4)
    mon_sat → Monday to Saturday (weekday 0–5)
    Sundays are never working days.
    """
    weekday = d.weekday()  # 0=Mon, 1=Tue, ..., 5=Sat, 6=Sun

    if weekday == 6:
        # Sunday is never a working day regardless of schedule
        return False

    if weekday == 5:
        # Saturday only counts if the employee works mon_sat
        return work_days == WorkDaysEnum.mon_sat

    return True  # Mon–Fri always counts


def enrich(leave: Leave) -> LeaveOut:
    out = LeaveOut.model_validate(leave)
    if leave.employee:
        out.employee_name = leave.employee.name
        out.badge_number = leave.employee.badge_number
    return out


@router.get("/", response_model=List[LeaveOut])
def get_leaves(
    user_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Leave)
    if user_id is not None:
        q = q.filter((Leave.user_id == user_id) | (Leave.applies_to_all == True))
    if date_from:
        q = q.filter(Leave.date_to >= date_from)
    if date_to:
        q = q.filter(Leave.date_from <= date_to)

    return [enrich(leave) for leave in q.order_by(Leave.date_from.desc()).all()]


@router.get("/search/employee", response_model=List[dict])
def search_employee_by_badge(
    badge: str = Query(..., description="Badge number to search for"),
    db: Session = Depends(get_db)
):
    employees = db.query(Employee).filter(
        Employee.badge_number.ilike(f"%{badge}%")
    ).limit(10).all()

    return [
        {
            "user_id": emp.user_id,
            "badge_number": emp.badge_number,
            "name": emp.name,
            "department": emp.department.name if emp.department else None
        }
        for emp in employees
    ]


@router.get("/dates/{user_id}")
def get_leave_dates_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    work_days = employee.work_days or WorkDaysEnum.mon_fri

    q = db.query(Leave).filter(
        (Leave.user_id == user_id) | (Leave.applies_to_all == True)
    )

    # FIX: Use overlap logic — fetch any leave that touches the window,
    # not just leaves that start inside it. A leave starting before date_from
    # but ending inside it should still count.
    if date_from:
        q = q.filter(Leave.date_to >= date_from)   # leave ends on/after window start
    if date_to:
        q = q.filter(Leave.date_from <= date_to)   # leave starts on/before window end

    leaves = q.all()
    result = []

    for leave in leaves:
        # Clamp the iteration to the requested window so we don't emit
        # dates outside the range the caller asked for
        current = max(leave.date_from, date_from) if date_from else leave.date_from
        end     = min(leave.date_to,   date_to)   if date_to   else leave.date_to

        while current <= end:
            if not leave.applies_to_all or is_working_day_for_employee(current, work_days):
                result.append({
                    "date"      : str(current),
                    "leave_type": leave.leave_type.value,
                    "description": leave.description
                })
            current += timedelta(days=1)

    return result


@router.get("/{leave_id}", response_model=LeaveOut)
def get_leave(leave_id: int, db: Session = Depends(get_db)):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    return enrich(leave)


@router.post("/", response_model=LeaveOut, status_code=201)
def create_leave(payload: LeaveCreate, db: Session = Depends(get_db)):
    if not payload.applies_to_all and payload.user_id is not None:
        employee = db.query(Employee).filter(
            Employee.user_id == payload.user_id
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

    leave = Leave(**payload.model_dump())
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return enrich(leave)


@router.patch("/{leave_id}", response_model=LeaveOut)
def update_leave(leave_id: int, payload: LeaveUpdate, db: Session = Depends(get_db)):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(leave, field, value)

    db.commit()
    db.refresh(leave)
    return enrich(leave)


@router.delete("/{leave_id}", status_code=204)
def delete_leave(leave_id: int, db: Session = Depends(get_db)):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    db.delete(leave)
    db.commit()

@router.get("/debug/{user_id}")
def debug_employee(user_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == user_id).first()
    return {
        "work_days_raw": emp.work_days,
        "work_days_value": emp.work_days.value if emp.work_days else None,
        "is_mon_sat": emp.work_days == WorkDaysEnum.mon_sat,
    }