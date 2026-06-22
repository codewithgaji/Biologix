import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getArchivedEmployees, triggerManualPurge } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search, Trash2, AlertTriangle, Archive,
  User, Clock, ChevronRight, Shield
} from "lucide-react";

interface ArchivedEmployeeSummary {
  id              : number;
  original_user_id: number;
  badge_number    : string;
  name            : string | null;
  position        : string | null;
  department_name : string | null;
  archived_at     : string;
  archived_by     : string | null;
  retention_days  : number;
  purge_after     : string;
  log_count       : number | null;
}

function daysRemaining(purgeAfter: string): number {
  return Math.ceil((new Date(purgeAfter).getTime() - Date.now()) / 86400000);
}

function RetentionBadge({ purgeAfter }: { purgeAfter: string }) {
  const days = daysRemaining(purgeAfter);
  const color = days > 14
    ? "bg-green-500/15 text-green-500"
    : days > 3
    ? "bg-yellow-500/15 text-yellow-500"
    : "bg-destructive/15 text-destructive";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {days > 0 ? `${days}d left` : "Expired"}
    </span>
  );
}

export default function ArchivePage() {
  const navigate              = useNavigate();
  const [records, setRecords] = useState<ArchivedEmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [search, setSearch]   = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getArchivedEmployees();
      setRecords(data);
    } catch {
      toast.error("Failed to load archive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePurge = async () => {
    setPurging(true);
    setShowConfirm(false);
    try {
      const result = await triggerManualPurge();
      toast.success(`Purged ${result.purged_employees} employees and ${result.purged_logs} logs`);
      await load();
    } catch {
      toast.error("Purge failed");
    } finally {
      setPurging(false);
    }
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return !q
      || (r.name || "").toLowerCase().includes(q)
      || r.badge_number.includes(q)
      || (r.department_name || "").toLowerCase().includes(q);
  });

  const expiredCount = records.filter((r) => daysRemaining(r.purge_after) <= 0).length;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Archived Employees</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {records.length} archived · {expiredCount > 0 && (
              <span className="text-destructive font-medium">{expiredCount} eligible for purge</span>
            )}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={() => setShowConfirm(true)}
          disabled={purging || expiredCount === 0}
        >
          <Trash2 className="h-4 w-4" />
          {purging ? "Purging…" : `Run Purge${expiredCount > 0 ? ` (${expiredCount})` : ""}`}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, badge or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-secondary/40 rounded-xl px-4 py-3">
        <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Archived records are read-only and cannot be restored. They are permanently deleted after their retention period expires.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-32 bg-secondary/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {search ? "No archived employees match your search." : "No archived employees yet."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass-card rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Badge #</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Archived</th>
                    <th className="px-4 py-3 text-left">Archived By</th>
                    <th className="px-4 py-3 text-left">Logs</th>
                    <th className="px-4 py-3 text-left">Retention</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/dashboard/archive/${r.id}`)}
                      className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{r.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{r.position || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.badge_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.department_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(r.archived_at).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.archived_by || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                          {r.log_count ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RetentionBadge purgeAfter={r.purge_after} />
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/dashboard/archive/${r.id}`)}
                className="w-full text-left glass-card rounded-xl p-4 space-y-3 hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{r.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.position || r.department_name || "—"}</p>
                    </div>
                  </div>
                  <RetentionBadge purgeAfter={r.purge_after} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">#{r.badge_number}</span>
                  <span>{r.log_count ?? 0} logs</span>
                  <span>by {r.archived_by || "—"}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Purge confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Run Manual Purge?</h3>
                <p className="text-xs text-muted-foreground">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-semibold text-destructive">{expiredCount} expired archive record{expiredCount > 1 ? "s" : ""}</span> and all their associated attendance logs.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                onClick={handlePurge}
              >
                Purge Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}