import { useEffect, useState, useMemo, useCallback, memo } from "react";
import {
  getEmployees, getDepartments, updateEmployee,
  bulkUpdateDepartment, getMonthlyHours
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, ChevronLeft, ChevronRight,
  Plus, X, Trash2, AlertTriangle, UserPlus
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { useRole } from "@/hooks/useRole";
import { deleteEmployee as apiDeleteEmployee } from "@/lib/api";

const PAGE_SIZE = 20;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
function getToken() { return localStorage.getItem("biologix_token"); }

async function createEmployee(payload: Record<string, any>) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/employees/`, {
    method : "POST",
    headers: {
      "Content-Type" : "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create employee" }));
    throw new Error(err.detail || "Failed to create employee");
  }
  return res.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (month: number, year: number) => void;
}) {
  const now            = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const prev = () => { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); };
  const next = () => {
    if (isCurrentMonth) return;
    if (month === 12) onChange(1, year + 1); else onChange(month + 1, year);
  };
  const label = new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
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

// ─── Hours Bar ────────────────────────────────────────────────────────────────
function HoursBar({ actual, expected }: { actual: number; expected: number | null }) {
  if (!expected) return <span className="text-foreground font-medium">{actual}h</span>;
  const pct   = Math.min((actual / expected) * 100, 100);
  const color = actual >= expected ? "bg-success" : pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-warning" : "bg-destructive";
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

// ─── Inline editable text field ───────────────────────────────────────────────
function InlineEdit({
  value, onSave, placeholder = "Click to edit...", className = ""
}: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-xs text-left w-full px-2 py-1 rounded hover:bg-secondary/80 transition-colors ${className}`}
      >
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
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
        placeholder={placeholder}
      />
      <Button size="sm" className="h-7 text-xs px-2 shrink-0"
        onClick={() => { onSave(draft); setEditing(false); }}>
        Save
      </Button>
    </div>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────
function DeleteDialog({
  employee, onConfirm, onCancel, loading,
}: {
  employee: any; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Delete Employee?</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone</p>
          </div>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-sm space-y-1">
          <p className="font-medium text-foreground">{employee.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            Badge #{employee.badge_number} · Machine ID {employee.user_id}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Deleting this employee will archive their profile and attendance records.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
            onClick={onConfirm} disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Employee Form ────────────────────────────────────────────────────────
function AddEmployeeForm({
  departments, onSuccess, onCancel,
}: {
  departments: any[]; onSuccess: () => void; onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    user_id: "", badge_number: "", name: "", position: "",
    department_id: "", shift: "", work_days: "",
  });
  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.user_id || !form.badge_number || !form.name) {
      toast.error("Machine ID, Badge Number and Name are required");
      return;
    }
    setSubmitting(true);
    try {
      await createEmployee({
        user_id      : parseInt(form.user_id),
        badge_number : form.badge_number,
        name         : form.name,
        position     : form.position || null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        shift        : form.shift || null,
        work_days    : form.work_days || null,
      });
      toast.success(`${form.name} added successfully`);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Failed to add employee");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/60 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Add New Employee</h2>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Machine ID <span className="text-destructive">*</span></p>
          <Input type="number" placeholder="e.g. 197" value={form.user_id}
            onChange={(e) => set("user_id", e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Badge Number <span className="text-destructive">*</span></p>
          <Input placeholder="e.g. 275" value={form.badge_number}
            onChange={(e) => set("badge_number", e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Full Name <span className="text-destructive">*</span></p>
          <Input placeholder="e.g. Oladimeji Israel Opeyemi" value={form.name}
            onChange={(e) => set("name", e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Position <span className="text-muted-foreground/50">(optional)</span></p>
          <Input placeholder="e.g. Factory Worker, Supervisor" value={form.position}
            onChange={(e) => set("position", e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Department</p>
          <select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}
            className="w-full bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">None</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Shift</p>
          <select value={form.shift} onChange={(e) => set("shift", e.target.value)}
            className="w-full bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">None</option>
            {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Work Days</p>
          <select value={form.work_days} onChange={(e) => set("work_days", e.target.value)}
            className="w-full bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm border border-border">
            <option value="">None</option>
            {WORK_DAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={submitting}>
          <UserPlus className="h-4 w-4" />
          {submitting ? "Adding..." : "Add Employee"}
        </Button>
      </div>
    </div>
  );
}

// ─── Employee Row ─────────────────────────────────────────────────────────────
const EmployeeRow = memo(function EmployeeRow({
  emp, monthly, hoursLoading, isSelected, departments,
  onToggle, onFieldUpdate, onDelete, onPermissionBlock,
  canEdit, isAdmin,
}: {
  emp: any; monthly: any; hoursLoading: boolean; isSelected: boolean;
  departments: any[];
  onToggle         : (id: number) => void;
  onFieldUpdate    : (userId: number, field: string, value: string) => void;
  onDelete         : (emp: any) => void;
  onPermissionBlock: (role: "editor" | "payroll" | "admin") => void;
  canEdit          : boolean;
  isAdmin          : boolean;
}) {
  const id = emp.user_id;

  // Guard wrapper — shows popup if no permission, fires action if allowed
  const guard = (role: "editor" | "admin", action: () => void) => {
    if (role === "editor" && !canEdit) { onPermissionBlock("editor"); return; }
    if (role === "admin"  && !isAdmin) { onPermissionBlock("admin");  return; }
    action();
  };

  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30 group">
      <td className="px-3 py-3">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(id)} />
      </td>
      <td className="px-3 py-3 font-mono text-xs">{emp.badge_number || "—"}</td>
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{emp.user_id}</td>

      {/* Name */}
      <td className="px-3 py-3 font-medium">
        <InlineEdit
          value={emp.name || ""}
          onSave={(val) => guard("editor", () => onFieldUpdate(id, "name", val))}
          placeholder="Enter name..."
          className="font-medium"
        />
      </td>

      {/* Position */}
      <td className="px-3 py-3">
        <InlineEdit
          value={emp.position || ""}
          onSave={(val) => guard("editor", () => onFieldUpdate(id, "position", val))}
          placeholder="Add position..."
        />
      </td>

      {/* Department */}
      <td className="px-3 py-3">
        <select
          value={emp.department_id || ""}
          onChange={(e) => guard("editor", () => onFieldUpdate(id, "department_id", e.target.value))}
          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border min-w-[110px]"
        >
          <option value="">None</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </td>

      {/* Shift */}
      <td className="px-3 py-3">
        <select
          value={emp.shift || ""}
          onChange={(e) => guard("editor", () => onFieldUpdate(id, "shift", e.target.value))}
          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border min-w-[130px]"
        >
          <option value="">None</option>
          {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>

      {/* Work Days */}
      <td className="px-3 py-3">
        <select
          value={emp.work_days || ""}
          onChange={(e) => guard("editor", () => onFieldUpdate(id, "work_days", e.target.value))}
          className="bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border"
        >
          <option value="">None</option>
          {WORK_DAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </td>

      {/* Days Present */}
      <td className="px-3 py-3 text-center">
        {hoursLoading ? <span className="text-muted-foreground text-xs">…</span> : (
          <span className={`font-medium ${
            monthly.expected_days && monthly.days_present < monthly.expected_days
              ? "text-destructive"
              : monthly.days_present > 0 ? "text-success" : "text-muted-foreground"
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
        {hoursLoading ? <span className="text-muted-foreground text-xs">…</span> : (
          <HoursBar actual={monthly.actual_hours} expected={monthly.expected_hours} />
        )}
      </td>

      {/* Delete */}
      <td className="px-3 py-3">
        <button
          onClick={() => guard("admin", () => onDelete(emp))}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete employee"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});

// ─── Employee Mobile Card ─────────────────────────────────────────────────────
const EmployeeMobileCard = memo(function EmployeeMobileCard({
  emp, monthly, hoursLoading, isSelected, departments,
  onToggle, onFieldUpdate, onDelete, onPermissionBlock,
  canEdit, isAdmin,
}: {
  emp: any; monthly: any; hoursLoading: boolean; isSelected: boolean;
  departments: any[];
  onToggle         : (id: number) => void;
  onFieldUpdate    : (userId: number, field: string, value: string) => void;
  onDelete         : (emp: any) => void;
  onPermissionBlock: (role: "editor" | "payroll" | "admin") => void;
  canEdit          : boolean;
  isAdmin          : boolean;
}) {
  const id = emp.user_id;

  const guard = (role: "editor" | "admin", action: () => void) => {
    if (role === "editor" && !canEdit) { onPermissionBlock("editor"); return; }
    if (role === "admin"  && !isAdmin) { onPermissionBlock("admin");  return; }
    action();
  };

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <InlineEdit
            value={emp.name || ""}
            onSave={(val) => guard("editor", () => onFieldUpdate(id, "name", val))}
            placeholder="Enter name..."
            className="font-semibold text-sm"
          />
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Badge #{emp.badge_number || "—"} · Machine {emp.user_id}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Checkbox checked={isSelected} onCheckedChange={() => onToggle(id)} />
          <button
            onClick={() => guard("admin", () => onDelete(emp))}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Position</p>
          <InlineEdit
            value={emp.position || ""}
            onSave={(val) => guard("editor", () => onFieldUpdate(id, "position", val))}
            placeholder="Add position..."
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Department</p>
          <select value={emp.department_id || ""}
            onChange={(e) => guard("editor", () => onFieldUpdate(id, "department_id", e.target.value))}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
            <option value="">None</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Shift</p>
          <select value={emp.shift || ""}
            onChange={(e) => guard("editor", () => onFieldUpdate(id, "shift", e.target.value))}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
            <option value="">None</option>
            {SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Work Days</p>
          <select value={emp.work_days || ""}
            onChange={(e) => guard("editor", () => onFieldUpdate(id, "work_days", e.target.value))}
            className="w-full bg-secondary text-foreground rounded px-2 py-1 text-xs border border-border">
            <option value="">None</option>
            {WORK_DAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
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
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Employees() {
  const now = new Date();

  // ── Role ──────────────────────────────────────────────────────────────────
  const { canEdit, isAdmin } = useRole();
  const [permissionBlock, setPermissionBlock] = useState<"editor" | "payroll" | "admin" | null>(null);

  // ── State ─────────────────────────────────────────────────────────────────
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
  const [showAddForm, setShowAddForm]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const loadEmployees = useCallback(() => {
    Promise.all([getEmployees(), getDepartments()])
      .then(([emps, depts]) => {
        setEmployees(
          (emps || []).sort((a: any, b: any) =>
            String(a.badge_number).localeCompare(String(b.badge_number), undefined, { numeric: true })
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

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return employees.filter((emp) =>
      !q || (emp.name || "").toLowerCase().includes(q) || String(emp.badge_number).includes(q)
    );
  }, [employees, debouncedSearch]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.user_id))
    );
  }, [filtered]);

  const handleFieldUpdate = useCallback(async (userId: number, field: string, value: string) => {
    try {
      const payload: Record<string, any> = {};
      payload[field] = field === "department_id" ? (value ? parseInt(value) : null) : (value || null);
      await updateEmployee(userId, payload);
      toast.success("Updated");
      loadEmployees();
      loadHours(month, year);
    } catch { toast.error("Update failed"); }
  }, [loadEmployees, loadHours, month, year]);

  const handleBulk = useCallback(async () => {
    if (selected.size === 0) return;
    if (!canEdit) { setPermissionBlock("editor"); return; }
    try {
      const promises: Promise<any>[] = [];
      if (bulkDept) promises.push(bulkUpdateDepartment(Array.from(selected).map(String), bulkDept));
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
      loadEmployees(); loadHours(month, year);
    } catch { toast.error("Bulk update failed"); }
  }, [selected, bulkDept, bulkShift, bulkWorkDays, canEdit, loadEmployees, loadHours, month, year]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDeleteEmployee(String(deleteTarget.badge_number));
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      loadEmployees();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadEmployees]);

  const getExpected = useCallback((emp: any) => {
    const monthly = monthlyMap[emp.user_id];
    if (monthly) return monthly;
    return { actual_hours: 0, days_present: 0, expected_days: null, expected_hours: null };
  }, [monthlyMap]);

  const handlePermissionBlock = useCallback((role: "editor" | "payroll" | "admin") => {
    setPermissionBlock(role);
  }, []);

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
        <div className="flex items-center gap-3">
          <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button
            size="sm" className="gap-2"
            onClick={() => {
              if (!canEdit) { setPermissionBlock("editor"); return; }
              setShowAddForm(!showAddForm);
            }}
            variant={showAddForm ? "outline" : "default"}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? "Cancel" : "Add Employee"}
          </Button>
        </div>
      </div>

      {/* Add Employee Form — only shown if canEdit */}
      {showAddForm && canEdit && (
        <AddEmployeeForm
          departments={departments}
          onSuccess={() => { setShowAddForm(false); loadEmployees(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

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
                  <th className="px-3 py-3 text-left">Position</th>
                  <th className="px-3 py-3 text-left">Department</th>
                  <th className="px-3 py-3 text-left">Shift</th>
                  <th className="px-3 py-3 text-left">Work Days</th>
                  <th className="px-3 py-3 text-left">Days Present</th>
                  <th className="px-3 py-3 text-left">Exp. Days</th>
                  <th className="px-3 py-3 text-left">Hours Worked</th>
                  <th className="px-3 py-3 text-left w-10"></th>
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
                    onDelete={setDeleteTarget}
                    onPermissionBlock={handlePermissionBlock}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
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
            onDelete={setDeleteTarget}
            onPermissionBlock={handlePermissionBlock}
            canEdit={canEdit}
            isAdmin={isAdmin}
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
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDialog
          employee={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Permission popup */}
      {permissionBlock && (
        <PermissionGuard
          requiredRole={permissionBlock}
          onClose={() => setPermissionBlock(null)}
        />
      )}
    </div>
  );
}