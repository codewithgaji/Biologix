import { useEffect, useState } from "react";
import { getAttendanceSummary, getDepartments } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";

const PAGE_SIZE = 50;

function threeMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}

// Converts DB timestamp string to local time with AM/PM
function formatTime(ts: string | null): string {
  if (!ts) return "—";

  // Remove quotes if any
  ts = ts.replace(/"/g, "");

  // Split on space or T
  const timePart = ts.includes("T") ? ts.split("T")[1] : ts.split(" ")[1];
  if (!timePart) return "—";

  const [hourStr, minuteStr] = timePart.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minuteStr} ${ampm}`;
}

export default function Attendance() {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(threeMonthsAgo());
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (deptFilter) params.department_id = deptFilter;

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

  const filtered = data
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        !q ||
        (r.employee_name || "").toLowerCase().includes(q) ||
        (r.badge_number  || "").toString().includes(q)
      );
    })
    .sort((a, b) =>
      (a.badge_number || "").toString().localeCompare((b.badge_number || "").toString())
    );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusClass = (status: string) =>
    status === "present"
      ? "bg-success/15 text-success"
      : "bg-destructive/15 text-destructive";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} records</p>
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
          placeholder="Search name or badge number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      {/* Filters panel */}
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
          <Button onClick={() => { load(); setFiltersOpen(false); }} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading attendance data...</div>
        ) : pageData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No attendance records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-left">Badge #</th>
                  <th className="px-4 py-3 text-left">Machine ID</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Clock In</th>
                  <th className="px-4 py-3 text-left">Clock Out</th>
                  <th className="px-4 py-3 text-left">Hours</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs">{row.badge_number || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.user_id || "—"}</td>
                    <td className="px-4 py-3 font-medium">{row.employee_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.department_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                    <td className="px-4 py-3 font-medium">{formatTime(row.clock_in)}</td>
                    <td className="px-4 py-3 font-medium">{formatTime(row.clock_out)}</td>
                    <td className="px-4 py-3">
                      {row.hours_worked != null ? `${row.hours_worked}h` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} · {filtered.length} records
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
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading attendance data...</div>
        ) : pageData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No attendance records found.</div>
        ) : (
          pageData.map((row: any, i: number) => (
            <div key={i} className="glass-card rounded-xl p-4 space-y-3">

              {/* Name + status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground text-sm">{row.employee_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.department_name || "—"}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusClass(row.status)}`}>
                  {row.status}
                </span>
              </div>

              {/* IDs */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Badge: <span className="font-mono text-foreground">{row.badge_number || "—"}</span></span>
                <span>Machine ID: <span className="font-mono text-foreground">{row.user_id || "—"}</span></span>
              </div>

              {/* Date + times */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-secondary/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground mb-0.5">Date</p>
                  <p className="font-medium text-foreground">{row.date}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground mb-0.5">Clock In</p>
                  <p className="font-medium text-foreground">{formatTime(row.clock_in)}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground mb-0.5">Clock Out</p>
                  <p className="font-medium text-foreground">{formatTime(row.clock_out)}</p>
                </div>
              </div>

              {/* Hours */}
              {row.hours_worked != null && (
                <p className="text-xs text-muted-foreground">
                  Hours worked: <span className="text-foreground font-medium">{row.hours_worked}h</span>
                </p>
              )}
            </div>
          ))
        )}

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
      </div>
    </div>
  );
}