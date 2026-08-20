import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getEmployees } from "@/lib/api";
import {
  CalendarDays, Users, User, Trash2, Plus, Search,
  CheckCircle2, XCircle, X, FileText, ChevronDown, ChevronUp
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
function getToken() { return localStorage.getItem("biologix_token"); }

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

async function getLeaves(params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/leaves/${q ? "?" + q : ""}`);
}

async function createLeave(payload: Record<string, any>) {
  return apiFetch("/leaves/", { method: "POST", body: JSON.stringify(payload) });
}

async function deleteLeave(id: number) {
  return apiFetch(`/leaves/${id}`, { method: "DELETE" });
}

// ── helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function dayCount(from: string, to: string) {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
}

function getMonthLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── types ─────────────────────────────────────────────────────────────────────
interface EmployeeOption {
  user_id     : number;
  badge_number: string;
  name        : string;
  department_id?: number | null;
}

interface LeaveRecord {
  id            : number;
  applies_to_all: boolean;
  user_id       : number | null;
  leave_type    : "paid" | "unpaid";
  date_from     : string;
  date_to       : string;
  description   : string | null;
  employee_name : string | null;
  badge_number  : string | null;
  created_at    : string;
}

// ── employee search (client-side from employees list) ─────────────────────────
function EmployeeSearch({
  employees, onSelect, selected, onClear,
}: {
  employees: EmployeeOption[];
  onSelect : (emp: EmployeeOption) => void;
  selected : EmployeeOption | null;
  onClear  : () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        String(e.badge_number).includes(q)
    ).slice(0, 8);
  }, [query, employees]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 border border-border">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
          <p className="text-xs text-muted-foreground font-mono">#{selected.badge_number}</p>
        </div>
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or badge number..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
        />
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute z-20 w-full mt-1 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          {results.length > 0 ? results.map((emp) => (
            <button
              key={emp.user_id}
              onMouseDown={() => { onSelect(emp); setQuery(""); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                <p className="text-xs text-muted-foreground font-mono">#{emp.badge_number}</p>
              </div>
            </button>
          )) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">No employees found.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── leave card ────────────────────────────────────────────────────────────────
function LeaveCard({ leave, onDelete }: { leave: LeaveRecord; onDelete: () => void }) {
  const isPaid = leave.leave_type === "paid";
  const days   = dayCount(leave.date_from, leave.date_to);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isPaid ? "bg-green-500/15" : "bg-orange-500/15"
      }`}>
        {isPaid
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : <XCircle className="h-5 w-5 text-orange-500" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isPaid
              ? "bg-green-500/15 text-green-500"
              : "bg-orange-500/15 text-orange-500"
          }`}>
            {isPaid ? "Paid Leave" : "Unpaid Leave"}
          </span>
          {leave.applies_to_all ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1">
              <Users className="h-3 w-3" /> All Employees
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
              #{leave.badge_number} · {leave.employee_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDate(leave.date_from)}
            {leave.date_from !== leave.date_to && ` → ${formatDate(leave.date_to)}`}
          </span>
          <span className="text-primary font-medium">
            {days} day{days > 1 ? "s" : ""}
          </span>
        </div>

        {leave.description && (
          <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
            <FileText className="h-3 w-3 mt-0.5 shrink-0" />
            {leave.description}
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        className="self-start sm:self-center p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── month group ───────────────────────────────────────────────────────────────
function MonthGroup({
  monthKey, label, leaves, onDelete,
}: {
  monthKey: string;
  label   : string;
  leaves  : LeaveRecord[];
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const paid   = leaves.filter((l) => l.leave_type === "paid").length;
  const unpaid = leaves.filter((l) => l.leave_type === "unpaid").length;

  return (
    <div className="space-y-2">
      {/* Month header — clickable to collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-xl hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">{label}</span>
          <div className="flex items-center gap-1.5">
            {paid > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                {paid} paid
              </span>
            )}
            {unpaid > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-medium">
                {unpaid} unpaid
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {/* Leave cards for this month */}
      {open && (
        <div className="space-y-2 pl-2">
          {leaves.map((leave) => (
            <LeaveCard
              key={leave.id}
              leave={leave}
              onDelete={() => onDelete(leave.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Leaves() {
  const [leaves, setLeaves]         = useState<LeaveRecord[]>([]);
  const [employees, setEmployees]   = useState<EmployeeOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm]     = useState(false);

  // form state
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedEmp, setSelectedEmp]   = useState<EmployeeOption | null>(null);
  const [leaveType, setLeaveType]       = useState<"paid" | "unpaid">("paid");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [description, setDescription]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [leavesData, empsData] = await Promise.all([
        getLeaves(),
        getEmployees(),
      ]);
      setLeaves(leavesData || []);
      setEmployees(empsData || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setAppliesToAll(true);
    setSelectedEmp(null);
    setLeaveType("paid");
    setDateFrom("");
    setDateTo("");
    setDescription("");
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!dateFrom || !dateTo)              { toast.error("Please select a date range"); return; }
    if (!appliesToAll && !selectedEmp)     { toast.error("Please select an employee"); return; }
    if (dateTo < dateFrom)                 { toast.error("End date must be after start date"); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        applies_to_all: appliesToAll,
        leave_type    : leaveType,
        date_from     : dateFrom,
        date_to       : dateTo,
        description   : description || null,
      };
      if (!appliesToAll && selectedEmp) payload.user_id = selectedEmp.user_id;
      await createLeave(payload);
      toast.success("Leave created successfully");
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create leave");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLeave(id);
      toast.success("Leave deleted");
      load();
    } catch { toast.error("Failed to delete leave"); }
  };

  // Group leaves by month of date_from, newest first
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, LeaveRecord[]>();
    const sorted = [...leaves].sort(
      (a, b) => new Date(b.date_from).getTime() - new Date(a.date_from).getTime()
    );
    for (const leave of sorted) {
      const key = getMonthKey(leave.date_from);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(leave);
    }
    return map;
  }, [leaves]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leaves.length} leave record{leaves.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
          variant={showForm ? "outline" : "default"}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New Leave"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="glass-card rounded-2xl p-6 space-y-5 border border-border/60">
          <h2 className="text-base font-semibold text-foreground">Create Leave</h2>

          {/* Applies to */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Applies To</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setAppliesToAll(true); setSelectedEmp(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  appliesToAll
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                <Users className="h-4 w-4" /> All Employees
              </button>
              <button
                onClick={() => setAppliesToAll(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  !appliesToAll
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                <User className="h-4 w-4" /> Specific Employee
              </button>
            </div>
          </div>

          {/* Employee search — client-side from loaded employees */}
          {!appliesToAll && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employee</p>
              <EmployeeSearch
                employees={employees}
                selected={selectedEmp}
                onSelect={setSelectedEmp}
                onClear={() => setSelectedEmp(null)}
              />
            </div>
          )}

          {/* Leave type */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Leave Type</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveType("paid")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  leaveType === "paid"
                    ? "bg-green-500/20 text-green-500 border-green-500/40"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-green-500/30"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> Paid Leave
              </button>
              <button
                onClick={() => setLeaveType("unpaid")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  leaveType === "unpaid"
                    ? "bg-orange-500/20 text-orange-500 border-orange-500/40"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-orange-500/30"
                }`}
              >
                <XCircle className="h-4 w-4" /> Unpaid Leave
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Range</p>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">From</p>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    if (!dateTo || e.target.value > dateTo) setDateTo(e.target.value);
                  }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">To</p>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            {dateFrom && dateTo && (
              <p className="text-xs text-primary font-medium">
                {dayCount(dateFrom, dateTo)} day{dayCount(dateFrom, dateTo) > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description <span className="normal-case text-muted-foreground/50">(optional)</span>
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sick Leave, Holiday break..."
              rows={2}
              className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            <CalendarDays className="h-4 w-4" />
            {submitting ? "Creating..." : "Create Leave"}
          </Button>
        </div>
      )}

      {/* Leave list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : leaves.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No leave records yet.</p>
          <p className="text-xs mt-1">Click "New Leave" to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedByMonth.entries()).map(([key, monthLeaves]) => (
            <MonthGroup
              key={key}
              monthKey={key}
              label={getMonthLabel(monthLeaves[0].date_from)}
              leaves={monthLeaves}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}