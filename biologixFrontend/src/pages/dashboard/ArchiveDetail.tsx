import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getArchivedEmployeeDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, User, Calendar, Clock,
  Building2, Shield, Archive
} from "lucide-react";

interface ArchivedLog {
  id                  : number;
  archived_employee_id: number;
  original_log_id     : number | null;
  original_user_id    : number;
  punch_time          : string | null;
  punch_date          : string | null;
  punch_type          : string | null;
  hours_worked        : number | null;
  raw_data            : Record<string, any> | null;
  archived_at         : string;
}

interface ArchivedEmployeeDetail {
  id              : number;
  original_user_id: number;
  badge_number    : string;
  name            : string | null;
  position        : string | null;
  department_name : string | null;
  shift           : string | null;
  work_days       : string | null;
  archived_at     : string;
  archived_by     : string | null;
  retention_days  : number;
  purge_after     : string;
  attendance_logs : ArchivedLog[];
}

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  const timePart = ts.includes("T") ? ts.split("T")[1] : ts.split(" ")[1];
  if (!timePart) return "—";
  const [h, m] = timePart.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  });
}

export default function ArchiveDetailPage() {
  const { id }              = useParams();
  const navigate            = useNavigate();
  const [record, setRecord] = useState<ArchivedEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getArchivedEmployeeDetail(Number(id))
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
  );

  if (!record) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Archive className="h-8 w-8 text-muted-foreground opacity-40" />
      <p className="text-muted-foreground text-sm">Archive record not found.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/archive")}>
        Back to Archive
      </Button>
    </div>
  );

  const daysLeft    = Math.ceil((new Date(record.purge_after).getTime() - Date.now()) / 86400000);
  const checkIns    = record.attendance_logs.filter((l) => l.punch_type === "check_in");
  const checkOuts   = record.attendance_logs.filter((l) => l.punch_type === "check_out");
  const uniqueDates = new Set(record.attendance_logs.map((l) => l.punch_date)).size;

  // Group logs by date for display
  const logsByDate = record.attendance_logs.reduce((acc, log) => {
    const date = log.punch_date || "unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ArchivedLog[]>);

  const sortedDates = Object.keys(logsByDate).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-4">

      {/* Back */}
      <button
        onClick={() => navigate("/dashboard/archive")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Archive
      </button>

      {/* Profile card */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{record.name || "—"}</h1>
              <p className="text-sm text-muted-foreground">{record.position || "No position"}</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            daysLeft > 14
              ? "bg-green-500/15 text-green-500"
              : daysLeft > 3
              ? "bg-yellow-500/15 text-yellow-500"
              : "bg-destructive/15 text-destructive"
          }`}>
            {daysLeft > 0 ? `Purges in ${daysLeft} days` : "Eligible for purge"}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Badge #</p>
            <p className="font-mono font-semibold text-sm">{record.badge_number}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Department</p>
            <p className="font-medium text-sm">{record.department_name || "—"}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Shift</p>
            <p className="font-medium text-sm capitalize">{record.shift || "—"}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Work Days</p>
            <p className="font-medium text-sm">{record.work_days?.replace("_", " – ") || "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Archived by {record.archived_by || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(record.archived_at).toLocaleDateString("en-GB", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Machine ID {record.original_user_id}
          </span>
        </div>
      </div>

      {/* Attendance stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{uniqueDates}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Days on Record</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{checkIns.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Check-ins</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{checkOuts.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Check-outs</p>
        </div>
      </div>

      {/* Log header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Attendance Logs
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({record.attendance_logs.length} records)
          </span>
        </h2>
      </div>

      {/* Logs grouped by date */}
      {record.attendance_logs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
          No attendance logs were archived for this employee.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((date) => {
            const dayLogs = logsByDate[date].sort(
              (a, b) => new Date(a.punch_time || "").getTime() - new Date(b.punch_time || "").getTime()
            );
            const checkIn  = dayLogs.find((l) => l.punch_type === "check_in");
            const checkOut = dayLogs.find((l) => l.punch_type === "check_out");

            return (
              <div key={date} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(checkIn?.punch_time || null)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="flex items-center gap-1 text-orange-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(checkOut?.punch_time || null)}
                    </span>
                    {checkIn?.raw_data?.punch_type && (
                      <span className="text-muted-foreground capitalize bg-secondary px-2 py-0.5 rounded">
                        {checkIn.raw_data.punch_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}