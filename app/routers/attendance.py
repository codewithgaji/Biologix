from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional
from db.database import get_db
from datetime import date
from calendar import monthrange
from datetime import date as date_type
from db.models.attendance import AttendanceLog
from db.models.employee import Employee
from db.models.holiday import Holiday
from db.schemas.attendance import AttendanceResponse, AttendanceSummary
from core.security.dependencies import get_current_admin
from collections import defaultdict
from core.security.dependencies import get_current_user

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
    dependencies=[Depends(get_current_user)] # All attendance endpoints require at least a viewer role
)

SHIFT_HOURS = {
    "morning": 8, "afternoon": 8, "night": 12, "day": 10,
}


# Get entire attendance logs with optional date filtering and pagination
@router.get("/", response_model=List[AttendanceResponse])
def get_all_logs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    
    query = db.query(AttendanceLog)
    if date_from:
        query = query.filter(AttendanceLog.date >= date_from)
    if date_to:
        query = query.filter(AttendanceLog.date <= date_to)
    return query.offset(skip).limit(limit).all()


# Attendance summary for all users
@router.get("/summary", response_model=List[AttendanceSummary])
def get_attendance_summary(
    db: Session = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
):
    
    query = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    )
    if date_from:
        query = query.filter(AttendanceLog.date >= date_from)
    if date_to:
        query = query.filter(AttendanceLog.date <= date_to)
    if department_id:
        query = query.filter(Employee.department_id == department_id)

    logs = query.all()

    grouped = defaultdict(list)
    for log, employee in logs:
        key = (log.user_id, log.date)
        grouped[key].append((log, employee))

    summary = []
    for (user_id, attendance_date), entries in grouped.items():
        employee   = entries[0][1]
        check_ins  = [e[0].timestamp for e in entries if e[0].punch_status.value == "check_in"]
        check_outs = [e[0].timestamp for e in entries if e[0].punch_status.value == "check_out"]

        clock_in  = min(check_ins)  if check_ins  else None
        clock_out = max(check_outs) if check_outs else None

        hours_worked = None
        if clock_in and clock_out:
            delta        = (clock_out - clock_in).total_seconds() / 3600
            hours_worked = round(delta, 2)

        status = "present" if (clock_in or clock_out) else "absent" # If there's any punch, we consider them present for that day. This is a common approach in attendance systems to account for missed punches while still recognizing the employee's presence. This way, if an employee forgets to check out but has a valid check-in, we won't mark them as absent. Instead, we can later review such cases and adjust hours worked if necessary based on their shift or typical working hours.

        summary.append(AttendanceSummary(
            user_id         = user_id,
            badge_number    = employee.badge_number or "—",
            employee_name   = employee.name,
            department_name = employee.department.name if employee.department else "—",
            date            = attendance_date,
            clock_in        = clock_in,
            clock_out       = clock_out,
            hours_worked    = hours_worked,
            status          = status,
        ))
    
    return sorted(summary, key=lambda x: (x.date, x.employee_name))


# Monthly hours with expected days/hours — MUST be before /{user_id}
@router.get("/monthly-hours")
def get_monthly_hours(
    db: Session = Depends(get_db),
    month: int = Query(...),
    year: int = Query(...),
):
    # Fetch holidays for this month
    holidays_in_month = db.query(Holiday).filter(
        extract("month", Holiday.date) == month,
        extract("year",  Holiday.date) == year,
    ).all()
    holiday_dates = {h.date for h in holidays_in_month}

    _, days_in_month = monthrange(year, month)

    def get_expected_days(work_days_enum: str) -> int:
        count = 0
        for day in range(1, days_in_month + 1):
            d       = date_type(year, month, day)
            weekday = d.weekday()  # 0=Mon, 6=Sun
            if d in holiday_dates:
                continue
            if work_days_enum == "mon_fri" and weekday < 5:
                count += 1
            elif work_days_enum == "mon_sat" and weekday < 6:
                count += 1
        return count

    # Fetch all logs for the month
    logs = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        extract("month", AttendanceLog.date) == month,
        extract("year",  AttendanceLog.date) == year,
    ).all()

    grouped      = defaultdict(list)
    employee_map = {}
    for log, employee in logs:
        key = (log.user_id, log.date)
        grouped[key].append(log)
        employee_map[log.user_id] = employee

    totals: dict       = defaultdict(float)
    days_present: dict = defaultdict(int)

    for (user_id, attendance_date), entries in grouped.items():
        check_ins  = [e.timestamp for e in entries if e.punch_status.value == "check_in"]
        check_outs = [e.timestamp for e in entries if e.punch_status.value == "check_out"]

        clock_in  = min(check_ins)  if check_ins  else None
        clock_out = max(check_outs) if check_outs else None

        days_present[user_id] += 1  # any punch = present

        if clock_in and clock_out:
            delta = (clock_out - clock_in).total_seconds() / 3600
            totals[user_id] += round(delta, 2)
        elif clock_in or clock_out:
            # Single punch day — estimate from shift length
            emp       = employee_map[user_id]
            shift_val = emp.shift.value if emp.shift else None
            if shift_val:
                totals[user_id] += SHIFT_HOURS[shift_val]

    result = []
    for user_id, employee in employee_map.items():
        work_days_val  = employee.work_days.value if employee.work_days else None
        shift_val      = employee.shift.value     if employee.shift     else None
        expected_days  = get_expected_days(work_days_val) if work_days_val else None
        shift_hrs      = SHIFT_HOURS.get(shift_val)       if shift_val     else None
        expected_hours = (expected_days * shift_hrs)       if (expected_days and shift_hrs) else None
        actual_hours   = round(totals.get(user_id, 0), 2)

        result.append({
            "user_id"       : user_id,
            "badge_number"  : employee.badge_number,
            "name"          : employee.name,
            "shift"         : shift_val,
            "work_days"     : work_days_val,
            "actual_hours"  : actual_hours,
            "days_present"  : days_present.get(user_id, 0),
            "expected_days" : expected_days,
            "expected_hours": expected_hours,
        })

    return sorted(result, key=lambda x: x["badge_number"] or "")


# Raw attendance logs for a specific employee
@router.get("/{user_id}", response_model=List[AttendanceResponse])
def get_employee_logs(
    user_id: int,
    db: Session = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee Not Found")

    query = db.query(AttendanceLog).filter(AttendanceLog.user_id == user_id)
    if date_from:
        query = query.filter(AttendanceLog.date >= date_from)
    if date_to:
        query = query.filter(AttendanceLog.date <= date_to)

    return query.order_by(AttendanceLog.timestamp).all()


# Daily attendance summary for a specific employee
@router.get("/summary/{user_id}", response_model=List[AttendanceSummary])
def get_employee_summary(
    user_id: int,
    db: Session = Depends(get_db),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    employee = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    query = db.query(AttendanceLog).filter(AttendanceLog.user_id == user_id)
    if date_from:
        query = query.filter(AttendanceLog.date >= date_from)
    if date_to:
        query = query.filter(AttendanceLog.date <= date_to)

    logs = query.order_by(AttendanceLog.timestamp).all()

    grouped = defaultdict(list)
    for log in logs:
        grouped[log.date].append(log)

    summary = []
    for attendance_date, entries in grouped.items():
        check_ins  = [e.timestamp for e in entries if e.punch_status.value == "check_in"]
        check_outs = [e.timestamp for e in entries if e.punch_status.value == "check_out"]

        clock_in  = min(check_ins)  if check_ins  else None
        clock_out = max(check_outs) if check_outs else None

        hours_worked = None
        if clock_in and clock_out:
            delta        = (clock_out - clock_in).total_seconds() / 3600
            hours_worked = round(delta, 2)

        status = "present" if (clock_in or clock_out) else "absent"

        summary.append(AttendanceSummary(
            user_id         = user_id,
            badge_number    = employee.badge_number or "—",
            employee_name   = employee.name,
            department_name = employee.department.name if employee.department else "—",
            date            = attendance_date,
            clock_in        = clock_in,
            clock_out       = clock_out,
            hours_worked    = hours_worked,
            status          = status,
        ))

    return sorted(summary, key=lambda x: x.date)