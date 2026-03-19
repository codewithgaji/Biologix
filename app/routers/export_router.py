from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from collections import defaultdict
import calendar
import io
from db.database import get_db
from db.models.attendance import AttendanceLog, PunchStatusEnum
from db.models.employee import Employee
from db.models.department import Department
from core.security.dependencies import get_current_admin

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side, GradientFill
    from openpyxl.utils import get_column_letter
    from openpyxl.formatting.rule import ColorScaleRule
except ImportError:
    raise RuntimeError("openpyxl is not installed. Run: pip install openpyxl")


router = APIRouter(
    prefix="/export",
    tags=["Export"],
    dependencies=[Depends(get_current_admin)]
)


# ── Palette ────────────────────────────────────────────────────────────────────
NAVY          = "1B2A4A"
STEEL_BLUE    = "2E75B6"
LIGHT_BLUE    = "BDD7EE"
PALE_BLUE     = "DEEAF1"
WHITE         = "FFFFFF"
LIGHT_GRAY    = "F5F5F5"
MID_GRAY      = "D9D9D9"
DARK_GRAY     = "595959"
GREEN_BG      = "E2EFDA"
GREEN_FG      = "375623"
RED_BG        = "FCE4D6"
RED_FG        = "843C0C"
AMBER_BG      = "FFF2CC"
AMBER_FG      = "7F6000"
SUMMARY_BG    = "EBF3FB"
SUMMARY_BOLD  = "1B2A4A"

# ── Borders ───────────────────────────────────────────────────────────────────
def thin_border(color="CCCCCC"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def thick_bottom(color=NAVY):
    return Border(bottom=Side(style="medium", color=color))

THIN   = thin_border()
MEDIUM = thin_border("AAAAAA")

# ── Fonts ─────────────────────────────────────────────────────────────────────
def hdr_font(size=10):   return Font(name="Arial", bold=True, color=WHITE, size=size)
def body_font(size=9):   return Font(name="Arial", size=size, color=DARK_GRAY)
def bold_font(size=9, color=DARK_GRAY): return Font(name="Arial", bold=True, size=size, color=color)
def title_font(size=14): return Font(name="Arial", bold=True, color=NAVY, size=size)
def sub_font(size=9):    return Font(name="Arial", italic=True, color="888888", size=size)

# ── Summary columns ───────────────────────────────────────────────────────────
SUMMARY_COLS   = ["Employee ID", "Name", "Department", "Shift",
                  "Days Present", "Days Absent", "Expected Days",
                  "Attendance %", "Total Hours", "Expected Hours", "Hours %", "Status"]
SUMMARY_WIDTHS = [13, 28, 20, 12, 13, 12, 14, 14, 13, 15, 10, 12]


# ── Cell helpers ──────────────────────────────────────────────────────────────
def center(ws, row, col, value, font=None, fill=None, border=None, number_format=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    if font:          cell.font   = font
    if fill:          cell.fill   = fill
    if border:        cell.border = border
    if number_format: cell.number_format = number_format
    return cell

def left(ws, row, col, value, font=None, fill=None, border=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    if font:   cell.font   = font
    if fill:   cell.fill   = fill
    if border: cell.border = border
    return cell

def fill_of(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def write_title_block(ws, title, subtitle, col_count):
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 16

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=col_count)
    cell = ws.cell(row=1, column=1, value=title)
    cell.font      = title_font(14)
    cell.fill      = fill_of(NAVY)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=2)

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=col_count)
    cell = ws.cell(row=2, column=1, value=subtitle)
    cell.font      = sub_font(9)
    cell.fill      = fill_of(PALE_BLUE)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=2)


def write_summary_header(ws, row=3):
    ws.row_dimensions[row].height = 22
    hdr_fill = fill_of(NAVY)
    for col, (label, width) in enumerate(zip(SUMMARY_COLS, SUMMARY_WIDTHS), 1):
        center(ws, row, col, label, font=hdr_font(9), fill=hdr_fill, border=THIN)
        ws.column_dimensions[get_column_letter(col)].width = width


def write_summary_row(ws, row_num, r, alt=False):
    ws.row_dimensions[row_num].height = 18
    bg = fill_of(PALE_BLUE if alt else WHITE)

    attendance_pct = r["attendance_pct"]
    hours_pct      = r["hours_pct"]

    if attendance_pct is None:
        status_label = "No Data"
        status_fill  = fill_of(MID_GRAY)
        status_font  = bold_font(9, DARK_GRAY)
    elif attendance_pct >= 90:
        status_label = "Excellent"
        status_fill  = fill_of(GREEN_BG)
        status_font  = bold_font(9, GREEN_FG)
    elif attendance_pct >= 75:
        status_label = "Good"
        status_fill  = fill_of(AMBER_BG)
        status_font  = bold_font(9, AMBER_FG)
    else:
        status_label = "Poor"
        status_fill  = fill_of(RED_BG)
        status_font  = bold_font(9, RED_FG)

    values = [
        r["badge_number"],
        r["name"],
        r["department"],
        r["shift"].title() if r["shift"] != "—" else "—",
        r["days_present"],
        r["days_absent"],
        r["expected_days"],
        (attendance_pct / 100) if attendance_pct is not None else None,
        r["total_hours"],
        r["expected_hours"],
        (hours_pct / 100) if hours_pct is not None else None,
        None,
    ]

    for col, val in enumerate(values, 1):
        fmt = None
        if col in (8, 11):   fmt = "0.0%"
        if col in (9, 10):   fmt = "0.00"
        center(ws, row_num, col, val, font=body_font(), fill=bg, border=THIN, number_format=fmt)

    center(ws, row_num, 12, status_label, font=status_font, fill=status_fill, border=THIN)


def write_totals_row(ws, row_num, rows, col_count):
    ws.row_dimensions[row_num].height = 20
    tot_fill = fill_of(LIGHT_BLUE)

    n              = len(rows)
    total_present  = sum(r["days_present"] for r in rows)
    total_expected = sum(r["expected_days"] if isinstance(r["expected_days"], (int, float)) else 0 for r in rows)
    total_hours    = round(sum(r["total_hours"] for r in rows), 2)
    total_exp_hrs  = round(sum(r["expected_hours"] if isinstance(r["expected_hours"], (int, float)) else 0 for r in rows), 2)
    avg_att        = round(sum(r["attendance_pct"] or 0 for r in rows) / n, 1) if n else 0

    labels = {
        1: "TOTALS / AVERAGES",
        5: total_present,
        7: total_expected,
        8: avg_att / 100,
        9: total_hours,
        10: total_exp_hrs,
    }

    for col in range(1, col_count + 1):
        val = labels.get(col, None)
        fmt = None
        if col == 8:       fmt = "0.0%"
        if col in (9, 10): fmt = "0.00"
        center(ws, row_num, col, val, font=bold_font(9, SUMMARY_BOLD),
               fill=tot_fill, border=MEDIUM, number_format=fmt)


# ── Core data builder 
def build_user_summary(logs_with_employees, year, month=None, date_from=None, date_to=None):
    grouped = defaultdict(list)
    emp_map = {}
    for log, employee in logs_with_employees:
        grouped[(log.user_id, log.date)].append((log, employee))
        emp_map[log.user_id] = employee

    user_days  = defaultdict(int)
    user_hours = defaultdict(float)
    user_dates = defaultdict(set)

    for (user_id, att_date), entries in grouped.items():
        check_ins  = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_in]
        check_outs = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_out]

        clock_in  = min(check_ins)  if check_ins  else None
        clock_out = max(check_outs) if check_outs else None

        user_days[user_id]  += 1
        user_dates[user_id].add(att_date)

        if clock_in and clock_out:
            delta = (clock_out - clock_in).total_seconds() / 3600
            user_hours[user_id] += round(delta, 2)

    def count_working_days(work_days_val, year, month, date_from=None, date_to=None):
        if not work_days_val:
            return None
        # Use explicit date range if provided, otherwise full month
        if date_from and date_to:
            from datetime import timedelta
            count = 0
            current = date_from
            while current <= date_to:
                weekday = current.weekday()
                if work_days_val == "mon_fri" and weekday < 5:
                    count += 1
                elif work_days_val == "mon_sat" and weekday < 6:
                    count += 1
                current += timedelta(days=1)
            return count
        if not month:
            return None
        _, days_in_month = calendar.monthrange(year, month)
        count = 0
        for d in range(1, days_in_month + 1):
            weekday = date(year, month, d).weekday()
            if work_days_val == "mon_fri" and weekday < 5:
                count += 1
            elif work_days_val == "mon_sat" and weekday < 6:
                count += 1
        return count

    SHIFT_HOURS = {"morning": 8, "afternoon": 8, "night": 12, "day": 10}

    rows = []
    for user_id, employee in emp_map.items():
        shift_val     = employee.shift.value     if employee.shift     else None
        work_days_val = employee.work_days.value if employee.work_days else None
        dept_name     = employee.department.name if employee.department else "Unassigned"

        expected_days  = count_working_days(work_days_val, year, month, date_from, date_to)
        shift_hrs      = SHIFT_HOURS.get(shift_val) if shift_val else None
        expected_hours = round(expected_days * shift_hrs, 2) if (expected_days and shift_hrs) else None

        days_present = user_days[user_id]
        days_absent  = (expected_days - days_present) if expected_days is not None else None
        total_hours  = round(user_hours[user_id], 2)

        attendance_pct = round((days_present / expected_days) * 100, 1) if expected_days else None
        hours_pct      = round((total_hours / expected_hours) * 100, 1) if expected_hours else None

        rows.append({
            "user_id"       : user_id,
            "badge_number"  : employee.badge_number or "—",
            "name"          : employee.name,
            "department"    : dept_name,
            "shift"         : shift_val or "—",
            "days_present"  : days_present,
            "days_absent"   : days_absent if days_absent is not None else "—",
            "expected_days" : expected_days if expected_days is not None else "—",
            "attendance_pct": attendance_pct,
            "total_hours"   : total_hours,
            "expected_hours": expected_hours if expected_hours is not None else "—",
            "hours_pct"     : hours_pct,
        })

    return sorted(rows, key=lambda x: (x["department"], x["name"]))


# ── Sheet writer ──────────────────────────────────────────────────────────────
def write_summary_sheet(ws, rows, title, subtitle):
    col_count = len(SUMMARY_COLS)

    write_title_block(ws, title, subtitle, col_count)
    write_summary_header(ws, row=3)

    for i, r in enumerate(rows):
        write_summary_row(ws, i + 4, r, alt=(i % 2 == 1))

    totals_row = len(rows) + 4
    write_totals_row(ws, totals_row, rows, col_count)

    ws.freeze_panes = ws.cell(row=4, column=1)

    att_col  = get_column_letter(8)
    hrs_col  = get_column_letter(11)
    data_end = totals_row - 1

    if data_end >= 4:
        ws.conditional_formatting.add(
            f"{att_col}4:{att_col}{data_end}",
            ColorScaleRule(
                start_type="num", start_value=0,   start_color="FCE4D6",
                mid_type="num",   mid_value=0.75,  mid_color="FFF2CC",
                end_type="num",   end_value=1,     end_color="E2EFDA",
            )
        )
        ws.conditional_formatting.add(
            f"{hrs_col}4:{hrs_col}{data_end}",
            ColorScaleRule(
                start_type="num", start_value=0,   start_color="FCE4D6",
                mid_type="num",   mid_value=0.75,  mid_color="FFF2CC",
                end_type="num",   end_value=1,     end_color="E2EFDA",
            )
        )

    ws.sheet_view.showGridLines = False


# ── Query helper ──────────────────────────────────────────────────────────────
def base_query(db, date_from, date_to, department_id=None, user_id=None):
    """Single place where all filters are applied."""
    q = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        AttendanceLog.date >= date_from,
        AttendanceLog.date <= date_to,
    )
    if department_id:
        q = q.filter(Employee.department_id == department_id)
    if user_id:
        q = q.filter(AttendanceLog.user_id == user_id)
    return q


# ── Workbook builders ─────────────────────────────────────────────────────────
def build_workbook_monthly(db, year, month, department_id=None, user_id=None):
    _, last_day = calendar.monthrange(year, month)
    date_from   = date(year, month, 1)
    date_to     = date(year, month, last_day)

    logs = base_query(db, date_from, date_to, department_id, user_id).all()
    if not logs:
        raise HTTPException(status_code=404, detail="No attendance data found")

    rows       = build_user_summary(logs, year, month)
    month_name = date(year, month, 1).strftime("%B %Y")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = month_name[:31]

    write_summary_sheet(
        ws, rows,
        title    = f"Attendance Summary — {month_name}",
        subtitle = f"Generated {date.today().strftime('%d %b %Y')}  ·  {len(rows)} employees",
    )

    # Skip per-department sheets when exporting a single employee
    if not user_id:
        dept_groups = defaultdict(list)
        for r in rows:
            dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            ws_dept = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(
                ws_dept, dept_rows,
                title    = f"{dept_name} — {month_name}",
                subtitle = f"{len(dept_rows)} employees",
            )

    return wb


def build_workbook_range(db, date_from, date_to, department_id=None, user_id=None):
    logs = base_query(db, date_from, date_to, department_id, user_id).all()
    if not logs:
        raise HTTPException(status_code=404, detail="No attendance data found")

    # Pass month only if the range is within a single month
    if date_from.year == date_to.year and date_from.month == date_to.month:
        rows = build_user_summary(logs, year=date_from.year, month=None, date_from=date_from, date_to=date_to)
    else:
        rows = build_user_summary(logs, year=date_from.year, month=None, date_from=date_from, date_to=date_to)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Summary"

    write_summary_sheet(
        ws, rows,
        title    = f"Attendance Summary — {date_from} to {date_to}",
        subtitle = f"Generated {date.today().strftime('%d %b %Y')}  ·  {len(rows)} employees",
    )

    # Skip per-department sheets when exporting a single employee
    if not user_id:
        dept_groups = defaultdict(list)
        for r in rows:
            dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            ws_dept = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(
                ws_dept, dept_rows,
                title    = f"{dept_name} — {date_from} to {date_to}",
                subtitle = f"{len(dept_rows)} employees",
            )

    return wb


def build_workbook_year(db, year, department_id=None, user_id=None):
    wb    = openpyxl.Workbook()
    first = True

    for month in range(1, 13):
        _, last_day = calendar.monthrange(year, month)
        date_from   = date(year, month, 1)
        date_to     = date(year, month, last_day)

        logs = base_query(db, date_from, date_to, department_id, user_id).all()
        if not logs:
            continue

        rows       = build_user_summary(logs, year, month)
        month_name = date(year, month, 1).strftime("%B %Y")

        if first:
            ws       = wb.active
            ws.title = month_name[:31]
            first    = False
        else:
            ws = wb.create_sheet(title=month_name[:31])

        write_summary_sheet(
            ws, rows,
            title    = f"Attendance Summary — {month_name}",
            subtitle = f"{len(rows)} employees",
        )

    if not wb.sheetnames:
        raise HTTPException(status_code=404, detail="No attendance data found for this year")

    return wb


# ── Endpoint 
@router.get("/attendance")
def export_attendance(
    db            : Session        = Depends(get_db),
    date_from     : Optional[date] = Query(None),
    date_to       : Optional[date] = Query(None),
    month         : Optional[int]  = Query(None, ge=1, le=12),
    year          : Optional[int]  = Query(None, ge=2000),
    department_id : Optional[int]  = Query(None),
    user_id       : Optional[int]  = Query(None),   # ← filters to a single employee
):
    if year and not month and not date_from:
        wb       = build_workbook_year(db, year, department_id, user_id)
        filename = f"attendance_{year}.xlsx"

    elif month and year:
        wb       = build_workbook_monthly(db, year, month, department_id, user_id)
        filename = f"attendance_{year}_{str(month).zfill(2)}.xlsx"

    else:
        if not date_from or not date_to:
            raise HTTPException(
                status_code=400,
                detail="Provide either date_from+date_to, month+year, or year"
            )
        wb       = build_workbook_range(db, date_from, date_to, department_id, user_id)
        filename = f"attendance_{date_from}_to_{date_to}.xlsx"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers    = {"Content-Disposition": f"attachment; filename={filename}"},
    )