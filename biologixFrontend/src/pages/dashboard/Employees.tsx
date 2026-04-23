import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { getEmployees, getDepartments, updateEmployee, bulkUpdateDepartment, getMonthlyHours } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

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

// ─── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (month: number, year: number) => void;
}) {
  const now            = new Date();
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
      <span className="text-sm font-medium text-foreground min-w-[150px] text-center">
        {label}
      </span>
      <Button
        variant="ghost" size="icon"
        onClick={next}
        disabled={isCurrentMonth}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Hours Bar ────────────────────────────────────────────────────────────────
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
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Position Input ───────────────────────────────────────────────────────────
function PositionInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-left w-full min-w-[120px] px-2 py-1 rounded hover:bg-secondary/80 transition-colors"
      >
        {value || <span className="text-muted-foreground italic">Add position...</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-[150px]">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="h-7 text-xs px-2"
        placeholder="e.g. IT Manager"
      />
      <Button
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => { onSave(draft); setEditing(false); }}
      >
        Save
      </Button>
    </div>
  );
}

// ─── Employee Row (memoized so it only re-renders when its own data changes) ──
const EmployeeRow = memo(function EmployeeRow({
  emp,
  monthly,
  hoursLoading,
  isSelected,
  departments,
  onToggle,
  onFieldUpdate,
}: {
  emp          : any;
  monthly      : any;
  hoursLoading : boolean;
  isSelected   : boolean;
  departments  : any[];
  onToggle     : (id: number) => void;
  onFieldUpdate: (userId: number, field: string, value: string) => void;
}) {
  const id = emp.user_id;
  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30">
      <td className="px-3 py-3">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(id)} />
      </td>
      <td className="px-3 py-3 font-mono text-xs">{emp.badge_number || "—"}</td>
      <td className="px-3 py-3 font-mono text-xs">{emp.user_id}</td>
      <td className="px-3 py-3 font-medium">{emp.name}</td>
      <td className="px-3 py-3">
        <PositionInput
          value={emp.position || ""}
          onSave={(val) => onFieldUpdate(id, "position", val)}
        />
      </td>

      {/* Department */}
      <td className="px-3 py-3">
        <select
          value={emp.department_id || ""}
          onChange={(e) => onFieldUpdate(id, "department_id", e.target.value)}
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
          onChange={(e) => onFieldUpdate(id, "shift", e.target.value)}
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
          onChange={(e) => onFieldUpdate(id, "work_days", e.target.value)}
          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
        >
          <option value="">None</option>
          {WORK_DAYS.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </td>

      {/* Days Present */}
      <td className="px-3 py-3 text-center">
        {hoursLoading ? (
          <span className="text-muted-foreground text-xs">…</span>
        ) : (
          <span className={`font-medium ${
            monthly.expected_days && monthly.days_present < monthly.expected_days
              ? "text-destructive"
              : monthly.days_present > 0
              ? "text-success"
              : "text-muted-foreground"
          }`}>
            {monthly.days_present}
          </span>
        )}
      </td>

      {/* Expected Days */}
      <td className="px-3 py-3 text-center text-muted-foreground">
        {hoursLoading ? "…" : monthly.expected_days ?? (
          <span className="text-xs text-muted-foreground/50">no shift</span>
        )}
      </td>

      {/* Hours Worked */}
      <td className="px-3 py-3">
        {hoursLoading ? (
          <span className="text-muted-foreground text-xs">…</span>
        ) : (
          <HoursBar actual={monthly.actual_hours} expected={monthly.expected_hours} />
        )}
      </td>
    </tr>
  );
});

// ─── Employee Mobile Card (memoized) ─────────────────────────────────────────
const EmployeeMobileCard = memo(function EmployeeMobileCard({
  emp,
  monthly,
  hoursLoading,
  isSelected,
  departments,
  onToggle,
  onFieldUpdate,
}: {
  emp          : any;
  monthly      : any;
  hoursLoading : boolean;
  isSelected   : boolean;
  departments  : any[];
  onToggle     : (id: number) => void;
  onFieldUpdate: (userId: number, field: string, value: string) => void;
}) {
  const id = emp.user_id;
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{emp.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            Employee ID {emp.badge_number || "—"} · ID {emp.user_id}
          </p>
        </div>
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(id)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Department</p>
          <select
            value={emp.department_id || ""}
            onChange={(e) => onFieldUpdate(id, "department_id", e.target.value)}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
          >
            <option value="">None</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Shift</p>
          <select
            value={emp.shift || ""}
            onChange={(e) => onFieldUpdate(id, "shift", e.target.value)}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
          >
            <option value="">None</option>
            {SHIFTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Work Days</p>
          <select
            value={emp.work_days || ""}
            onChange={(e) => onFieldUpdate(id, "work_days", e.target.value)}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
          >
            <option value="">None</option>
            {WORK_DAYS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Role</p>
          <p className="text-xs text-foreground">{emp.role || "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Position</p>
          <PositionInput
            value={emp.position || ""}
            onSave={(val) => onFieldUpdate(id, "position", val)}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border/50 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Days present</span>
          <span className={`font-medium ${
            monthly.expected_days && monthly.days_present < monthly.expected_days
              ? "text-destructive"
              : monthly.days_present > 0
              ? "text-success"
              : "text-muted-foreground"
          }`}>
            {monthly.days_present}
            {monthly.expected_days ? ` / ${monthly.expected_days}` : ""}
          </span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Hours worked</p>
          <HoursBar actual={monthly.actual_hours} expected={monthly.expected_hours} />
        </div>
      </div>
    </div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [page, setPage]                 = useState(0);

  // ── Debounce search — input stays instant, filter fires after 200ms ─────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Reset to page 0 when search changes ─────────────────────────────────────
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadEmployees = useCallback(() => {
    Promise.all([getEmployees(), getDepartments()])
      .then(([emps, depts]) => {
        setEmployees(
          (emps || []).sort((a: any, b: any) =>
            String(a.badge_number).localeCompare(
              String(b.badge_number), undefined, { numeric: true }
            )
          )
        );
        setDepartments(depts || []);
      })
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false));
  }, []);

  const loadHours = useCallback((m: number, y: number) => {
    setHoursLoading(true);
    getMonthlyHours(m, y)
      .then((hours) => {
        const map: Record<number, any> = {};
        (hours || []).forEach((h: any) => { map[h.user_id] = h; });
        setMonthlyMap(map);
      })
      .catch(() => toast.error("Failed to load monthly hours"))
      .finally(() => setHoursLoading(false));
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadHours(month, year); }, [month, year, loadHours]);

  // ── Memoized filter — only recalculates when employees or search changes ─────
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return employees.filter((emp) =>
      !q ||
      (emp.name || "").toLowerCase().includes(q) ||
      String(emp.badge_number).includes(q)
    );
  }, [employees, debouncedSearch]);

  // ── Paginated slice — only the current page's rows get rendered ──────────────
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  // ── Stable callbacks so memoized rows don't re-render on every keystroke ─────
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((e) => e.user_id))
    );
  }, [filtered]);

  const handleFieldUpdate = useCallback(async (
    userId: number, field: string, value: string
  ) => {
    try {
      const payload: Record<string, any> = {};
      payload[field] = field === "department_id"
        ? (value ? parseInt(value) : null)
        : (value || null);
      await updateEmployee(userId, payload);
      toast.success("Updated");
      loadEmployees();
      loadHours(month, year);
    } catch {
      toast.error("Update failed");
    }
  }, [loadEmployees, loadHours, month, year]);

  const handleBulk = useCallback(async () => {
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
    } catch {
      toast.error("Bulk update failed");
    }
  }, [selected, bulkDept, bulkShift, bulkWorkDays, loadEmployees, loadHours, month, year]);

  // ── Expected hours helper ────────────────────────────────────────────────────
  const getExpected = useCallback((emp: any) => {
    const monthly = monthlyMap[emp.user_id];
    if (monthly) return monthly;
    return { actual_hours: 0, days_present: 0, expected_days: null, expected_hours: null };
  }, [monthlyMap]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Loading...
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} total</p>
        </div>
        <MonthPicker
          month={month}
          year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }}
        />
      </div>

      {/* Search — controlled only by local `search` state, never triggers filter directly */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or badge..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass-card rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <select
            value={bulkDept}
            onChange={(e) => setBulkDept(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border"
          >
            <option value="">Assign department...</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={bulkShift}
            onChange={(e) => setBulkShift(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border"
          >
            <option value="">Assign shift...</option>
            {SHIFTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={bulkWorkDays}
            onChange={(e) => setBulkWorkDays(e.target.value)}
            className="bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border"
          >
            <option value="">Assign work days...</option>
            {WORK_DAYS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleBulk}
            disabled={!bulkDept && !bulkShift && !bulkWorkDays}
          >
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
                  <th className="px-3 py-3 text-left">Position</th>
                  <th className="px-3 py-3 text-left">Department</th>
                  <th className="px-3 py-3 text-left">Shift</th>
                  <th className="px-3 py-3 text-left">Work Days</th>
                  <th className="px-3 py-3 text-left">Days Present</th>
                  <th className="px-3 py-3 text-left">Exp. Days</th>
                  <th className="px-3 py-3 text-left">Hours Worked</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((emp: any) => (
                  <EmployeeRow
                    key={emp.user_id}
                    emp={emp}
                    monthly={getExpected(emp)}
                    hoursLoading={hoursLoading}
                    isSelected={selected.has(emp.user_id)}
                    departments={departments}
                    onToggle={toggleSelect}
                    onFieldUpdate={handleFieldUpdate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {pageData.map((emp: any) => (
          <EmployeeMobileCard
            key={emp.user_id}
            emp={emp}
            monthly={getExpected(emp)}
            hoursLoading={hoursLoading}
            isSelected={selected.has(emp.user_id)}
            departments={departments}
            onToggle={toggleSelect}
            onFieldUpdate={handleFieldUpdate}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} · {filtered.length} employees
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}