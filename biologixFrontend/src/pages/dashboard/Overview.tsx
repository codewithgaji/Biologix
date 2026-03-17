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
      className={`glass-card rounded-xl p-5 text-left w-full transition-all hover:scale-[1.02] hover:shadow-lg ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </button>
  );
}

const SHIFT_LABELS: Record<string, string> = {
  morning  : "Morning",
  afternoon: "Afternoon",
  night    : "Night",
  day      : "Day",
};

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats]       = useState({ employees: 0, departments: 0, present: 0, absent: 0 });
  const [employees, setEmployees]   = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [attendance, setAttendance]   = useState<any[]>([]);
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

  // Build a department lookup map id → name
  const deptMap = departments.reduce((acc: Record<number, string>, d: any) => {
    acc[d.id] = d.name;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}     label="Total Employees"   value={stats.employees}   color="bg-primary/15 text-primary"            onClick={() => navigate("/dashboard/employees")}   />
        <StatCard icon={Building2} label="Total Departments" value={stats.departments} color="bg-secondary text-secondary-foreground" onClick={() => navigate("/dashboard/departments")} />
        <StatCard icon={UserCheck} label="Present Today"     value={stats.present}     color="bg-success/15 text-success"            onClick={() => navigate("/dashboard/attendance")}  />
        <StatCard icon={UserX}     label="Absent Today"      value={stats.absent}      color="bg-destructive/15 text-destructive"    onClick={() => navigate("/dashboard/attendance")}  />
      </div>

      {/* Employees Preview */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Employees</h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1"
            onClick={() => navigate("/dashboard/employees")}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {employees.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No employees found. Import employees first.</div>
        ) : (
          <div className="overflow-x-auto">
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
                        emp.role === "admin"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {emp.role || "user"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length > 6 && (
              <div className="px-4 py-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-primary gap-1 w-full justify-center"
                  onClick={() => navigate("/dashboard/employees")}>
                  Show all {employees.length} employees <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Month Attendance Preview */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Current Month Attendance</h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1"
            onClick={() => navigate("/dashboard/attendance")}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {attendance.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No attendance data for this month yet.</div>
        ) : (
          <div className="overflow-x-auto">
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
                        row.status === "present"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendance.length > 6 && (
              <div className="px-4 py-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-primary gap-1 w-full justify-center"
                  onClick={() => navigate("/dashboard/attendance")}>
                  Show all {attendance.length} records <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}