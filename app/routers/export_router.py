from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, timedelta
from collections import defaultdict
import calendar
import io
from db.database import get_db
from db.models.attendance import AttendanceLog, PunchStatusEnum
from db.models.employee import Employee
from db.models.department import Department
from db.models.leave import Leave, LeaveTypeEnum
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
NAVY             = "1B2A4A"
LIGHT_BLUE       = "BDD7EE"
PALE_BLUE        = "DEEAF1"
WHITE            = "FFFFFF"
MID_GRAY         = "D9D9D9"
DARK_GRAY        = "595959"
GREEN_BG         = "E2EFDA"
GREEN_FG         = "375623"
RED_BG           = "FCE4D6"
RED_FG           = "843C0C"
AMBER_BG         = "FFF2CC"
AMBER_FG         = "7F6000"
LEAVE_PAID       = "E8F5E9"
LEAVE_UNPAID     = "FFF3E0"
LEAVE_HDR        = "2E7D32"
LEAVE_UNPAID_HDR = "E65100"
SUMMARY_BOLD     = "1B2A4A"

# ── Borders
def thin_border(color="CCCCCC"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

THIN   = thin_border()
MEDIUM = thin_border("AAAAAA")

# ── Fonts
def hdr_font(size=10):                  return Font(name="Arial", bold=True, color=WHITE, size=size)
def body_font(size=9):                  return Font(name="Arial", size=size, color=DARK_GRAY)
def bold_font(size=9, color=DARK_GRAY): return Font(name="Arial", bold=True, size=size, color=color)
def title_font(size=14):                return Font(name="Arial", bold=True, color=NAVY, size=size)
def sub_font(size=9):                   return Font(name="Arial", italic=True, color="888888", size=size)

# ── Column definitions
# 1=Employee ID, 2=Name, 3=Position, 4=Department, 5=Shift
# 6=Days Present (biometric + paid leave), 7=Days Absent (formula), 8=Expected Days
# 9=Attendance % (formula), 10=Total Hours, 11=Expected Hours
# 12=Absent Hours (formula: =K-J), 13=Hours % (formula), 14=Status

SUMMARY_COLS = [
    "Employee ID", "Name", "Position", "Department", "Shift",
    "Days Present", "Days Absent", "Expected Days",
    "Attendance %", "Total Hours", "Expected Hours",
    "Absent Hours", "Hours %", "Status"
]
SUMMARY_WIDTHS = [13, 28, 22, 20, 12, 13, 12, 14, 14, 13, 15, 13, 10, 12]

COL_PRESENT    = 6   # F  — biometric present + paid leave days
COL_ABSENT     = 7   # G  ← formula: =H-F
COL_EXPECTED   = 8   # H
COL_ATT_PCT    = 9   # I  ← formula: =IF(H>0, F/H, "")
COL_HRS        = 10  # J  — total hours worked
COL_EXP_HRS   = 11  # K  — expected hours
COL_ABS_HRS   = 12  # L  ← formula: =IF(K>0, MAX(K-J,0), "") — absent hours
COL_HRS_PCT   = 13  # M  ← formula: =IF(K>0, J/K, "")
COL_STATUS     = 14  # N

# ── Cell helper
def cell_write(ws, row, col, value, font=None, fill=None, border=None,
               number_format=None, alignment=None):
    c = ws.cell(row=row, column=col, value=value)
    c.alignment = alignment or Alignment(horizontal="center", vertical="center", wrap_text=True)
    if font:          c.font          = font
    if fill:          c.fill          = fill
    if border:        c.border        = border
    if number_format: c.number_format = number_format
    return c

def fill_of(hex_color):
    return PatternFill("solid", fgColor=hex_color)

# ── Title block
def write_title_block(ws, title, subtitle, col_count):
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 16
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=col_count)
    c = ws.cell(row=1, column=1, value=title)
    c.font      = title_font(14)
    c.fill      = fill_of(NAVY)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=2)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=col_count)
    c = ws.cell(row=2, column=1, value=subtitle)
    c.font      = sub_font(9)
    c.fill      = fill_of(PALE_BLUE)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=2)

# ── Summary header
def write_summary_header(ws, row=3):
    ws.row_dimensions[row].height = 22
    hdr_fill = fill_of(NAVY)
    for col, (label, width) in enumerate(zip(SUMMARY_COLS, SUMMARY_WIDTHS), 1):
        cell_write(ws, row, col, label, font=hdr_font(9), fill=hdr_fill, border=THIN)
        ws.column_dimensions[get_column_letter(col)].width = width

# ── Summary data row
def write_summary_row(ws, row_num, r, alt=False):
    ws.row_dimensions[row_num].height = 18
    bg             = fill_of(PALE_BLUE if alt else WHITE)
    attendance_pct = r["attendance_pct"]

    # Status badge — driven by corrected days_present (paid leave included)
    if attendance_pct is None:
        s_label, s_fill, s_font = "No Data",  fill_of(MID_GRAY),  bold_font(9, DARK_GRAY)
    elif attendance_pct >= 90:
        s_label, s_fill, s_font = "Excellent", fill_of(GREEN_BG), bold_font(9, GREEN_FG)
    elif attendance_pct >= 75:
        s_label, s_fill, s_font = "Good",      fill_of(AMBER_BG), bold_font(9, AMBER_FG)
    else:
        s_label, s_fill, s_font = "Poor",      fill_of(RED_BG),   bold_font(9, RED_FG)

    # Static value columns
    static = {
        1:  r["badge_number"],
        2:  r["name"],
        3:  r["position"],
        4:  r["department"],
        5:  r["shift"].title() if r["shift"] != "—" else "—",
        6:  r["days_present"],   # ← already corrected (biometric + paid leave)
        8:  r["expected_days"]   if isinstance(r["expected_days"],   (int, float)) else None,
        10: r["total_hours"],
        11: r["expected_hours"]  if isinstance(r["expected_hours"],  (int, float)) else None,
    }

    for col, val in static.items():
        fmt = "0.00" if col in (10, 11) else None
        cell_write(ws, row_num, col, val,
                   font=body_font(), fill=bg, border=THIN, number_format=fmt)

    P = get_column_letter(COL_PRESENT)
    E = get_column_letter(COL_EXPECTED)
    J = get_column_letter(COL_HRS)
    K = get_column_letter(COL_EXP_HRS)
    n = row_num

    # Days Absent = Expected - Present
    c = ws.cell(row=n, column=COL_ABSENT)
    c.value         = f'=IF({E}{n}<>"",{E}{n}-{P}{n},"—")'
    c.font          = body_font()
    c.fill          = bg
    c.border        = THIN
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Attendance % = Present / Expected
    c = ws.cell(row=n, column=COL_ATT_PCT)
    c.value         = f"=IF({E}{n}>0,{P}{n}/{E}{n},\"\")"
    c.font          = body_font()
    c.fill          = bg
    c.border        = THIN
    c.number_format = "0.0%"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Absent Hours = MAX(Expected Hours - Total Hours, 0)
    # Using MAX so it never goes negative. Live formula — editing J auto-updates L.
    c = ws.cell(row=n, column=COL_ABS_HRS)
    c.value         = f'=IF({K}{n}>0,MAX({K}{n}-{J}{n},0),"—")'
    c.font          = body_font()
    c.fill          = fill_of("FFF3E0") if r.get("has_unpaid_leave") else bg  # subtle tint if unpaid leave
    c.border        = THIN
    c.number_format = "0.00"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Hours % = Total Hours / Expected Hours
    c = ws.cell(row=n, column=COL_HRS_PCT)
    c.value         = f"=IF({K}{n}>0,{J}{n}/{K}{n},\"\")"
    c.font          = body_font()
    c.fill          = bg
    c.border        = THIN
    c.number_format = "0.0%"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Status
    cell_write(ws, row_num, COL_STATUS, s_label, font=s_font, fill=s_fill, border=THIN)

# ── Totals row
def write_totals_row(ws, row_num, data_start, data_end, col_count):
    ws.row_dimensions[row_num].height = 20
    tot_fill = fill_of(LIGHT_BLUE)

    for col in range(1, col_count + 1):
        c = ws.cell(row=row_num, column=col)
        c.fill      = tot_fill
        c.border    = MEDIUM
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.alignment = Alignment(horizontal="center", vertical="center")

    ws.cell(row=row_num, column=1).value     = "TOTALS / AVERAGES"
    ws.cell(row=row_num, column=1).alignment = Alignment(
        horizontal="left", vertical="center", indent=1
    )

    P  = get_column_letter(COL_PRESENT)
    G  = get_column_letter(COL_ABSENT)
    E  = get_column_letter(COL_EXPECTED)
    J  = get_column_letter(COL_HRS)
    K  = get_column_letter(COL_EXP_HRS)
    L  = get_column_letter(COL_ABS_HRS)
    AP = get_column_letter(COL_ATT_PCT)
    n  = row_num

    ws.cell(row=n, column=COL_PRESENT).value  = f"=SUM({P}{data_start}:{P}{data_end})"
    ws.cell(row=n, column=COL_ABSENT).value   = f"=SUM({G}{data_start}:{G}{data_end})"
    ws.cell(row=n, column=COL_EXPECTED).value = f"=SUM({E}{data_start}:{E}{data_end})"
    ws.cell(row=n, column=COL_HRS).value      = f"=SUM({J}{data_start}:{J}{data_end})"
    ws.cell(row=n, column=COL_EXP_HRS).value  = f"=SUM({K}{data_start}:{K}{data_end})"

    # Total absent hours = sum of all absent hour rows
    c = ws.cell(row=n, column=COL_ABS_HRS)
    c.value         = f"=SUM({L}{data_start}:{L}{data_end})"
    c.number_format = "0.00"

    # Average attendance %
    c = ws.cell(row=n, column=COL_ATT_PCT)
    c.value         = f"=AVERAGE({AP}{data_start}:{AP}{data_end})"
    c.number_format = "0.0%"

    # Hours %
    c = ws.cell(row=n, column=COL_HRS_PCT)
    c.value         = f'=IF(SUM({K}{data_start}:{K}{data_end})>0,SUM({J}{data_start}:{J}{data_end})/SUM({K}{data_start}:{K}{data_end}),"—")'
    c.number_format = "0.0%"

    for col in [COL_PRESENT, COL_ABSENT, COL_EXPECTED, COL_HRS,
                COL_EXP_HRS, COL_ABS_HRS, COL_ATT_PCT, COL_HRS_PCT]:
        c = ws.cell(row=n, column=col)
        c.fill      = tot_fill
        c.border    = MEDIUM
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.alignment = Alignment(horizontal="center", vertical="center")
        if col in (COL_HRS, COL_EXP_HRS, COL_ABS_HRS):
            c.number_format = "0.00"

# ── Leave section writer (unchanged)
def write_leave_section(ws, leave_rows, start_row, col_count):
    if not leave_rows:
        return start_row

    row = start_row + 1

    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_count)
    c = ws.cell(row=row, column=1, value="LEAVE RECORDS IN PERIOD")
    c.font      = Font(name="Arial", bold=True, color=WHITE, size=10)
    c.fill      = fill_of(NAVY)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=2)
    ws.row_dimensions[row].height = 18
    row += 1

    leave_cols   = ["Employee ID", "Name", "Leave Type", "From", "To", "Days", "Description"]
    leave_widths = [13, 28, 14, 14, 14, 8, 40]
    for col, (label, width) in enumerate(zip(leave_cols, leave_widths), 1):
        c = ws.cell(row=row, column=col, value=label)
        c.font      = hdr_font(9)
        c.fill      = fill_of("37474F")
        c.border    = THIN
        c.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(col)].width = max(
            ws.column_dimensions[get_column_letter(col)].width, width
        )
    ws.row_dimensions[row].height = 18
    row += 1

    paid_rows   = [r for r in leave_rows if r["leave_type"] == "paid"]
    unpaid_rows = [r for r in leave_rows if r["leave_type"] == "unpaid"]

    def write_leave_rows(rows, leave_type):
        nonlocal row
        if not rows:
            return
        label     = "Paid Leave" if leave_type == "paid" else "Unpaid Leave"
        hdr_color = LEAVE_HDR if leave_type == "paid" else LEAVE_UNPAID_HDR
        bg_color  = LEAVE_PAID if leave_type == "paid" else LEAVE_UNPAID

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(leave_cols))
        c = ws.cell(row=row, column=1,
                    value=f"  {label} ({len(rows)} record{'s' if len(rows) > 1 else ''})")
        c.font      = Font(name="Arial", bold=True, color=WHITE, size=9)
        c.fill      = fill_of(hdr_color)
        c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[row].height = 16
        row += 1

        for r in rows:
            bg   = fill_of(bg_color)
            vals = [
                r["badge_number"], r["name"], label,
                r["date_from"], r["date_to"], r["days"],
                r["description"] or "—",
            ]
            for col, val in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.font      = body_font()
                c.fill      = bg
                c.border    = THIN
                c.alignment = Alignment(
                    horizontal="center" if col != 7 else "left", vertical="center"
                )
                if col in (4, 5):
                    c.number_format = "DD-MMM-YYYY"
            ws.row_dimensions[row].height = 16
            row += 1

        total_days = sum(r["days"] for r in rows)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        c = ws.cell(row=row, column=1, value=f"Total {label} Days")
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.fill      = fill_of(LIGHT_BLUE)
        c.border    = MEDIUM
        c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
        for col in [6]:
            c = ws.cell(row=row, column=col, value=total_days)
            c.font      = bold_font(9, SUMMARY_BOLD)
            c.fill      = fill_of(LIGHT_BLUE)
            c.border    = MEDIUM
            c.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[row].height = 16
        row += 1

    write_leave_rows(paid_rows,   "paid")
    write_leave_rows(unpaid_rows, "unpaid")
    return row


# ── Core data builder — now paid-leave-aware ──────────────────────────────────
def build_user_summary(logs_with_employees, year, month=None,
                       date_from=None, date_to=None, db=None):
    grouped = defaultdict(list)
    emp_map = {}
    for log, employee in logs_with_employees:
        grouped[(log.user_id, log.date)].append((log, employee))
        emp_map[log.user_id] = employee

    user_days  = defaultdict(int)
    user_hours = defaultdict(float)
    for (user_id, _), entries in grouped.items():
        ins  = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_in]
        outs = [e[0].timestamp for e in entries if e[0].punch_status == PunchStatusEnum.check_out]
        if ins and outs:
            user_hours[user_id] += round(
                (max(outs) - min(ins)).total_seconds() / 3600, 2
            )
        user_days[user_id] += 1

    d_from = date_from or date(year, month, 1)
    d_to   = date_to   or date(year, month, calendar.monthrange(year, month)[1])

    biometric_dates: dict[int, set] = defaultdict(set)
    for (user_id, day), _ in grouped.items():
        biometric_dates[user_id].add(day)

    paid_leave_extra: dict[int, int]   = defaultdict(int)
    paid_leave_hours: dict[int, float] = defaultdict(float)
    has_unpaid_leave: dict[int, bool]  = defaultdict(bool)

    SHIFT_HOURS = {"morning": 8, "afternoon": 8, "night": 12, "day": 10}

    def is_working_day_for(d: date, emp: Employee) -> bool:
        """Check if date is a working day for this specific employee."""
        weekday = d.weekday()  # 0=Mon … 5=Sat, 6=Sun
        if weekday == 6:
            return False  # Sunday: never a working day
        if weekday == 5:
            # Saturday only counts for mon_sat employees
            wd_val = emp.work_days.value if emp.work_days else "mon_fri"
            return wd_val == "mon_sat"
        return True  # Mon–Fri always counts

    if db is not None:
        leave_q = db.query(Leave).filter(
            Leave.date_to   >= d_from,
            Leave.date_from <= d_to,
        ).all()

        for leave in leave_q:
            eff_from = max(leave.date_from, d_from)
            eff_to   = min(leave.date_to,   d_to)

            cursor = eff_from
            while cursor <= eff_to:
                if leave.applies_to_all:
                    affected = list(emp_map.keys())
                else:
                    affected = [leave.user_id] if leave.user_id in emp_map else []

                for uid in affected:
                    emp = emp_map[uid]

                    # KEY FIX: For company-wide leaves, only credit the day
                    # if it's actually a working day for this specific employee.
                    # Individual leaves are always credited as-is (admin's intent).
                    if leave.applies_to_all and not is_working_day_for(cursor, emp):
                        cursor += timedelta(days=1)
                        continue

                    if leave.leave_type == LeaveTypeEnum.paid:
                        if cursor not in biometric_dates[uid]:
                            paid_leave_extra[uid] += 1
                            s_val     = emp.shift.value if emp.shift else None
                            shift_hrs = SHIFT_HOURS.get(s_val, 0)
                            paid_leave_hours[uid] += shift_hrs
                    else:
                        has_unpaid_leave[uid] = True

                cursor += timedelta(days=1)

    def count_working_days(wd_val, year, month, d_from=None, d_to=None):
        if not wd_val: return None
        curr  = d_from or date(year, month, 1)
        end   = d_to   or date(year, month, calendar.monthrange(year, month)[1])
        count = 0
        while curr <= end:
            wd = curr.weekday()
            if (wd_val == "mon_fri" and wd < 5) or (wd_val == "mon_sat" and wd < 6):
                count += 1
            curr += timedelta(days=1)
        return count

    rows = []
    for user_id, emp in emp_map.items():
        s_val  = emp.shift.value     if emp.shift     else None
        wd_val = emp.work_days.value if emp.work_days else None
        exp_d  = count_working_days(wd_val, year, month, date_from, date_to)
        exp_h  = round(exp_d * SHIFT_HOURS.get(s_val, 0), 2) if exp_d and s_val else None

        biometric_present = user_days[user_id]
        corrected_present = biometric_present + paid_leave_extra[user_id]

        raw_hours       = round(user_hours[user_id], 2)
        corrected_hours = round(raw_hours + paid_leave_hours[user_id], 2)

        rows.append({
            "user_id"         : user_id,
            "badge_number"    : emp.badge_number or "—",
            "name"            : emp.name,
            "position"        : emp.position or "—",
            "department"      : emp.department.name if emp.department else "Unassigned",
            "shift"           : s_val or "—",
            "days_present"    : corrected_present,
            "days_absent"     : (exp_d - corrected_present) if exp_d is not None else "—",
            "expected_days"   : exp_d  if exp_d  is not None else "—",
            "attendance_pct"  : round((corrected_present / exp_d) * 100, 1) if exp_d else None,
            "total_hours"     : corrected_hours,
            "expected_hours"  : exp_h  if exp_h  is not None else "—",
            "hours_pct"       : round((corrected_hours / exp_h) * 100, 1) if exp_h else None,
            "has_unpaid_leave": has_unpaid_leave[user_id],
        })

    return sorted(rows, key=lambda x: (x["department"], x["name"]))



# ── fetch_leave_rows (unchanged from your original) ──────────────────────────
def fetch_leave_rows(db, date_from, date_to, user_id=None, dept_id=None):
    q = db.query(Leave, Employee).join(
        Employee, Leave.user_id == Employee.user_id, isouter=True
    ).filter(
        Leave.date_to   >= date_from,
        Leave.date_from <= date_to,
    )
    if user_id:
        q = q.filter((Leave.user_id == user_id) | (Leave.applies_to_all == True))
    elif dept_id:
        q = q.filter(
            (Leave.applies_to_all == True) |
            (Employee.department_id == dept_id)
        )

    leaves = q.all()

    all_employees = []
    if not user_id and any(l.applies_to_all for l, _ in leaves):
        all_employees = db.query(Employee).all()
        if dept_id:
            all_employees = [e for e in all_employees if e.department_id == dept_id]

    single_emp = None
    if user_id:
        single_emp = db.query(Employee).filter(Employee.user_id == user_id).first()

    result = []
    for leave, emp in leaves:
        effective_from = max(leave.date_from, date_from)
        effective_to   = min(leave.date_to,   date_to)
        days = (effective_to - effective_from).days + 1

        if leave.applies_to_all:
            if user_id:
                if single_emp:
                    result.append({
                        "badge_number": single_emp.badge_number or "—",
                        "name"        : single_emp.name,
                        "leave_type"  : leave.leave_type.value,
                        "date_from"   : effective_from,
                        "date_to"     : effective_to,
                        "days"        : days,
                        "description" : leave.description or "",
                    })
            else:
                for e in all_employees:
                    result.append({
                        "badge_number": e.badge_number or "—",
                        "name"        : e.name,
                        "leave_type"  : leave.leave_type.value,
                        "date_from"   : effective_from,
                        "date_to"     : effective_to,
                        "days"        : days,
                        "description" : leave.description or "",
                    })
        elif emp:
            result.append({
                "badge_number": emp.badge_number or "—",
                "name"        : emp.name,
                "leave_type"  : leave.leave_type.value,
                "date_from"   : effective_from,
                "date_to"     : effective_to,
                "days"        : days,
                "description" : leave.description or "",
            })

    return sorted(result, key=lambda x: (x["leave_type"], x["name"]))


# ── Sheet writer
def write_summary_sheet(ws, rows, title, subtitle,
                        leave_rows=None, single_employee_leaves=None):
    col_count  = len(SUMMARY_COLS)
    data_start = 4
    data_end   = data_start + len(rows) - 1

    write_title_block(ws, title, subtitle, col_count)
    write_summary_header(ws, row=3)
    for i, r in enumerate(rows):
        write_summary_row(ws, data_start + i, r, alt=(i % 2 == 1))

    totals_row = data_end + 1
    write_totals_row(ws, totals_row, data_start, data_end, col_count)

    ws.freeze_panes         = "A4"
    ws.sheet_view.showGridLines = False

    # Single employee leave notes
    if single_employee_leaves:
        row = totals_row + 2
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_count)
        c = ws.cell(row=row, column=1, value="LEAVE NOTES")
        c.font      = Font(name="Arial", bold=True, color=WHITE, size=9)
        c.fill      = fill_of(NAVY)
        c.alignment = Alignment(horizontal="left", vertical="center", indent=2)
        ws.row_dimensions[row].height = 16
        row += 1

        for leave in single_employee_leaves:
            is_paid    = leave["leave_type"] == "paid"
            days       = leave["days"]
            desc       = leave["description"] or ""
            date_label = (str(leave["date_from"]) if leave["date_from"] == leave["date_to"]
                          else f"{leave['date_from']} → {leave['date_to']}")
            note = (
                f"Leave: {date_label}  ·  {days} day{'s' if days > 1 else ''}  ·  "
                f"{'Paid Leave (counted as present)' if is_paid else 'Unpaid Leave (counted as absent)'}"
                + (f"  ·  {desc}" if desc else "")
            )
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_count)
            c = ws.cell(row=row, column=1, value=note)
            c.font      = Font(name="Arial", size=9,
                               color=GREEN_FG if is_paid else RED_FG)
            c.fill      = fill_of(GREEN_BG if is_paid else RED_BG)
            c.border    = thin_border("CCCCCC")
            c.alignment = Alignment(horizontal="left", vertical="center", indent=2)
            ws.row_dimensions[row].height = 16
            row += 1

    elif leave_rows:
        write_leave_section(ws, leave_rows, totals_row + 1, col_count)


# ── Query helper
def base_query(db, date_from, date_to, dept_id=None, user_id=None):
    q = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(
        AttendanceLog.date >= date_from,
        AttendanceLog.date <= date_to,
    )
    if dept_id: q = q.filter(Employee.department_id == dept_id)
    if user_id: q = q.filter(AttendanceLog.user_id == user_id)
    return q


# ── Workbook builders — pass db into build_user_summary ──────────────────────
def build_workbook_monthly(db, year, month, dept_id=None, user_id=None):
    _, last = calendar.monthrange(year, month)
    d_from  = date(year, month, 1)
    d_to    = date(year, month, last)
    logs    = base_query(db, d_from, d_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")

    rows       = build_user_summary(logs, year, month, db=db)          # ← db passed
    leave_rows = fetch_leave_rows(db, d_from, d_to, user_id, dept_id)
    month_name = d_from.strftime("%B %Y")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Summary"
    write_summary_sheet(ws, rows,
        title                  = f"Attendance Summary — {month_name}",
        subtitle               = f"Generated {date.today()} · {len(rows)} employees",
        leave_rows             = leave_rows if not user_id else None,
        single_employee_leaves = leave_rows if user_id     else None,
    )

    if not user_id:
        dept_groups = defaultdict(list)
        for r in rows: dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            dept_leaves = [l for l in leave_rows
                           if any(e["name"] == l["name"] for e in dept_rows)]
            ws_d = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(ws_d, dept_rows,
                title      = f"{dept_name} — {month_name}",
                subtitle   = f"{len(dept_rows)} employees",
                leave_rows = dept_leaves,
            )
    return wb


def build_workbook_range(db, date_from, date_to, dept_id=None, user_id=None):
    logs = base_query(db, date_from, date_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")

    rows       = build_user_summary(logs, date_from.year, None,        # ← db passed
                                    date_from, date_to, db=db)
    leave_rows = fetch_leave_rows(db, date_from, date_to, user_id, dept_id)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Summary"
    write_summary_sheet(ws, rows,
        title                  = f"Attendance Summary — {date_from} to {date_to}",
        subtitle               = f"Generated {date.today()} · {len(rows)} employees",
        leave_rows             = leave_rows if not user_id else None,
        single_employee_leaves = leave_rows if user_id     else None,
    )

    if not user_id:
        dept_groups = defaultdict(list)
        for r in rows: dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            dept_leaves = [l for l in leave_rows
                           if any(e["name"] == l["name"] for e in dept_rows)]
            ws_d = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(ws_d, dept_rows,
                title      = f"{dept_name} — {date_from} to {date_to}",
                subtitle   = f"{len(dept_rows)} employees",
                leave_rows = dept_leaves,
            )
    return wb


def build_workbook_year(db, year, dept_id=None, user_id=None):
    wb    = openpyxl.Workbook()
    first = True

    for month in range(1, 13):
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)
        logs    = base_query(db, d_from, d_to, dept_id, user_id).all()
        if not logs: continue

        rows       = build_user_summary(logs, year, month, db=db)      # ← db passed
        leave_rows = fetch_leave_rows(db, d_from, d_to, user_id, dept_id)
        month_name = d_from.strftime("%B %Y")

        ws = wb.active if first else wb.create_sheet(title=month_name[:31])
        if first: ws.title = month_name[:31]; first = False

        write_summary_sheet(ws, rows,
            title      = f"Attendance Summary — {month_name}",
            subtitle   = f"{len(rows)} employees",
            leave_rows = leave_rows,
        )

    if not wb.sheetnames:
        raise HTTPException(status_code=404, detail="No data for year")
    return wb


# ── Endpoint (unchanged)
@router.get("/attendance")
def export_attendance(
    db            : Session        = Depends(get_db),
    date_from     : Optional[date] = Query(None),
    date_to       : Optional[date] = Query(None),
    month         : Optional[int]  = Query(None, ge=1, le=12),
    year          : Optional[int]  = Query(None, ge=2000),
    department_id : Optional[int]  = Query(None),
    user_id       : Optional[int]  = Query(None),
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
                detail="Provide date_from+date_to, month+year, or year"
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