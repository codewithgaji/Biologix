import { useEffect, useState } from "react";
import { Users, Building2, UserCheck, UserX, ArrowRight } from "lucide-react";
import { getEmployees, getDepartments, getAttendanceSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function StatCard({
  icon: Icon, label, value, color, onClick,
}: {
  icon: any; label: string; value: number | string; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass-card rounded-xl p-4 sm:p-5 text-left w-full transition-all hover:scale-[1.02] hover:shadow-lg ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <div className={`p-1.5 sm:p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground leading-tight">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
    </button>
  );
}

const SHIFT_LABELS: Record<string, string> = {
  morning  : "Morning",
  afternoon: "Afternoon",
  night    : "Night",
  day      : "Day",
};

// ─── mobile card row for employees ───────────────────────────────────────────
function EmployeeCard({ emp, deptMap, onClick }: { emp: any; deptMap: Record<number, string>; onClick: () => void }) {
  return (
    <div
      className="px-4 py-3 border-b border-border/50 hover:bg-secondary/30 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-foreground">{emp.name || "—"}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          emp.role === "admin" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
        }`}>
          {emp.role || "user"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>Badge: <span className="font-mono">{emp.badge_number || "—"}</span></span>
        <span>ID: <span className="font-mono">{emp.user_id}</span></span>
        {emp.department_id && <span>{deptMap[emp.department_id] || "—"}</span>}
        {emp.shift && <span>{SHIFT_LABELS[emp.shift] || emp.shift}</span>}
      </div>
    </div>
  );
}

// ─── mobile card row for attendance ──────────────────────────────────────────
function AttendanceCard({ row, onClick }: { row: any; onClick: () => void }) {
  return (
    <div
      className="px-4 py-3 border-b border-border/50 hover:bg-secondary/30 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-foreground">{row.employee_name || "—"}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          row.status === "present" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}>
          {row.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{row.date}</span>
        <span>
          In: {row.clock_in ? new Date(row.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        <span>
          Out: {row.clock_out ? new Date(row.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        {row.hours_worked != null && <span>{row.hours_worked}h worked</span>}
      </div>
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats]           = useState({ employees: 0, departments: 0, present: 0, absent: 0 });
  const [employees, setEmployees]   = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const today      = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 8) + "01";

    Promise.all([
      getEmployees().catch(() => []),
      getDepartments().catch(() => []),
      getAttendanceSummary({ date_from: today, date_to: today }).catch(() => []),
      getAttendanceSummary({ date_from: monthStart, date_to: today }).catch(() => []),
    ]).then(([emps, depts, todayAtt, monthAtt]) => {
      const present = Array.isArray(todayAtt) ? todayAtt.filter((a: any) => a.status === "present").length : 0;
      const absent  = Array.isArray(todayAtt) ? todayAtt.filter((a: any) => a.status === "absent").length  : 0;
      setStats({
        employees  : Array.isArray(emps)  ? emps.length  : 0,
        departments: Array.isArray(depts) ? depts.length : 0,
        present,
        absent,
      });
      setEmployees(Array.isArray(emps)      ? emps      : []);
      setDepartments(Array.isArray(depts)   ? depts     : []);
      setAttendance(Array.isArray(monthAtt) ? monthAtt  : []);
    }).catch(() => toast.error("Failed to load overview data"))
      .finally(() => setLoading(false));
  }, []);

  const deptMap = departments.reduce((acc: Record<number, string>, d: any) => {
    acc[d.id] = d.name;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading...</div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Overview</h1>

      {/* Stat Cards — 2×2 on mobile, 4-col on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users}     label="Total Employees"   value={stats.employees}   color="bg-primary/15 text-primary"            onClick={() => navigate("/dashboard/employees")}   />
        <StatCard icon={Building2} label="Departments"       value={stats.departments} color="bg-secondary text-secondary-foreground" onClick={() => navigate("/dashboard/departments")} />
        <StatCard icon={UserCheck} label="Present Today"     value={stats.present}     color="bg-success/15 text-success"            onClick={() => navigate("/dashboard/attendance")}  />
        <StatCard icon={UserX}     label="Absent Today"      value={stats.absent}      color="bg-destructive/15 text-destructive"    onClick={() => navigate("/dashboard/attendance")}  />
      </div>

      {/* ── Employees Preview ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Employees</h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1 text-xs sm:text-sm"
            onClick={() => navigate("/dashboard/employees")}>
            View all <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {employees.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">
            No employees found. Import employees first.
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-left">Badge #</th>
                    <th className="px-4 py-3 text-left">Machine ID</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Shift</th>
                    <th className="px-4 py-3 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 6).map((emp: any) => (
                    <tr key={emp.user_id}
                      className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer"
                      onClick={() => navigate("/dashboard/employees")}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{emp.badge_number || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.user_id}</td>
                      <td className="px-4 py-3 font-medium">{emp.name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.department_id ? deptMap[emp.department_id] || "—" : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {emp.shift ? SHIFT_LABELS[emp.shift] || emp.shift : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          emp.role === "admin" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                        }`}>
                          {emp.role || "user"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — shown only on mobile */}
            <div className="sm:hidden">
              {employees.slice(0, 6).map((emp: any) => (
                <EmployeeCard
                  key={emp.user_id}
                  emp={emp}
                  deptMap={deptMap}
                  onClick={() => navigate("/dashboard/employees")}
                />
              ))}
            </div>

            {employees.length > 6 && (
              <div className="px-4 py-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-primary gap-1 w-full justify-center text-xs sm:text-sm"
                  onClick={() => navigate("/dashboard/employees")}>
                  Show all {employees.length} employees <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Month Attendance Preview ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            <span className="hidden xs:inline">Current Month </span>Attendance
          </h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1 text-xs sm:text-sm"
            onClick={() => navigate("/dashboard/attendance")}>
            View all <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {attendance.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">
            No attendance data for this month yet.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-left">Badge #</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Clock In</th>
                    <th className="px-4 py-3 text-left">Clock Out</th>
                    <th className="px-4 py-3 text-left">Hours</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.slice(0, 6).map((row: any, i: number) => (
                    <tr key={i}
                      className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer"
                      onClick={() => navigate("/dashboard/attendance")}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{row.badge_number || "—"}</td>
                      <td className="px-4 py-3 font-medium">{row.employee_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                      <td className="px-4 py-3">
                        {row.clock_in
                          ? new Date(row.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.clock_out
                          ? new Date(row.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.hours_worked != null ? `${row.hours_worked}h` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === "present" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden">
              {attendance.slice(0, 6).map((row: any, i: number) => (
                <AttendanceCard
                  key={i}
                  row={row}
                  onClick={() => navigate("/dashboard/attendance")}
                />
              ))}
            </div>

            {attendance.length > 6 && (
              <div className="px-4 py-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-primary gap-1 w-full justify-center text-xs sm:text-sm"
                  onClick={() => navigate("/dashboard/attendance")}>
                  Show all {attendance.length} records <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}