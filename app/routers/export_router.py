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
except ImportError:
    raise RuntimeError("openpyxl is not installed. Run: pip install openpyxl")

router = APIRouter(
    prefix="/export",
    tags=["Export"],
    dependencies=[Depends(get_current_admin)]
)

# ── Palette ───────────────────────────────────────────────────────────────────
NAVY             = "1B2A4A"
DEPT_BLUE        = "1F4E79"   # department header fill
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
SAT_HOURS        = 6   # mon_sat workers do 8–2 on Saturdays

# ── Borders ───────────────────────────────────────────────────────────────────
def thin_border(color="CCCCCC"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def thick_border(color="1F4E79"):
    s = Side(style="medium", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

THIN   = thin_border()
MEDIUM = thin_border("AAAAAA")

# ── Fonts ─────────────────────────────────────────────────────────────────────
def hdr_font(size=10):                  return Font(name="Arial", bold=True, color=WHITE, size=size)
def body_font(size=9):                  return Font(name="Arial", size=size, color=DARK_GRAY)
def bold_font(size=9, color=DARK_GRAY): return Font(name="Arial", bold=True, size=size, color=color)
def title_font(size=14):                return Font(name="Arial", bold=True, color=WHITE, size=size)
def dept_font(size=11):                 return Font(name="Arial", bold=True, color=WHITE, size=size)
def sub_font(size=9):                   return Font(name="Arial", italic=True, color="888888", size=size)

def fill_of(hex_color):
    return PatternFill("solid", fgColor=hex_color)

# ── NEW column order ──────────────────────────────────────────────────────────
# S/N | Emp ID | Name | Position | Department | Shift
# Expected Days | Days Present | Days Absent | Attendance %
# Expected Hrs  | Total Hrs    | Absent Hrs  | Hrs % | Status

SUMMARY_COLS = [
    "S/N", "Employee ID", "Name", "Position", "Department", "Shift",
    "Expected Days", "Days Present", "Days Absent", "Attendance %",
    "Expected Hrs", "Total Hrs", "Absent Hrs", "Hrs %", "Status"
]
SUMMARY_WIDTHS = [5, 13, 28, 22, 20, 12, 14, 13, 12, 14, 13, 13, 13, 10, 12]

# Column indices (1-based)
COL_SN         = 1
COL_BADGE      = 2
COL_NAME       = 3
COL_POSITION   = 4
COL_DEPT       = 5
COL_SHIFT      = 6
COL_EXP_DAYS   = 7   # G
COL_PRESENT    = 8   # H
COL_ABSENT     = 9   # I  ← formula: =G-H
COL_ATT_PCT    = 10  # J  ← formula: =IF(G>0, H/G, "")
COL_EXP_HRS    = 11  # K
COL_HRS        = 12  # L
COL_ABS_HRS    = 13  # M  ← formula: =IF(K>0, MAX(K-L,0), "")
COL_HRS_PCT    = 14  # N  ← formula: =IF(K>0, L/K, "")
COL_STATUS     = 15  # O

# ── Cell helper ───────────────────────────────────────────────────────────────
def cell_write(ws, row, col, value, font=None, fill=None, border=None,
               number_format=None, alignment=None):
    c = ws.cell(row=row, column=col, value=value)
    c.alignment = alignment or Alignment(horizontal="center", vertical="center", wrap_text=True)
    if font:          c.font          = font
    if fill:          c.fill          = fill
    if border:        c.border        = border
    if number_format: c.number_format = number_format
    return c

# ── Global title block (for single-employee or single-dept exports) ───────────
def write_title_block(ws, title, subtitle, col_count):
    ws.row_dimensions[1].height = 32
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

# ── Department header block ───────────────────────────────────────────────────
def write_dept_header(ws, row, dept_name, date_from, date_to, col_count):
    """
    Writes a bold department section header spanning all columns.
    e.g.  IT Department Attendance Summary  (01 Jan 2026 – 24 Apr 2026)
    """
    label = (
        f"  {dept_name} — Attendance Summary"
        f"  ({date_from.strftime('%d %b %Y')} – {date_to.strftime('%d %b %Y')})"
    )
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_count)
    c = ws.cell(row=row, column=1, value=label)
    c.font      = dept_font(11)
    c.fill      = fill_of(DEPT_BLUE)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    c.border    = thick_border()
    ws.row_dimensions[row].height = 24
    return row + 1

# ── Column header row ─────────────────────────────────────────────────────────
def write_col_headers(ws, row, col_count):
    ws.row_dimensions[row].height = 22
    hdr_fill = fill_of(NAVY)
    for col, (label, width) in enumerate(zip(SUMMARY_COLS, SUMMARY_WIDTHS), 1):
        cell_write(ws, row, col, label, font=hdr_font(9), fill=hdr_fill, border=THIN)
        ws.column_dimensions[get_column_letter(col)].width = max(
            ws.column_dimensions[get_column_letter(col)].width or 0, width
        )
    return row + 1

# ── Data row ──────────────────────────────────────────────────────────────────
def write_data_row(ws, row_num, r, serial, alt=False):
    ws.row_dimensions[row_num].height = 18
    bg             = fill_of(PALE_BLUE if alt else WHITE)
    attendance_pct = r["attendance_pct"]

    if attendance_pct is None:
        s_label, s_fill, s_font = "No Data",  fill_of(MID_GRAY),  bold_font(9, DARK_GRAY)
    elif attendance_pct >= 90:
        s_label, s_fill, s_font = "Excellent", fill_of(GREEN_BG), bold_font(9, GREEN_FG)
    elif attendance_pct >= 75:
        s_label, s_fill, s_font = "Good",      fill_of(AMBER_BG), bold_font(9, AMBER_FG)
    else:
        s_label, s_fill, s_font = "Poor",      fill_of(RED_BG),   bold_font(9, RED_FG)

    static = {
        COL_SN      : serial,
        COL_BADGE   : r["badge_number"],
        COL_NAME    : r["name"],
        COL_POSITION: r["position"],
        COL_DEPT    : r["department"],
        COL_SHIFT   : r["shift"].title() if r["shift"] != "—" else "—",
        COL_EXP_DAYS: r["expected_days"] if isinstance(r["expected_days"], (int, float)) else None,
        COL_PRESENT : r["days_present"],
        COL_EXP_HRS : r["expected_hours"] if isinstance(r["expected_hours"], (int, float)) else None,
        COL_HRS     : r["total_hours"],
    }

    for col, val in static.items():
        fmt = "0.00" if col in (COL_EXP_HRS, COL_HRS) else None
        cell_write(ws, row_num, col, val,
                   font=body_font(), fill=bg, border=THIN, number_format=fmt)

    n  = row_num
    G  = get_column_letter(COL_EXP_DAYS)
    H  = get_column_letter(COL_PRESENT)
    K  = get_column_letter(COL_EXP_HRS)
    L  = get_column_letter(COL_HRS)

    # Days Absent = Expected Days - Days Present
    c = ws.cell(row=n, column=COL_ABSENT)
    c.value         = f'=IF({G}{n}<>"",{G}{n}-{H}{n},"—")'
    c.font, c.fill, c.border = body_font(), bg, THIN
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Attendance %
    c = ws.cell(row=n, column=COL_ATT_PCT)
    c.value         = f'=IF({G}{n}>0,{H}{n}/{G}{n},"")'
    c.font, c.fill, c.border = body_font(), bg, THIN
    c.number_format = "0.0%"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Absent Hours
    c = ws.cell(row=n, column=COL_ABS_HRS)
    c.value         = f'=IF({K}{n}>0,MAX({K}{n}-{L}{n},0),"—")'
    c.font          = body_font()
    c.fill          = fill_of("FFF3E0") if r.get("has_unpaid_leave") else bg
    c.border        = THIN
    c.number_format = "0.00"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Hours %
    c = ws.cell(row=n, column=COL_HRS_PCT)
    c.value         = f'=IF({K}{n}>0,{L}{n}/{K}{n},"")'
    c.font, c.fill, c.border = body_font(), bg, THIN
    c.number_format = "0.0%"
    c.alignment     = Alignment(horizontal="center", vertical="center")

    # Status
    cell_write(ws, row_num, COL_STATUS, s_label, font=s_font, fill=s_fill, border=THIN)

# ── Subtotals row (per department) ────────────────────────────────────────────
def write_subtotals_row(ws, row_num, data_start, data_end, col_count, label="SUBTOTAL"):
    ws.row_dimensions[row_num].height = 18
    tot_fill = fill_of(LIGHT_BLUE)

    for col in range(1, col_count + 1):
        c = ws.cell(row=row_num, column=col)
        c.fill      = tot_fill
        c.border    = MEDIUM
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.alignment = Alignment(horizontal="center", vertical="center")

    ws.cell(row=row_num, column=1).value     = label
    ws.cell(row=row_num, column=1).alignment = Alignment(
        horizontal="left", vertical="center", indent=1
    )
    ws.merge_cells(
        start_row=row_num, start_column=1,
        end_row=row_num,   end_column=COL_SHIFT
    )

    n  = row_num
    G  = get_column_letter(COL_EXP_DAYS)
    H  = get_column_letter(COL_PRESENT)
    I  = get_column_letter(COL_ABSENT)
    J  = get_column_letter(COL_ATT_PCT)
    K  = get_column_letter(COL_EXP_HRS)
    L  = get_column_letter(COL_HRS)
    M  = get_column_letter(COL_ABS_HRS)
    N  = get_column_letter(COL_HRS_PCT)

    ws.cell(row=n, column=COL_EXP_DAYS).value = f"=SUM({G}{data_start}:{G}{data_end})"
    ws.cell(row=n, column=COL_PRESENT).value  = f"=SUM({H}{data_start}:{H}{data_end})"
    ws.cell(row=n, column=COL_ABSENT).value   = f"=SUM({I}{data_start}:{I}{data_end})"
    ws.cell(row=n, column=COL_EXP_HRS).value  = f"=SUM({K}{data_start}:{K}{data_end})"
    ws.cell(row=n, column=COL_HRS).value      = f"=SUM({L}{data_start}:{L}{data_end})"

    c = ws.cell(row=n, column=COL_ABS_HRS)
    c.value, c.number_format = f"=SUM({M}{data_start}:{M}{data_end})", "0.00"

    c = ws.cell(row=n, column=COL_ATT_PCT)
    c.value         = f"=IFERROR(AVERAGE({J}{data_start}:{J}{data_end}),\"\")"
    c.number_format = "0.0%"

    c = ws.cell(row=n, column=COL_HRS_PCT)
    c.value         = f'=IF(SUM({K}{data_start}:{K}{data_end})>0,SUM({L}{data_start}:{L}{data_end})/SUM({K}{data_start}:{K}{data_end}),"—")'
    c.number_format = "0.0%"

    for col in [COL_EXP_DAYS, COL_PRESENT, COL_ABSENT, COL_ATT_PCT,
                COL_EXP_HRS, COL_HRS, COL_ABS_HRS, COL_HRS_PCT]:
        c = ws.cell(row=n, column=col)
        c.fill, c.border = tot_fill, MEDIUM
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.alignment = Alignment(horizontal="center", vertical="center")
        if col in (COL_EXP_HRS, COL_HRS, COL_ABS_HRS):
            c.number_format = "0.00"

# ── Grand totals row ──────────────────────────────────────────────────────────
def write_grand_totals_row(ws, row_num, subtotal_rows, col_count):
    """Sums across all department subtotal rows for the grand total."""
    ws.row_dimensions[row_num].height = 22
    tot_fill = fill_of(NAVY)

    for col in range(1, col_count + 1):
        c = ws.cell(row=row_num, column=col)
        c.fill      = tot_fill
        c.border    = thick_border()
        c.font      = bold_font(10, WHITE)
        c.alignment = Alignment(horizontal="center", vertical="center")

    ws.cell(row=row_num, column=1).value     = "GRAND TOTAL"
    ws.cell(row=row_num, column=1).alignment = Alignment(
        horizontal="left", vertical="center", indent=1
    )
    ws.merge_cells(
        start_row=row_num, start_column=1,
        end_row=row_num,   end_column=COL_SHIFT
    )

    def sum_of_rows(col_letter):
        refs = "+".join(f"{col_letter}{r}" for r in subtotal_rows)
        return f"={refs}"

    n = row_num
    G = get_column_letter(COL_EXP_DAYS)
    H = get_column_letter(COL_PRESENT)
    I = get_column_letter(COL_ABSENT)
    J = get_column_letter(COL_ATT_PCT)
    K = get_column_letter(COL_EXP_HRS)
    L = get_column_letter(COL_HRS)
    M = get_column_letter(COL_ABS_HRS)
    N_col = get_column_letter(COL_HRS_PCT)

    ws.cell(row=n, column=COL_EXP_DAYS).value = sum_of_rows(G)
    ws.cell(row=n, column=COL_PRESENT).value  = sum_of_rows(H)
    ws.cell(row=n, column=COL_ABSENT).value   = sum_of_rows(I)
    ws.cell(row=n, column=COL_EXP_HRS).value  = sum_of_rows(K)
    ws.cell(row=n, column=COL_HRS).value      = sum_of_rows(L)

    c = ws.cell(row=n, column=COL_ABS_HRS)
    c.value, c.number_format = sum_of_rows(M), "0.00"

    att_refs = "+".join(f"{J}{r}" for r in subtotal_rows)
    c = ws.cell(row=n, column=COL_ATT_PCT)
    c.value         = f"=IFERROR(({att_refs})/{len(subtotal_rows)},\"\")"
    c.number_format = "0.0%"

    c = ws.cell(row=n, column=COL_HRS_PCT)
    k_sum = "+".join(f"{K}{r}" for r in subtotal_rows)
    l_sum = "+".join(f"{L}{r}" for r in subtotal_rows)
    c.value         = f'=IF(({k_sum})>0,({l_sum})/({k_sum}),"—")'
    c.number_format = "0.0%"

    for col in [COL_EXP_DAYS, COL_PRESENT, COL_ABSENT, COL_ATT_PCT,
                COL_EXP_HRS, COL_HRS, COL_ABS_HRS, COL_HRS_PCT]:
        c = ws.cell(row=n, column=col)
        c.fill, c.border = tot_fill, thick_border()
        c.font      = bold_font(10, WHITE)
        c.alignment = Alignment(horizontal="center", vertical="center")
        if col in (COL_EXP_HRS, COL_HRS, COL_ABS_HRS):
            c.number_format = "0.00"

# ── Leave section ─────────────────────────────────────────────────────────────
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
            ws.column_dimensions[get_column_letter(col)].width or 0, width
        )
    ws.row_dimensions[row].height = 18
    row += 1

    paid_rows   = [r for r in leave_rows if r["leave_type"] == "paid"]
    unpaid_rows = [r for r in leave_rows if r["leave_type"] == "unpaid"]

    def write_leave_group(rows, leave_type):
        nonlocal row
        if not rows: return
        label     = "Paid Leave" if leave_type == "paid" else "Unpaid Leave"
        hdr_color = LEAVE_HDR if leave_type == "paid" else LEAVE_UNPAID_HDR
        bg_color  = LEAVE_PAID if leave_type == "paid" else LEAVE_UNPAID

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(leave_cols))
        c = ws.cell(row=row, column=1,
                    value=f"  {label} ({len(rows)} record{'s' if len(rows)>1 else ''})")
        c.font      = Font(name="Arial", bold=True, color=WHITE, size=9)
        c.fill      = fill_of(hdr_color)
        c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[row].height = 16
        row += 1

        for r in rows:
            vals = [r["badge_number"], r["name"], label,
                    r["date_from"], r["date_to"], r["days"], r["description"] or "—"]
            for col, val in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.font      = body_font()
                c.fill      = fill_of(bg_color)
                c.border    = THIN
                c.alignment = Alignment(
                    horizontal="center" if col != 7 else "left", vertical="center"
                )
                if col in (4, 5): c.number_format = "DD-MMM-YYYY"
            ws.row_dimensions[row].height = 16
            row += 1

        total_days = sum(r["days"] for r in rows)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        c = ws.cell(row=row, column=1, value=f"Total {label} Days")
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.fill      = fill_of(LIGHT_BLUE)
        c.border    = MEDIUM
        c.alignment = Alignment(horizontal="right", vertical="center", indent=1)
        c = ws.cell(row=row, column=6, value=total_days)
        c.font      = bold_font(9, SUMMARY_BOLD)
        c.fill      = fill_of(LIGHT_BLUE)
        c.border    = MEDIUM
        c.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[row].height = 16
        row += 1

    write_leave_group(paid_rows,   "paid")
    write_leave_group(unpaid_rows, "unpaid")
    return row

# ── Helpers ───────────────────────────────────────────────────────────────────
SHIFT_HOURS = {"morning": 8, "afternoon": 8, "night": 12, "day": 10}

def is_working_day_for(d: date, emp: Employee) -> bool:
    weekday = d.weekday()
    if weekday == 6: return False
    if weekday == 5:
        wd_val = emp.work_days.value if emp.work_days else "mon_fri"
        return wd_val == "mon_sat"
    return True

def get_day_hours(d: date, emp: Employee) -> float:
    if d.weekday() == 5: return SAT_HOURS
    return SHIFT_HOURS.get(emp.shift.value if emp.shift else None, 0)

def count_working_days_and_hours(emp: Employee, d_from: date, d_to: date):
    wd_val = emp.work_days.value if emp.work_days else None
    if not wd_val: return None, None
    days, hours, curr = 0, 0.0, d_from
    while curr <= d_to:
        wd = curr.weekday()
        if wd == 6:
            pass
        elif wd == 5:
            if wd_val == "mon_sat":
                days += 1; hours += SAT_HOURS
        else:
            days += 1
            hours += SHIFT_HOURS.get(emp.shift.value if emp.shift else None, 0)
        curr += timedelta(days=1)
    return days, round(hours, 2)

# ── Core data builder ─────────────────────────────────────────────────────────
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
            user_hours[user_id] += round((max(outs) - min(ins)).total_seconds() / 3600, 2)
        user_days[user_id] += 1

    d_from = date_from or date(year, month, 1)
    d_to   = date_to   or date(year, month, calendar.monthrange(year, month)[1])

    biometric_dates: dict[int, set] = defaultdict(set)
    for (user_id, day), _ in grouped.items():
        biometric_dates[user_id].add(day)

    paid_leave_extra: dict[int, int]   = defaultdict(int)
    paid_leave_hours: dict[int, float] = defaultdict(float)
    has_unpaid_leave: dict[int, bool]  = defaultdict(bool)

    if db is not None:
        leave_q = db.query(Leave).filter(
            Leave.date_to >= d_from, Leave.date_from <= d_to
        ).all()

        for leave in leave_q:
            eff_from = max(leave.date_from, d_from)
            eff_to   = min(leave.date_to,   d_to)
            cursor   = eff_from
            while cursor <= eff_to:
                affected = list(emp_map.keys()) if leave.applies_to_all else (
                    [leave.user_id] if leave.user_id in emp_map else []
                )
                for uid in affected:
                    emp = emp_map[uid]
                    if leave.applies_to_all and not is_working_day_for(cursor, emp):
                        pass
                    elif leave.leave_type == LeaveTypeEnum.paid:
                        if cursor not in biometric_dates[uid]:
                            paid_leave_extra[uid] += 1
                            paid_leave_hours[uid] += get_day_hours(cursor, emp)
                    else:
                        has_unpaid_leave[uid] = True
                cursor += timedelta(days=1)

    rows = []
    for user_id, emp in emp_map.items():
        s_val             = emp.shift.value     if emp.shift     else None
        exp_d, exp_h      = count_working_days_and_hours(emp, d_from, d_to)
        biometric_present = user_days[user_id]
        corrected_present = biometric_present + paid_leave_extra[user_id]
        corrected_hours   = round(user_hours[user_id] + paid_leave_hours[user_id], 2)

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

# ── fetch_leave_rows ──────────────────────────────────────────────────────────
def fetch_leave_rows(db, date_from, date_to, user_id=None, dept_id=None):
    q = db.query(Leave, Employee).join(
        Employee, Leave.user_id == Employee.user_id, isouter=True
    ).filter(Leave.date_to >= date_from, Leave.date_from <= date_to)

    if user_id:
        q = q.filter((Leave.user_id == user_id) | (Leave.applies_to_all == True))
    elif dept_id:
        q = q.filter(
            (Leave.applies_to_all == True) | (Employee.department_id == dept_id)
        )

    leaves        = q.all()
    all_employees = []
    if not user_id and any(l.applies_to_all for l, _ in leaves):
        all_employees = db.query(Employee).all()
        if dept_id:
            all_employees = [e for e in all_employees if e.department_id == dept_id]

    single_emp = None
    if user_id:
        single_emp = db.query(Employee).filter(Employee.user_id == user_id).first()

    def count_effective_days(leave, eff_from, eff_to, emp):
        if not leave.applies_to_all:
            return (eff_to - eff_from).days + 1
        wd_val = emp.work_days.value if emp.work_days else "mon_fri"
        count, cursor = 0, eff_from
        while cursor <= eff_to:
            wd = cursor.weekday()
            if wd != 6 and (wd != 5 or wd_val == "mon_sat"):
                count += 1
            cursor += timedelta(days=1)
        return count

    result = []
    for leave, emp in leaves:
        eff_from = max(leave.date_from, date_from)
        eff_to   = min(leave.date_to,   date_to)

        if leave.applies_to_all:
            targets = [single_emp] if user_id and single_emp else all_employees
            for e in targets:
                days = count_effective_days(leave, eff_from, eff_to, e)
                if days > 0:
                    result.append({
                        "badge_number": e.badge_number or "—", "name": e.name,
                        "leave_type": leave.leave_type.value,
                        "date_from": eff_from, "date_to": eff_to,
                        "days": days, "description": leave.description or "",
                    })
        elif emp:
            days = count_effective_days(leave, eff_from, eff_to, emp)
            if days > 0:
                result.append({
                    "badge_number": emp.badge_number or "—", "name": emp.name,
                    "leave_type": leave.leave_type.value,
                    "date_from": eff_from, "date_to": eff_to,
                    "days": days, "description": leave.description or "",
                })

    return sorted(result, key=lambda x: (x["leave_type"], x["name"]))

# ── All-departments sheet writer ──────────────────────────────────────────────
def write_all_depts_sheet(ws, all_rows, date_from, date_to, leave_rows=None):
    """
    Single sheet with all departments stacked.
    Each dept gets: 2 blank spacer rows → dept header → col headers → data rows → subtotal row
    Ends with a grand total row across all dept subtotals.
    """
    col_count = len(SUMMARY_COLS)

    # Set column widths once
    for col, width in enumerate(SUMMARY_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(col)].width = width

    ws.sheet_view.showGridLines = False

    # ── Report title (rows 1–2)
    period = f"{date_from.strftime('%d %b %Y')} – {date_to.strftime('%d %b %Y')}"
    write_title_block(ws,
        title    = f"Attendance Report  ·  All Departments  ·  {period}",
        subtitle = f"Generated {date.today()}  ·  {len(all_rows)} employees across all departments",
        col_count= col_count
    )

    current_row    = 3   # start writing from row 3
    subtotal_rows  = []  # track subtotal row numbers for grand total
    dept_groups    = defaultdict(list)
    for r in all_rows:
        dept_groups[r["department"]].append(r)

    for dept_name in sorted(dept_groups.keys()):
        dept_rows = dept_groups[dept_name]

        # ── 2 blank spacer rows (skip for very first dept — title block is above)
        if subtotal_rows:
            current_row += 2

        # ── Department header
        current_row = write_dept_header(ws, current_row, dept_name, date_from, date_to, col_count)

        # ── Column headers
        current_row = write_col_headers(ws, current_row, col_count)

        # ── Data rows
        data_start = current_row
        for i, r in enumerate(dept_rows):
            write_data_row(ws, current_row, r, serial=i + 1, alt=(i % 2 == 1))
            current_row += 1
        data_end = current_row - 1

        # ── Subtotal row
        write_subtotals_row(ws, current_row, data_start, data_end, col_count,
                            label=f"  {dept_name} — Subtotal")
        subtotal_rows.append(current_row)
        current_row += 1

    # ── Grand total
    current_row += 1
    write_grand_totals_row(ws, current_row, subtotal_rows, col_count)
    current_row += 1

    # ── Leave section (optional)
    if leave_rows:
        write_leave_section(ws, leave_rows, current_row + 1, col_count)

    ws.freeze_panes = "A3"

# ── Single-dept / single-employee sheet writer ────────────────────────────────
def write_summary_sheet(ws, rows, title, subtitle, date_from, date_to,
                        leave_rows=None, single_employee_leaves=None):
    col_count  = len(SUMMARY_COLS)
    data_start = 4
    data_end   = data_start + len(rows) - 1

    for col, width in enumerate(SUMMARY_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(col)].width = width

    write_title_block(ws, title, subtitle, col_count)
    write_col_headers(ws, row=3, col_count=col_count)

    for i, r in enumerate(rows):
        write_data_row(ws, data_start + i, r, serial=i + 1, alt=(i % 2 == 1))

    totals_row = data_end + 1
    write_subtotals_row(ws, totals_row, data_start, data_end, col_count, label="TOTALS / AVERAGES")

    ws.freeze_panes             = "A4"
    ws.sheet_view.showGridLines = False

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
            c.font      = Font(name="Arial", size=9, color=GREEN_FG if is_paid else RED_FG)
            c.fill      = fill_of(GREEN_BG if is_paid else RED_BG)
            c.border    = thin_border("CCCCCC")
            c.alignment = Alignment(horizontal="left", vertical="center", indent=2)
            ws.row_dimensions[row].height = 16
            row += 1
    elif leave_rows:
        write_leave_section(ws, leave_rows, totals_row + 1, col_count)

# ── Query helper ──────────────────────────────────────────────────────────────
def base_query(db, date_from, date_to, dept_id=None, user_id=None):
    q = db.query(AttendanceLog, Employee).join(
        Employee, AttendanceLog.user_id == Employee.user_id
    ).filter(AttendanceLog.date >= date_from, AttendanceLog.date <= date_to)
    if dept_id: q = q.filter(Employee.department_id == dept_id)
    if user_id: q = q.filter(AttendanceLog.user_id == user_id)
    return q

# ── Workbook builders ─────────────────────────────────────────────────────────
def build_workbook_monthly(db, year, month, dept_id=None, user_id=None):
    _, last    = calendar.monthrange(year, month)
    d_from     = date(year, month, 1)
    d_to       = date(year, month, last)
    logs       = base_query(db, d_from, d_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")

    rows       = build_user_summary(logs, year, month, db=db)
    leave_rows = fetch_leave_rows(db, d_from, d_to, user_id, dept_id)
    month_name = d_from.strftime("%B %Y")
    period     = f"{d_from.strftime('%d %b %Y')} – {d_to.strftime('%d %b %Y')}"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "All Departments" if not user_id else "Summary"

    if user_id:
        write_summary_sheet(ws, rows,
            title                  = f"Attendance — {rows[0]['name']} — {month_name}",
            subtitle               = f"Generated {date.today()}",
            date_from              = d_from, date_to = d_to,
            single_employee_leaves = leave_rows,
        )
    elif dept_id:
        write_summary_sheet(ws, rows,
            title      = f"Attendance Summary — {month_name}",
            subtitle   = f"Generated {date.today()} · {len(rows)} employees",
            date_from  = d_from, date_to = d_to,
            leave_rows = leave_rows,
        )
    else:
        # All departments — single stacked sheet + per-dept tabs
        write_all_depts_sheet(ws, rows, d_from, d_to, leave_rows)
        dept_groups = defaultdict(list)
        for r in rows: dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            dept_leaves = [l for l in leave_rows if any(e["name"] == l["name"] for e in dept_rows)]
            ws_d = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(ws_d, dept_rows,
                title      = f"{dept_name} — {month_name}",
                subtitle   = f"{len(dept_rows)} employees · {period}",
                date_from  = d_from, date_to = d_to,
                leave_rows = dept_leaves,
            )
    return wb


def build_workbook_range(db, date_from, date_to, dept_id=None, user_id=None):
    logs = base_query(db, date_from, date_to, dept_id, user_id).all()
    if not logs: raise HTTPException(status_code=404, detail="No data")

    rows       = build_user_summary(logs, date_from.year, None, date_from, date_to, db=db)
    leave_rows = fetch_leave_rows(db, date_from, date_to, user_id, dept_id)
    period     = f"{date_from.strftime('%d %b %Y')} – {date_to.strftime('%d %b %Y')}"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "All Departments" if not user_id else "Summary"

    if user_id:
        write_summary_sheet(ws, rows,
            title                  = f"Attendance — {rows[0]['name']} — {period}",
            subtitle               = f"Generated {date.today()}",
            date_from              = date_from, date_to = date_to,
            single_employee_leaves = leave_rows,
        )
    elif dept_id:
        write_summary_sheet(ws, rows,
            title      = f"Attendance Summary — {period}",
            subtitle   = f"Generated {date.today()} · {len(rows)} employees",
            date_from  = date_from, date_to = date_to,
            leave_rows = leave_rows,
        )
    else:
        write_all_depts_sheet(ws, rows, date_from, date_to, leave_rows)
        dept_groups = defaultdict(list)
        for r in rows: dept_groups[r["department"]].append(r)
        for dept_name, dept_rows in sorted(dept_groups.items()):
            dept_leaves = [l for l in leave_rows if any(e["name"] == l["name"] for e in dept_rows)]
            ws_d = wb.create_sheet(title=dept_name[:31])
            write_summary_sheet(ws_d, dept_rows,
                title      = f"{dept_name} — {period}",
                subtitle   = f"{len(dept_rows)} employees",
                date_from  = date_from, date_to = date_to,
                leave_rows = dept_leaves,
            )
    return wb


def build_workbook_year(db, year, dept_id=None, user_id=None):
    wb, first = openpyxl.Workbook(), True
    for month in range(1, 13):
        _, last = calendar.monthrange(year, month)
        d_from  = date(year, month, 1)
        d_to    = date(year, month, last)
        logs    = base_query(db, d_from, d_to, dept_id, user_id).all()
        if not logs: continue

        rows       = build_user_summary(logs, year, month, db=db)
        leave_rows = fetch_leave_rows(db, d_from, d_to, user_id, dept_id)
        month_name = d_from.strftime("%B %Y")

        ws = wb.active if first else wb.create_sheet(title=month_name[:31])
        if first: ws.title = month_name[:31]; first = False

        if not dept_id and not user_id:
            write_all_depts_sheet(ws, rows, d_from, d_to, leave_rows)
        else:
            write_summary_sheet(ws, rows,
                title      = f"Attendance Summary — {month_name}",
                subtitle   = f"{len(rows)} employees",
                date_from  = d_from, date_to = d_to,
                leave_rows = leave_rows,
            )

    if not wb.sheetnames:
        raise HTTPException(status_code=404, detail="No data for year")
    return wb


# ── Endpoint ──────────────────────────────────────────────────────────────────
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