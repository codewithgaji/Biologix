import { useEffect, useState, useMemo } from "react";
import { getAttendanceSummary, getDepartments, exportAttendance } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search, Filter, X, ChevronLeft, ChevronRight,
  Download, Calendar, Clock, CheckCircle2, XCircle,
  TrendingUp, User, CalendarDays
} from "lucide-react";

// ─── helpers 

function today() {
  return new Date().toISOString().split("T")[0];
}

function startOf(monthsBack: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().split("T")[0];
}

function endOfLastMonth() {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().split("T")[0];
}

const DATE_PRESETS = [
  { label: "This Month", from: () => startOf(0),  to: () => today()          },
  { label: "Last Month", from: () => startOf(1),  to: () => endOfLastMonth() },
  { label: "3 Months",   from: () => startOf(3),  to: () => today()          },
  { label: "6 Months",   from: () => startOf(6),  to: () => today()          },
];

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  ts = ts.replace(/"/g, "");
  const timePart = ts.includes("T") ? ts.split("T")[1] : ts.split(" ")[1];
  if (!timePart) return "—";
  const [hourStr, minuteStr] = timePart.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteStr} ${ampm}`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function safeFilename(name: string, badge: string | number) {
  return `${name.replace(/\s+/g, "_")}_#${badge}`;
}

// ─── leave fetch 

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://biologixbackend.onrender.com'


//"http://localhost:8000";



function getToken() { return localStorage.getItem("biologix_token"); }

interface LeaveDate {
  date        : string;
  leave_type  : "paid" | "unpaid";
  description : string | null;
}

async function fetchLeaveDates(
  userId  : string | number,
  dateFrom: string,
  dateTo  : string
): Promise<LeaveDate[]> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/leaves/dates/${userId}?date_from=${dateFrom}&date_to=${dateTo}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) return [];
  return res.json();
}

// ─── types ────────────────────────────────────────────────────────────────────

interface AttendanceRow {
  user_id        : string | number;
  badge_number   : string | number;
  employee_name  : string;
  department_name: string;
  date           : string;
  clock_in       : string | null;
  clock_out      : string | null;
  hours_worked   : number | null;
  status         : string;
}

interface EmployeeGroup {
  user_id        : string | number;
  badge_number   : string | number;
  employee_name  : string;
  department_name: string;
  records        : AttendanceRow[];
  days_present   : number;
  total_hours    : number;
  last_seen      : string;
}

// ─── employee card ─────────────────────────────────────────────────────────────

function EmployeeCard({ emp, onClick }: { emp: EmployeeGroup; onClick: () => void }) {
  const attendanceRate = emp.records.length > 0
    ? Math.round((emp.days_present / emp.records.length) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left glass-card rounded-xl p-4 hover:bg-secondary/40 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{emp.employee_name || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{emp.department_name || "—"}</p>
          </div>
        </div>
        <span className="font-mono text-xs bg-secondary px-2 py-1 rounded-md text-muted-foreground shrink-0">
          #{emp.badge_number}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="bg-secondary/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">Days Present</p>
          <p className="font-bold text-sm text-foreground">{emp.days_present}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total Hours</p>
          <p className="font-bold text-sm text-foreground">{emp.total_hours.toFixed(1)}h</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">Attendance</p>
          <p className={`font-bold text-sm ${attendanceRate >= 80 ? "text-green-500" : attendanceRate >= 60 ? "text-yellow-500" : "text-red-500"}`}>
            {attendanceRate}%
          </p>
        </div>
      </div>

      <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${attendanceRate >= 80 ? "bg-green-500" : attendanceRate >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
          style={{ width: `${attendanceRate}%` }}
        />
      </div>
    </button>
  );
}

// ─── employee detail modal ────────────────────────────────────────────────────

function EmployeeModal({
  emp, onClose, dateFrom, dateTo,
}: {
  emp: EmployeeGroup; onClose: () => void; dateFrom: string; dateTo: string;
}) {
  const [exporting, setExporting]       = useState(false);
  const [leaveDates, setLeaveDates]     = useState<LeaveDate[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);

  // Fetch leave dates for this employee when modal opens
  useEffect(() => {
    setLeavesLoading(true);
    fetchLeaveDates(emp.user_id, dateFrom, dateTo)
      .then(setLeaveDates)
      .catch(() => setLeaveDates([]))
      .finally(() => setLeavesLoading(false));
  }, [emp.user_id, dateFrom, dateTo]);

  // Build a map of date → leave info for quick lookup
  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveDate>();
    leaveDates.forEach((l) => map.set(l.date, l));
    return map;
  }, [leaveDates]);

  // Merge attendance records with leave dates
  // Leave dates that have no attendance record are inserted as leave-only rows
  const allDates = useMemo(() => {
    const dateSet = new Map<string, { record?: AttendanceRow; leave?: LeaveDate }>();

    // Add all attendance records
    emp.records.forEach((r) => {
      dateSet.set(r.date, { record: r, leave: leaveMap.get(r.date) });
    });

    // Add leave dates that have no attendance record
    leaveDates.forEach((l) => {
      if (!dateSet.has(l.date)) {
        dateSet.set(l.date, { leave: l });
      }
    });

    // Sort descending by date
    return Array.from(dateSet.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([, v]) => v);
  }, [emp.records, leaveMap, leaveDates]);

  const daysPresent   = emp.records.filter((r) => r.status === "present").length;
  const daysAbsent    = emp.records.filter((r) => r.status === "absent").length;
  const avgHours      = daysPresent > 0 ? emp.total_hours / daysPresent : 0;
  const paidLeaveCount   = leaveDates.filter((l) => l.leave_type === "paid").length;
  const unpaidLeaveCount = leaveDates.filter((l) => l.leave_type === "unpaid").length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const filename = `${safeFilename(emp.employee_name, emp.badge_number)}_${dateFrom}_${dateTo}.xlsx`;
      await exportAttendance(
        { date_from: dateFrom, date_to: dateTo, user_id: emp.user_id },
        filename
      );
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{emp.employee_name}</h2>
              <p className="text-xs text-muted-foreground">
                Employee ID #{emp.badge_number} · {emp.department_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{daysPresent}</p>
            <p className="text-[10px] text-muted-foreground">Days Present</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{daysAbsent}</p>
            <p className="text-[10px] text-muted-foreground">Days Absent</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{emp.total_hours.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">Total Hours</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3 text-center">
            <TrendingUp className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{avgHours.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">Avg / Day</p>
          </div>
        </div>

        {/* Leave summary bar — only show if there are leaves */}
        {!leavesLoading && leaveDates.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border shrink-0 bg-secondary/20 flex-wrap">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Leaves in period:</span>
            {paidLeaveCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">
                {paidLeaveCount} paid day{paidLeaveCount > 1 ? "s" : ""}
              </span>
            )}
            {unpaidLeaveCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500">
                {unpaidLeaveCount} unpaid day{unpaidLeaveCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Records list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {leavesLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading records...</div>
          ) : allDates.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">No records found.</div>
          ) : (
            allDates.map(({ record, leave }, i) => {
              const isPaidLeave   = leave?.leave_type === "paid";
              const isUnpaidLeave = leave?.leave_type === "unpaid";
              const isLeaveOnly   = !record && !!leave; // leave day with no clock in/out record
              const dateStr       = record?.date || leave?.date || "";
              const isPresent     = record?.status === "present";

              // Determine row styling
              let rowClass = "bg-secondary/40"; // present
              if (isPaidLeave && !isPresent) rowClass = "bg-green-500/8 border border-green-500/20";
              else if (isUnpaidLeave) rowClass = "bg-orange-500/8 border border-orange-500/20";
              else if (!isPresent && !leave) rowClass = "bg-destructive/5 border border-destructive/15";

              return (
                <div
                  key={i}
                  className={`rounded-xl p-3 flex items-center justify-between gap-3 ${rowClass}`}
                >
                  {/* Date */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className={`h-3.5 w-3.5 shrink-0 ${
                      isPaidLeave ? "text-green-500" :
                      isUnpaidLeave ? "text-orange-500" :
                      isPresent ? "text-primary" : "text-destructive/50"
                    }`} />
                    <span className="text-xs font-medium text-foreground truncate">
                      {formatShortDate(dateStr)}
                    </span>
                  </div>

                  {/* Middle — clock times OR leave tag */}
                  <div className="flex items-center gap-2 text-xs shrink-0 flex-1 justify-center">
                    {leave ? (
                      // Show leave tag instead of clock times
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isPaidLeave
                            ? "bg-green-500/20 text-green-500"
                            : "bg-orange-500/20 text-orange-500"
                        }`}>
                          {isPaidLeave ? "Paid Leave" : "Unpaid Leave"}
                        </span>
                        {leave.description && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                            {leave.description}
                          </span>
                        )}
                      </div>
                    ) : (
                      // Normal clock in/out
                      <>
                        <span className="text-green-600 dark:text-green-400 font-mono">
                          {formatTime(record?.clock_in ?? null)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-orange-500 font-mono">
                          {formatTime(record?.clock_out ?? null)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Right — hours + status dot */}
                  <div className="flex items-center gap-2 shrink-0">
                    {record?.hours_worked != null && (
                      <span className="text-xs text-muted-foreground">{record.hours_worked}h</span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${
                      isPaidLeave ? "bg-green-500" :
                      isUnpaidLeave ? "bg-orange-500" :
                      isPresent ? "bg-green-500" : "bg-red-500"
                    }`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Export footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <Button onClick={handleExport} disabled={exporting} className="w-full gap-2">
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : `Export ${emp.employee_name} (#${emp.badge_number})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;

export default function Attendance() {
  const [data, setData]               = useState<AttendanceRow[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch]           = useState("");
  const [deptFilter, setDeptFilter]   = useState("");
  const [dateFrom, setDateFrom]       = useState(startOf(3));
  const [dateTo, setDateTo]           = useState(today());
  const [activePreset, setActivePreset] = useState("3 Months");
  const [page, setPage]               = useState(0);
  const [loading, setLoading]         = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected]       = useState<EmployeeGroup | null>(null);

  const load = (from = dateFrom, to = dateTo, dept = deptFilter) => {
    setLoading(true);
    const params: Record<string, string> = { date_from: from, date_to: to };
    if (dept) params.department_id = dept;

    Promise.all([getAttendanceSummary(params), getDepartments().catch(() => [])])
      .then(([att, depts]) => {
        setData(Array.isArray(att) ? att : []);
        setDepartments(Array.isArray(depts) ? depts : []);
        setPage(0);
      })
      .catch(() => toast.error("Failed to load attendance"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const applyPreset = (preset: typeof DATE_PRESETS[0]) => {
    const from = preset.from();
    const to   = preset.to();
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset.label);
    setFiltersOpen(false);
    load(from, to);
  };

  const applyCustom = () => {
    setActivePreset("");
    load(dateFrom, dateTo);
    setFiltersOpen(false);
  };

  const employeeGroups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();
    for (const row of data) {
      const key = String(row.user_id);
      if (!map.has(key)) {
        map.set(key, {
          user_id        : row.user_id,
          badge_number   : row.badge_number,
          employee_name  : row.employee_name,
          department_name: row.department_name,
          records        : [],
          days_present   : 0,
          total_hours    : 0,
          last_seen      : row.date,
        });
      }
      const grp = map.get(key)!;
      grp.records.push(row);
      if (row.status === "present") grp.days_present++;
      if (row.hours_worked) grp.total_hours += row.hours_worked;
      if (row.date > grp.last_seen) grp.last_seen = row.date;
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.badge_number).localeCompare(String(b.badge_number), undefined, { numeric: true })
    );
  }, [data]);

  const filtered = useMemo(() =>
    employeeGroups.filter((emp) => {
      const q = search.toLowerCase();
      return !q || (emp.employee_name || "").toLowerCase().includes(q) || String(emp.badge_number).includes(q);
    }),
    [employeeGroups, search]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} employees</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={filtersOpen ? "border-primary text-primary" : ""}
        >
          {filtersOpen ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or Employee ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      {/* Date presets */}
      <div className="flex gap-2 flex-wrap">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset)}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePreset === preset.label
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            !activePreset
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          <Calendar className="h-3 w-3" />
          Custom
        </button>
      </div>

      {/* Custom range + dept filter */}
      {filtersOpen && (
        <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-2 text-sm border border-border flex-1 min-w-[160px]"
          >
            <option value="">All Departments</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1" />
            <Input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className="flex-1" />
          </div>
          <Button onClick={applyCustom} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-36 bg-secondary/30" />
          ))}
        </div>
      ) : pageData.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">No employees found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pageData.map((emp) => (
            <EmployeeCard key={String(emp.user_id)} emp={emp} onClick={() => setSelected(emp)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <EmployeeModal
          emp={selected}
          onClose={() => setSelected(null)}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  );
}