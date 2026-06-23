"""
analytics_router.py
====================
Pure READ-ONLY analytics endpoint.
Zero writes to the database.
Does NOT modify any existing router or model.

Registered in main.py as:
    from routers.analytics_router import router as analytics_router
    app.include_router(analytics_router)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date, datetime, time, timedelta
from collections import defaultdict
import calendar

from db.database import get_db
from db.models.attendance import AttendanceLog, PunchStatusEnum
from db.models.employee import Employee
from db.models.department import Department
from db.models.holiday import Holiday
from core.security.dependencies import get_current_admin

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(get_current_admin)]
)

# ── Shift configuration 


# These are the expected start times for each shift.
# Used to determine punctuality (on time / late / very late).

SHIFT_START = {
    "morning"  : time(6,  0),   # 06:00 
    "afternoon": time(14, 0),   # 14:00
    "night"    : time(19, 0),   # 19:00
    "day"      : time(8,  0),   # 08:00
}

SHIFT_END = {
    "morning"  : time(14, 0),
    "afternoon": time(22, 0),
    "night"    : time(7,  0),   # next day
    "day"      : time(18, 0),
}

SHIFT_HOURS = {
    "morning": 8, "afternoon": 8, "night": 12, "day": 10
}

# ── Helpers 

def minutes_late(clock_in_time: time, shift: str, grace_minutes: int = 0) -> int:
    """
    Returns how many minutes late someone clocked in.
    Negative = early. Positive = late.
    grace_minutes: tolerance window before marking as late.
    """
    if shift not in SHIFT_START:
        return 0
    expected = SHIFT_START[shift]
    expected_dt = datetime.combine(date.today(), expected)
    actual_dt   = datetime.combine(date.today(), clock_in_time)

    # Handle overnight shifts (night shift ends next day)
    if shift == "night" and clock_in_time < time(12, 0):
        actual_dt += timedelta(days=1)

    diff_mins = int((actual_dt - expected_dt).total_seconds() / 60)
    return diff_mins  # negative = early, positive = late


# This carefully designs the punctuality labels based on minutes late and grace period.
def punctuality_label(mins: int, grace: int) -> str:
    if mins <= 0:
        return "early"
    elif mins <= grace:
        return "on_time"
    elif mins <= grace + 30:
        return "late"
    else:
        return "very_late"


def working_days_in_range(start: date, end: date, work_days_val: str, holiday_dates: set) -> int:
    count   = 0
    current = start
    while current <= end:
        wd = current.weekday()
        if current not in holiday_dates:
            if work_days_val == "mon_fri" and wd < 5:
                count += 1
            elif work_days_val == "mon_sat" and wd < 6:
                count += 1
        current += timedelta(days=1)
    return count


# ── 1. Department attendance ranking ──────────────────────────────────────────
@router.get("/department-ranking")
def department_ranking(
    date_from    : Optional[date] = Query(None),
    date_to      : Optional[date] = Query(None),
    month        : Optional[int]  = Query(None, ge=1, le=12),
    year         : Optional[int]  = Query(None, ge=2000),
    db           : Session        = Depends(get_db),
):
    """
    Returns each department ranked by:
    - attendance_rate (days_present / expected_days)
    - avg_punctuality_score (0-100, higher = more punctual)
    - avg_hours_rate (actual_hours / expected_hours)
    - composite_score (weighted average of the above)

    Used to determine Department of the Month.
    """
    # Resolve date range
    if month and year:
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)
    elif date_from and date_to:
        d_from, d_to = date_from, date_to
    else:
        # Default: current month
        today  = date.today()
        _, last = calendar.monthrange(today.year, today.month)
        d_from  = date(today.year, today.month, 1)
        d_to    = date(today.year, today.month, last)

    # Holidays in range
    holidays = db.query(Holiday).filter(
        Holiday.date >= d_from, Holiday.date <= d_to
    ).all()
    holiday_dates = {h.date for h in holidays}

    # Fetch all attendance logs with employee + department
    logs = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        AttendanceLog.date >= d_from,
        AttendanceLog.date <= d_to,
        Employee.department_id.isnot(None),
    ).all()

    # Group by department → employee → date
    dept_emp_days: dict = defaultdict(lambda: defaultdict(list))
    emp_info: dict      = {}

    for log, emp in logs:
        dept_id = emp.department_id
        dept_emp_days[dept_id][emp.user_id].append((log, emp))
        emp_info[emp.user_id] = emp

    # Fetch departments
    departments = db.query(Department).all()
    dept_map    = {d.id: d.name for d in departments}

    results = []

    for dept_id, emp_days in dept_emp_days.items():
        dept_name       = dept_map.get(dept_id, "Unknown")
        total_present   = 0
        total_expected  = 0
        total_hours     = 0
        total_exp_hours = 0
        late_count      = 0
        early_count     = 0
        on_time_count   = 0
        very_late_count = 0
        punch_days      = 0

        for user_id, entries in emp_days.items():
            emp = emp_info[user_id]
            wd_val    = emp.work_days.value if emp.work_days else "mon_fri"
            shift_val = emp.shift.value     if emp.shift     else None
            exp_days  = working_days_in_range(d_from, d_to, wd_val, holiday_dates)
            exp_hrs   = exp_days * SHIFT_HOURS.get(shift_val, 8) if shift_val else 0

            total_expected  += exp_days
            total_exp_hours += exp_hrs

            # Group by date
            by_date: dict = defaultdict(list)
            for log, _ in entries:
                by_date[log.date].append(log)

            for att_date, day_logs in by_date.items():
                check_ins  = [l.timestamp for l in day_logs if l.punch_status == PunchStatusEnum.check_in]
                check_outs = [l.timestamp for l in day_logs if l.punch_status == PunchStatusEnum.check_out]
                clock_in   = min(check_ins)  if check_ins  else None
                clock_out  = max(check_outs) if check_outs else None

                if clock_in or clock_out:
                    total_present += 1

                if clock_in and clock_out:
                    hrs = (clock_out - clock_in).total_seconds() / 3600
                    total_hours += hrs

                # Punctuality
                if clock_in and shift_val and shift_val in SHIFT_START:
                    mins  = minutes_late(clock_in.time(), shift_val)
                    label = punctuality_label(mins, 30)
                    if label == "early":       early_count     += 1
                    elif label == "on_time":   on_time_count   += 1
                    elif label == "late":      late_count      += 1
                    else:                      very_late_count += 1
                    punch_days += 1

        # Rates
        attendance_rate  = round((total_present  / total_expected)  * 100, 1) if total_expected  else 0
        hours_rate       = round((total_hours    / total_exp_hours)  * 100, 1) if total_exp_hours else 0
        total_punches    = early_count + on_time_count + late_count + very_late_count
        punctuality_score = round(
            ((early_count + on_time_count) / total_punches) * 100, 1
        ) if total_punches else 0

        # Composite: 50% attendance, 30% punctuality, 20% hours
        composite = round(
            (attendance_rate * 0.5) + (punctuality_score * 0.3) + (hours_rate * 0.2), 1
        )

        results.append({
            "department_id"     : dept_id,
            "department_name"   : dept_name,
            "employee_count"    : len(emp_days),
            "attendance_rate"   : attendance_rate,
            "punctuality_score" : punctuality_score,
            "hours_rate"        : hours_rate,
            "composite_score"   : composite,
            "days_present"      : total_present,
            "expected_days"     : total_expected,
            "punctuality_breakdown": {
                "early"    : early_count,
                "on_time"  : on_time_count,
                "late"     : late_count,
                "very_late": very_late_count,
            }
        })

    return sorted(results, key=lambda x: x["composite_score"], reverse=True)


# ── 2. Punctuality analysis per department ────────────────────────────────────
@router.get("/punctuality")
def punctuality_analysis(
    date_from    : Optional[date] = Query(None),
    date_to      : Optional[date] = Query(None),
    month        : Optional[int]  = Query(None, ge=1, le=12),
    year         : Optional[int]  = Query(None, ge=2000),
    department_id: Optional[int]  = Query(None),
    grace_minutes: int            = Query(30, ge=0, le=120),
    db           : Session        = Depends(get_db),
):
    """
    Returns punctuality breakdown per employee.
    grace_minutes: how many minutes after shift start before marking as late.
    Default 30 minutes.
    """
    if month and year:
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)
    elif date_from and date_to:
        d_from, d_to = date_from, date_to
    else:
        today  = date.today()
        _, last = calendar.monthrange(today.year, today.month)
        d_from  = date(today.year, today.month, 1)
        d_to    = date(today.year, today.month, last)

    q = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        AttendanceLog.date >= d_from,
        AttendanceLog.date <= d_to,
        AttendanceLog.punch_status == PunchStatusEnum.check_in,
    )
    if department_id:
        q = q.filter(Employee.department_id == department_id)

    logs = q.all()

    # Group by employee
    by_emp: dict = defaultdict(list)
    emp_info: dict = {}
    for log, emp in logs:
        by_emp[emp.user_id].append(log)
        emp_info[emp.user_id] = emp

    results = []
    for user_id, check_ins in by_emp.items():
        emp       = emp_info[user_id]
        shift_val = emp.shift.value if emp.shift else None

        if not shift_val or shift_val not in SHIFT_START:
            continue

        early = on_time = late = very_late = 0
        total_mins_late = 0

        for log in check_ins:
            mins  = minutes_late(log.timestamp.time(), shift_val, grace_minutes)
            label = punctuality_label(mins, grace_minutes)
            if label == "early":       early     += 1
            elif label == "on_time":   on_time   += 1
            elif label == "late":      late      += 1
            else:                      very_late += 1
            if mins > 0:
                total_mins_late += mins

        total = early + on_time + late + very_late
        results.append({
            "user_id"        : user_id,
            "badge_number"   : emp.badge_number,
            "name"           : emp.name,
            "department"     : emp.department.name if emp.department else "—",
            "shift"          : shift_val,
            "shift_start"    : SHIFT_START[shift_val].strftime("%H:%M"),
            "grace_minutes"  : grace_minutes,
            "total_check_ins": total,
            "early"          : early,
            "on_time"        : on_time,
            "late"           : late,
            "very_late"      : very_late,
            "punctuality_rate": round(((early + on_time) / total) * 100, 1) if total else 0,
            "avg_mins_late"  : round(total_mins_late / (late + very_late), 1) if (late + very_late) else 0,
        })

    return sorted(results, key=lambda x: x["punctuality_rate"], reverse=True)


# ── 3. Attendance trend — monthly over time ───────────────────────────────────
@router.get("/attendance-trend")
def attendance_trend(
    year         : int            = Query(..., ge=2000),
    department_id: Optional[int]  = Query(None),
    db           : Session        = Depends(get_db),
):
    """
    Returns month-by-month attendance rate for the given year.
    Used to plot attendance trend over time.
    """
    results = []

    holidays = db.query(Holiday).filter(
        extract("year", Holiday.date) == year
    ).all()
    holiday_dates = {h.date for h in holidays}

    for month in range(1, 13):
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)

        q = db.query(AttendanceLog, Employee).join(
            Employee, AttendanceLog.user_id == Employee.user_id
        ).filter(
            AttendanceLog.date >= d_from,
            AttendanceLog.date <= d_to,
        )
        if department_id:
            q = q.filter(Employee.department_id == department_id)

        logs = q.all()
        if not logs:
            results.append({
                "month"          : month,
                "month_name"     : calendar.month_abbr[month],
                "attendance_rate": 0,
                "total_present"  : 0,
                "total_expected" : 0,
            })
            continue

        # Unique days present per employee
        emp_days: dict = defaultdict(set)
        emp_info: dict = {}
        for log, emp in logs:
            emp_days[emp.user_id].add(log.date)
            emp_info[emp.user_id] = emp

        total_present  = sum(len(days) for days in emp_days.values())
        total_expected = sum(
            working_days_in_range(
                d_from, d_to,
                emp.work_days.value if emp.work_days else "mon_fri",
                holiday_dates
            )
            for emp in emp_info.values()
        )

        results.append({
            "month"          : month,
            "month_name"     : calendar.month_abbr[month],
            "attendance_rate": round((total_present / total_expected) * 100, 1) if total_expected else 0,
            "total_present"  : total_present,
            "total_expected" : total_expected,
        })

    return results


# ── 4. Workforce overview ──────────────────────────────────────────────────────
@router.get("/workforce-overview")
def workforce_overview(
    db: Session = Depends(get_db),
):
    """
    Returns:
    - Total active employees (seen in last 60 days)
    - Total inactive employees (not seen in last 60 days)
    - Employees with no shift assigned
    - Employees with no department assigned
    - New employees (first seen in last 30 days)
    - Department headcount breakdown
    """
    today      = date.today()
    active_cut = today - timedelta(days=60)
    new_cut    = today - timedelta(days=30)

    employees  = db.query(Employee).all()
    total_emps = len(employees)

    # Last seen date per employee
    last_seen_rows = db.query(
        AttendanceLog.user_id,
        func.max(AttendanceLog.date).label("last_seen"),
    ).group_by(AttendanceLog.user_id).all()
    last_seen_map = {row.user_id: row.last_seen for row in last_seen_rows}

    # First seen date per employee
    first_seen_rows = db.query(
        AttendanceLog.user_id,
        func.min(AttendanceLog.date).label("first_seen"),
    ).group_by(AttendanceLog.user_id).all()
    first_seen_map = {row.user_id: row.first_seen for row in first_seen_rows}

    active        = 0
    inactive      = 0
    never_seen    = 0
    new_employees = 0
    no_shift      = 0
    no_dept       = 0

    for emp in employees:
        ls = last_seen_map.get(emp.user_id)
        fs = first_seen_map.get(emp.user_id)

        if ls is None:
            never_seen += 1
        elif ls >= active_cut:
            active += 1
        else:
            inactive += 1

        if fs and fs >= new_cut:
            new_employees += 1

        if not emp.shift:
            no_shift += 1
        if not emp.department_id:
            no_dept += 1

    # Department headcount
    departments = db.query(Department).all()
    dept_counts = defaultdict(int)
    for emp in employees:
        dept_counts[emp.department_id] += 1

    dept_breakdown = [
        {
            "department_id"  : d.id,
            "department_name": d.name,
            "headcount"      : dept_counts.get(d.id, 0),
        }
        for d in departments
    ]
    dept_breakdown.append({
        "department_id"  : None,
        "department_name": "Unassigned",
        "headcount"      : dept_counts.get(None, 0),
    })

    return {
        "total_employees"     : total_emps,
        "active_last_60_days" : active,
        "inactive_last_60_days": inactive,
        "never_recorded"      : never_seen,
        "new_last_30_days"    : new_employees,
        "no_shift_assigned"   : no_shift,
        "no_dept_assigned"    : no_dept,
        "department_breakdown": sorted(dept_breakdown, key=lambda x: x["headcount"], reverse=True),
    }


# ── 5. Employee clock-in behaviour ────────────────────────────────────────────
@router.get("/clockin-behaviour")
def clockin_behaviour(
    date_from    : Optional[date] = Query(None),
    date_to      : Optional[date] = Query(None),
    month        : Optional[int]  = Query(None, ge=1, le=12),
    year         : Optional[int]  = Query(None, ge=2000),
    department_id: Optional[int]  = Query(None),
    grace_minutes: int            = Query(30, ge=0, le=120),
    db           : Session        = Depends(get_db),
):
    """
    Per-employee clock-in behaviour summary:
    - Average clock-in time
    - Most common arrival pattern (early/on_time/late/very_late)
    - Consistency score (how consistent their arrival time is)
    - Longest absence streak
    """
    if month and year:
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)
    elif date_from and date_to:
        d_from, d_to = date_from, date_to
    else:
        today  = date.today()
        _, last = calendar.monthrange(today.year, today.month)
        d_from  = date(today.year, today.month, 1)
        d_to    = date(today.year, today.month, last)

    q = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        AttendanceLog.date >= d_from,
        AttendanceLog.date <= d_to,
    )
    if department_id:
        q = q.filter(Employee.department_id == department_id)

    logs = q.all()

    by_emp: dict = defaultdict(lambda: {"check_ins": [], "dates": set()})
    emp_info: dict = {}

    for log, emp in logs:
        if log.punch_status == PunchStatusEnum.check_in:
            by_emp[emp.user_id]["check_ins"].append(log.timestamp)
        by_emp[emp.user_id]["dates"].add(log.date)
        emp_info[emp.user_id] = emp

    results = []
    for user_id, data in by_emp.items():
        emp       = emp_info[user_id]
        shift_val = emp.shift.value if emp.shift else None
        check_ins = data["check_ins"]

        if not check_ins or not shift_val:
            continue

        # Average clock-in time (in minutes from midnight)
        mins_list = [ci.hour * 60 + ci.minute for ci in check_ins]
        avg_mins  = int(sum(mins_list) / len(mins_list))
        avg_time  = f"{avg_mins // 60:02d}:{avg_mins % 60:02d}"

        # Consistency — standard deviation of clock-in minutes
        mean     = sum(mins_list) / len(mins_list)
        variance = sum((m - mean) ** 2 for m in mins_list) / len(mins_list)
        std_dev  = variance ** 0.5
        # Lower std_dev = more consistent. Score out of 100
        consistency = max(0, round(100 - std_dev, 1))

        # Punctuality breakdown
        early = on_time = late = very_late = 0
        if shift_val in SHIFT_START:
            for ci in check_ins:
                mins  = minutes_late(ci.time(), shift_val, grace_minutes)
                label = punctuality_label(mins, grace_minutes)
                if label == "early":       early     += 1
                elif label == "on_time":   on_time   += 1
                elif label == "late":      late      += 1
                else:                      very_late += 1

        total  = early + on_time + late + very_late
        pattern = max(
            [("early", early), ("on_time", on_time), ("late", late), ("very_late", very_late)],
            key=lambda x: x[1]
        )[0] if total else "unknown"

        # Longest absence streak within the range
        wd_val    = emp.work_days.value if emp.work_days else "mon_fri"
        all_days  = set()
        current   = d_from
        while current <= d_to:
            wd = current.weekday()
            if (wd_val == "mon_fri" and wd < 5) or (wd_val == "mon_sat" and wd < 6):
                all_days.add(current)
            current += timedelta(days=1)

        present_dates = data["dates"]
        absent_days   = sorted(all_days - present_dates)

        max_streak = cur_streak = 0
        prev_day   = None
        for d in absent_days:
            if prev_day and (d - prev_day).days == 1:
                cur_streak += 1
            else:
                cur_streak = 1
            max_streak = max(max_streak, cur_streak)
            prev_day   = d

        results.append({
            "user_id"          : user_id,
            "badge_number"     : emp.badge_number,
            "name"             : emp.name,
            "department"       : emp.department.name if emp.department else "—",
            "shift"            : shift_val,
            "expected_start"   : SHIFT_START[shift_val].strftime("%H:%M") if shift_val in SHIFT_START else "—",
            "avg_clockin_time" : avg_time,
            "consistency_score": consistency,
            "dominant_pattern" : pattern,
            "punctuality_breakdown": {
                "early": early, "on_time": on_time,
                "late": late,   "very_late": very_late,
            },
            "punctuality_rate" : round(((early + on_time) / total) * 100, 1) if total else 0,
            "longest_absence_streak": max_streak,
        })

    return sorted(results, key=lambda x: x["punctuality_rate"], reverse=True)


# ── 6. Department of the month ────────────────────────────────────────────────
@router.get("/department-of-month")
def department_of_month(
    month        : int   = Query(..., ge=1, le=12),
    year         : int   = Query(..., ge=2000),
    grace_minutes: int   = Query(30, ge=0, le=120),
    db           : Session = Depends(get_db),
):
    """
    Returns the winning department for the given month with full breakdown.
    Winner = highest composite score (attendance 50% + punctuality 30% + hours 20%).
    """
    ranking = department_ranking(
        date_from=None, date_to=None, month=month, year=year, db=db
    )
    if not ranking:
        return {"winner": None, "ranking": []}

    winner = ranking[0]
    return {
        "month"  : calendar.month_name[month],
        "year"   : year,
        "winner" : winner,
        "ranking": ranking,
    }