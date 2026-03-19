import { useEffect, useState, useMemo} from "react";
import { getEmployees, getDepartments, updateEmployee, bulkUpdateDepartment, getMonthlyHours } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const SHIFTS = [
  { value: "morning",   label: "Morning (6AM–2PM)",    hours: 8  },
  { value: "afternoon", label: "Afternoon (2PM–10PM)", hours: 8  },
  { value: "night",     label: "Night (7PM–7AM)",      hours: 12 },
  { value: "day",       label: "Day (8AM–6PM)",        hours: 10 },
];

const WORK_DAYS = [
  { value: "mon_fri", label: "Mon – Fri" },
  { value: "mon_sat", label: "Mon – Sat" },
];

const SHIFT_HOURS: Record<string, number> = {
  morning: 8, afternoon: 8, night: 12, day: 10,
};

function MonthPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (month: number, year: number) => void;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const prev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };

  const next = () => {
    if (isCurrentMonth) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };

  const label = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long", year: "numeric",
  });

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-foreground min-w-[150px] text-center">{label}</span>
      <Button variant="ghost" size="icon" onClick={next} disabled={isCurrentMonth} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function HoursBar({ actual, expected }: { actual: number; expected: number | null }) {
  if (!expected) return <span className="text-foreground font-medium">{actual}h</span>;
  const pct   = Math.min((actual / expected) * 100, 100);
  const color = actual >= expected
    ? "bg-success"
    : pct >= 80 ? "bg-primary"
    : pct >= 50 ? "bg-warning"
    : "bg-destructive";
  return (
    <div className="space-y-1 min-w-[110px]">
      <div className="flex justify-between text-xs">
        <span className="text-foreground font-medium">{actual}h</span>
        <span className="text-muted-foreground">/ {expected}h</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Employees() {
  const now = new Date();
  const [month, setMonth]               = useState(now.getMonth() + 1);
  const [year, setYear]                 = useState(now.getFullYear());
  const [employees, setEmployees]       = useState<any[]>([]);
  const [departments, setDepartments]   = useState<any[]>([]);
  const [monthlyMap, setMonthlyMap]     = useState<Record<number, any>>({});
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [bulkDept, setBulkDept]         = useState("");
  const [bulkShift, setBulkShift]       = useState("");
  const [bulkWorkDays, setBulkWorkDays] = useState("");
  const [loading, setLoading]           = useState(true);
  const [hoursLoading, setHoursLoading] = useState(false);

  // Debounce — only updates after user stops typing for 200ms
  useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(search), 200);
  return () => clearTimeout(timer);
  }, [search]);

  const loadEmployees = () => {
    Promise.all([getEmployees(), getDepartments()])
      .then(([emps, depts]) => {
        setEmployees((emps || []).sort((a, b) => String(a.badge_number).localeCompare(String(b.badge_number), undefined, { numeric: true })
      ));
        setDepartments(depts || []);
      })
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false));
  };

  const loadHours = (m: number, y: number) => {
    setHoursLoading(true);
    getMonthlyHours(m, y)
      .then((hours) => {
        const map: Record<number, any> = {};
        (hours || []).forEach((h: any) => { map[h.user_id] = h; });
        setMonthlyMap(map);
      })
      .catch(() => toast.error("Failed to load monthly hours"))
      .finally(() => setHoursLoading(false));
  };

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => { loadHours(month, year); }, [month, year]);

  // Memoized filter — only recalculates when employees or debouncedSearch changes
  const filtered = useMemo(() =>
  employees.filter(emp => {
    const q = debouncedSearch.toLowerCase();
    return !q ||
      (emp.name || "").toLowerCase().includes(q) ||
      String(emp.badge_number).includes(q);
  }),
  [employees, debouncedSearch]
  );
  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.user_id)));
  };

  const handleFieldUpdate = async (userId: number, field: string, value: string) => {
    try {
      const payload: Record<string, any> = {};
      payload[field] = field === "department_id" ? (value ? parseInt(value) : null) : (value || null);
      await updateEmployee(userId, payload);
      toast.success("Updated");
      loadEmployees();
      loadHours(month, year);
    } catch { toast.error("Update failed"); }
  };

  const handleBulk = async () => {
    if (selected.size === 0) return;
    try {
      const promises: Promise<any>[] = [];
      if (bulkDept) {
        promises.push(bulkUpdateDepartment(Array.from(selected).map(String), bulkDept));
      }
      Array.from(selected).forEach((uid) => {
        const payload: Record<string, any> = {};
        if (bulkShift)    payload.shift     = bulkShift;
        if (bulkWorkDays) payload.work_days = bulkWorkDays;
        if (Object.keys(payload).length) promises.push(updateEmployee(uid, payload));
      });
      await Promise.all(promises);
      toast.success(`Updated ${selected.size} employees`);
      setSelected(new Set());
      setBulkDept(""); setBulkShift(""); setBulkWorkDays("");
      loadEmployees();
      loadHours(month, year);
    } catch { toast.error("Bulk update failed"); }
  };

  // For employees with no attendance data, calculate expected values from their profile
  const getExpected = (emp: any) => {
    const monthly = monthlyMap[emp.user_id];
    if (monthly) return monthly;

    // No attendance data — still show expected from shift/work_days if configured
    const shiftHrs = emp.shift ? SHIFT_HOURS[emp.shift] : null;
    return {
      actual_hours  : 0,
      days_present  : 0,
      expected_days : null,   // backend calculates this with holidays
      expected_hours: null,
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} total</p>
        </div>
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or badge..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="glass-card rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <select value={bulkDept} onChange={(e) => setBulkDept(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">Assign department...</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">Assign shift...</option>
            {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={bulkWorkDays} onChange={(e) => setBulkWorkDays(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">Assign work days...</option>
            {WORK_DAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <Button size="sm" onClick={handleBulk} disabled={!bulkDept && !bulkShift && !bulkWorkDays}>
            Apply
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 text-left">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left">Employee ID #</th>
                  <th className="px-3 py-3 text-left">Machine ID</th>
                  <th className="px-3 py-3 text-left">Full Name</th>
                  <th className="px-3 py-3 text-left">Department</th>
                  <th className="px-3 py-3 text-left">Shift</th>
                  <th className="px-3 py-3 text-left">Work Days</th>
                  <th className="px-3 py-3 text-left">Days Present</th>
                  <th className="px-3 py-3 text-left">Exp. Days</th>
                  <th className="px-3 py-3 text-left">Hours Worked</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp: any) => {
                  const id      = emp.user_id;
                  const monthly = getExpected(emp);
                  return (
                    <tr key={id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleSelect(id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{emp.badge_number || "—"}</td>
                      <td className="px-3 py-3 font-mono text-xs">{emp.user_id}</td>
                      <td className="px-3 py-3 font-medium">{emp.name}</td>

                      {/* Department */}
                      <td className="px-3 py-3">
                        <select
                          value={emp.department_id || ""}
                          onChange={(e) => handleFieldUpdate(id, "department_id", e.target.value)}
                          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border min-w-[110px]"
                        >
                          <option value="">None</option>
                          {departments.map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Shift */}
                      <td className="px-3 py-3">
                        <select
                          value={emp.shift || ""}
                          onChange={(e) => handleFieldUpdate(id, "shift", e.target.value)}
                          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border min-w-[130px]"
                        >
                          <option value="">None</option>
                          {SHIFTS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Work Days */}
                      <td className="px-3 py-3">
                        <select
                          value={emp.work_days || ""}
                          onChange={(e) => handleFieldUpdate(id, "work_days", e.target.value)}
                          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
                        >
                          <option value="">None</option>
                          {WORK_DAYS.map((w) => (
                            <option key={w.value} value={w.value}>{w.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Days present */}
                      <td className="px-3 py-3 text-center">
                        {hoursLoading ? (
                          <span className="text-muted-foreground">…</span>
                        ) : (
                          <span className={`font-medium ${
                            monthly.expected_days && monthly.days_present < monthly.expected_days
                              ? "text-destructive" : monthly.days_present > 0 ? "text-success" : "text-muted-foreground"
                          }`}>
                            {monthly.days_present}
                          </span>
                        )}
                      </td>

                      {/* Expected days */}
                      <td className="px-3 py-3 text-center text-muted-foreground">
                        {hoursLoading ? "…" : monthly.expected_days ?? (
                          <span className="text-xs text-muted-foreground/50">no shift</span>
                        )}
                      </td>

                      {/* Hours worked */}
                      <td className="px-3 py-3">
                        {hoursLoading ? (
                          <span className="text-muted-foreground">…</span>
                        ) : (
                          <HoursBar
                            actual={monthly.actual_hours}
                            expected={monthly.expected_hours}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((emp: any) => {
          const id      = emp.user_id;
          const monthly = getExpected(emp);
          return (
            <div key={id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{emp.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Employee ID {emp.badge_number || "—"} · ID {emp.user_id}
                  </p>
                </div>
                <Checkbox checked={selected.has(id)} onCheckedChange={() => toggleSelect(id)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Department</p>
                  <select value={emp.department_id || ""}
                    onChange={(e) => handleFieldUpdate(id, "department_id", e.target.value)}
                    className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
                    <option value="">None</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Shift</p>
                  <select value={emp.shift || ""}
                    onChange={(e) => handleFieldUpdate(id, "shift", e.target.value)}
                    className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
                    <option value="">None</option>
                    {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Work Days</p>
                  <select value={emp.work_days || ""}
                    onChange={(e) => handleFieldUpdate(id, "work_days", e.target.value)}
                    className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
                    <option value="">None</option>
                    {WORK_DAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Role</p>
                  <p className="text-xs text-foreground">{emp.role || "—"}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Days present</span>
                  <span className={`font-medium ${
                    monthly.expected_days && monthly.days_present < monthly.expected_days
                      ? "text-destructive" : monthly.days_present > 0 ? "text-success" : "text-muted-foreground"
                  }`}>
                    {monthly.days_present}{monthly.expected_days ? ` / ${monthly.expected_days}` : ""}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hours worked</p>
                  <HoursBar actual={monthly.actual_hours} expected={monthly.expected_hours} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}