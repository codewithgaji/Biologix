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
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.formatting.rule import ColorScaleRule
except ImportError:
    raise RuntimeError("openpyxl is not installed. Run: pip install openpyxl")

router = APIRouter(
    prefix="/export",
    tags=["Export"],
    dependencies=[Depends(get_current_admin)]
)

# ── Palette 
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

# ── Borders 
def thin_border(color="CCCCCC"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

THIN = thin_border()
MEDIUM = thin_border("AAAAAA")

# ── Fonts 
def hdr_font(size=10):   return Font(name="Arial", bold=True, color=WHITE, size=size)
def body_font(size=9):   return Font(name="Arial", size=size, color=DARK_GRAY)
def bold_font(size=9, color=DARK_GRAY): return Font(name="Arial", bold=True, size=size, color=color)
def title_font(size=14): return Font(name="Arial", bold=True, color=NAVY, size=size)
def sub_font(size=9):    return Font(name="Arial", italic=True, color="888888", size=size)

# ── Summary columns 
# ADDED "Position" here
SUMMARY_COLS   = ["Employee ID", "Name", "Position", "Department", "Shift",
                  "Days Present", "Days Absent", "Expected Days",
                  "Attendance %", "Total Hours", "Expected Hours", "Hours %", "Status"]
SUMMARY_WIDTHS = [13, 28, 22, 20, 12, 13, 12, 14, 14, 13, 15, 10, 12]

# ── Cell helpers 
def center(ws, row, col, value, font=None, fill=None, border=None, number_format=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    if font:          cell.font   = font
    if fill:          cell.fill   = fill
    if border:        cell.border = border
    if number_format: cell.number_format = number_format
    return cell

def fill_of(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def write_title_block(ws, title, subtitle, col_count):
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 16
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=col_count)
    cell = ws.cell(row=1, column=1, value=title)
    cell.font = title_font(14)
    cell.fill = fill_of(NAVY)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=2)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=col_count)
    cell = ws.cell(row=2, column=1, value=subtitle)
    cell.font = sub_font(9)
    cell.fill = fill_of(PALE_BLUE)
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
    
    if attendance_pct is None:
        status_label, status_fill, status_font = "No Data", fill_of(MID_GRAY), bold_font(9, DARK_GRAY)
    elif attendance_pct >= 90:
        status_label, status_fill, status_font = "Excellent", fill_of(GREEN_BG), bold_font(9, GREEN_FG)
    elif attendance_pct >= 75:
        status_label, status_fill, status_font = "Good", fill_of(AMBER_BG), bold_font(9, AMBER_FG)
    else:
        status_label, status_fill, status_font = "Poor", fill_of(RED_BG), bold_font(9, RED_FG)

    values = [
        r["badge_number"],
        r["name"],
        r["position"], # New Column
        r["department"],
        r["shift"].title() if r["shift"] != "—" else "—",
        r["days_present"],
        r["days_absent"],
        r["expected_days"],
        (attendance_pct / 100) if attendance_pct is not None else None,
        r["total_hours"],
        r["expected_hours"],
        (r["hours_pct"] / 100) if r["hours_pct"] is not None else None,
        None,
    ]

    for col, val in enumerate(values, 1):
        fmt = "0.0%" if col in (9, 12) else "0.00" if col in (10, 11) else None
        center(ws, row_num, col, val, font=body_font(), fill=bg, border=THIN, number_format=fmt)
    center(ws, row_num, 13, status_label, font=status_font, fill=status_fill, border=THIN)

def write_totals_row(ws, row_num, rows, col_count):
    ws.row_dimensions[row_num].height = 20
    tot_fill = fill_of(LIGHT_BLUE)
    n = len(rows)
    total_present = sum(r["days_present"] for r in rows)
    total_expected = sum(r["expected_days"] if isinstance(r["expected_days"], int) else 0 for r in rows)
    total_hours = round(sum(r["total_hours"] for r in rows), 2)
    total_exp_hrs = round(sum(r["expected_hours"] if isinstance(r["expected_hours"], (int, float)) else 0 for r in rows), 2)
    avg_att = round(sum(r["attendance_pct"] or 0 for r in rows) / n, 1) if n else 0

    labels = {1: "TOTALS / AVERAGES", 6: total_present, 8: total_expected, 9: avg_att / 100, 10: total_hours, 11: total_exp_hrs}
    for col in range(1, col_count + 1):
        val = labels.get(col)
        fmt = "0.0%" if col == 9 else "0.00" if col in (10, 11) else None
        center(ws, row_num, col, val, font=bold_font(9, SUMMARY_BOLD), fill=tot_fill, border=MEDIUM, number_format=fmt)

def build_user_summary(logs_with_employees, year, month=None, date_from=None, date_to=None):
    grouped = defaultdict(list)
    emp_map = {}
    for log, employee in logs_with_employees:
        grouped[(log.user_id, log.date)].append((log, employee))
        emp_map[log.user_id] = employee

    user_days, user_hours = defaultdict(int), defaultdict(float)
    for (user_id, _), entries in grouped.items():
        check_ins = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_in]
        check_outs = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_out]
        if check_ins and check_outs:
            user_hours[user_id] += round((max(check_outs) - min(check_ins)).total_seconds() / 3600, 2)
        user_days[user_id] += 1

    def count_working_days(work_days_val, year, month, d_from=None, d_to=None):
        if not work_days_val: return None
        from datetime import timedelta
        curr = d_from or date(year, month, 1)
        end = d_to or date(year, month, calendar.monthrange(year, month)[1])
        count = 0
        while curr <= end:
            wd = curr.weekday()
            if (work_days_val == "mon_fri" and wd < 5) or (work_days_val == "mon_sat" and wd < 6):
                count += 1
            curr += timedelta(days=1)
        return count

    SHIFT_HOURS = {"morning": 8, "afternoon": 8, "night": 12, "day": 10}
    rows = []
    for user_id, emp in emp_map.items():
        s_val, wd_val = (emp.shift.value if emp.shift else None), (emp.work_days.value if emp.work_days else None)
        exp_d = count_working_days(wd_val, year, month, date_from, date_to)
        exp_h = round(exp_d * SHIFT_HOURS.get(s_val, 0), 2) if exp_d and s_val else None
        pres = user_days[user_id]
        rows.append({
            "badge_number": emp.badge_number or "—",
            "name": emp.name,
            "position": emp.position or "—", # PULLING POSITION FROM MODEL
            "department": emp.department.name if emp.department else "Unassigned",
            "shift": s_val or "—",
            "days_present": pres,
            "days_absent": (exp_d - pres) if exp_d is not None else "—",
            "expected_days": exp_d if exp_d is not None else "—",
            "attendance_pct": round((pres / exp_d) * 100, 1) if exp_d else None,
            "total_hours": round(user_hours[user_id], 2),
            "expected_hours": exp_h if exp_h is not None else "—",
            "hours_pct": round((user_hours[user_id] / exp_h) * 100, 1) if exp_h else None,
        })
    return sorted(rows, key=lambda x: (x["department"], x["name"]))

def write_summary_sheet(ws, rows, title, subtitle):
    col_count = len(SUMMARY_COLS)
    write_title_block(ws, title, subtitle, col_count)
    write_summary_header(ws, row=3)
    for i, r in enumerate(rows): write_summary_row(ws, i + 4, r, alt=(i % 2 == 1))
    t_row = len(rows) + 4
    write_totals_row(ws, t_row, rows, col_count)
    ws.freeze_panes = "A4"
    for col in ["I", "L"]: # Attendance and Hours % cols
        ws.conditional_formatting.add(f"{col}4:{col}{t_row-1}", ColorScaleRule(start_type="num", start_value=0, start_color="FCE4D6", mid_type="num", mid_value=0.75, mid_color="FFF2CC", end_type="num", end_value=1, end_color="E2EFDA"))
    ws.sheet_view.showGridLines = False

def base_query(db, date_from, date_to, dept_id=None, user_id=None):
    q = db.query(AttendanceLog, Employee).join(Employee, AttendanceLog.user_id == Employee.user_id).filter(AttendanceLog.date >= date_from, AttendanceLog.date <= date_to)
    if dept_id: q = q.filter(Employee.department_id == dept_id)
    if user_id: q = q.filter(AttendanceLog.user_id == user_id)
    return q

def build_workbook_monthly(db, year, month, dept_id=None, user_id=None):
    _, last = calendar.monthrange(year, month)
    d_from, d_to = date(year, month, 1), date(year, month, last)
    logs = base_query(db, d_from, d_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")
    rows = build_user_summary(logs, year, month)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Monthly Summary"
    write_summary_sheet(ws, rows, f"Attendance Summary — {d_from.strftime('%B %Y')}", f"Generated {date.today()} · {len(rows)} employees")
    return wb

def build_workbook_range(db, date_from, date_to, dept_id=None, user_id=None):
    logs = base_query(db, date_from, date_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")
    rows = build_user_summary(logs, date_from.year, None, date_from, date_to)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Range Summary"
    write_summary_sheet(ws, rows, f"Attendance Summary — {date_from} to {date_to}", f"Generated {date.today()} · {len(rows)} employees")
    return wb

def build_workbook_year(db, year, dept_id=None, user_id=None):
    wb = openpyxl.Workbook()
    first = True
    for month in range(1, 13):
        _, last = calendar.monthrange(year, month)
        logs = base_query(db, date(year, month, 1), date(year, month, last), dept_id, user_id).all()
        if not logs: continue
        rows = build_user_summary(logs, year, month)
        ws = wb.active if first else wb.create_sheet(title=calendar.month_name[month])
        if first: ws.title = calendar.month_name[month]; first = False
        write_summary_sheet(ws, rows, f"Attendance Summary — {calendar.month_name[month]} {year}", f"{len(rows)} employees")
    if not wb.sheetnames: raise HTTPException(status_code=404, detail="No data for year")
    return wb

@router.get("/attendance")
def export_attendance(db: Session = Depends(get_db), date_from: Optional[date] = Query(None), date_to: Optional[date] = Query(None), month: Optional[int] = Query(None, ge=1, le=12), year: Optional[int] = Query(None, ge=2000), department_id: Optional[int] = Query(None), user_id: Optional[int] = Query(None)):
    if year and not month and not date_from:
        wb, filename = build_workbook_year(db, year, department_id, user_id), f"attendance_{year}.xlsx"
    elif month and year:
        wb, filename = build_workbook_monthly(db, year, month, department_id, user_id), f"attendance_{year}_{month}.xlsx"
    else:
        if not date_from or not date_to: raise HTTPException(status_code=400, detail="Missing dates")
        wb, filename = build_workbook_range(db, date_from, date_to, department_id, user_id), f"attendance_range.xlsx"
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})