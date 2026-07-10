import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ShieldCheck, Activity, Trash2, Search,
  ChevronLeft, ChevronRight, AlertTriangle
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry {
  id          : number;
  action      : string;
  performed_by: string;
  target_type : string | null;
  target_label: string | null;
  target_id   : string | null;
  old_value   : any;
  new_value   : any;
  notes       : string | null;
  timestamp   : string;
}

interface LogPage {
  total    : number;
  page     : number;
  page_size: number;
  pages    : number;
  logs     : LogEntry[];
}

interface AuditSummary {
  critical_logs: { total: number; latest: string | null };
  activity_logs: { total: number; purgeable_count: number; latest: string | null };
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function getCriticalLogs(page: number, search: string): Promise<LogPage> {
  const q = new URLSearchParams({ page: String(page), page_size: "30" });
  if (search) q.set("performed_by", search);
  return request(`/audit/critical?${q}`);
}

async function getActivityLogs(page: number, search: string): Promise<LogPage> {
  const q = new URLSearchParams({ page: String(page), page_size: "30" });
  if (search) q.set("performed_by", search);
  return request(`/audit/activity?${q}`);
}

async function getAuditSummary(): Promise<AuditSummary> {
  return request("/audit/summary");
}

async function purgeActivityLogs(days: number) {
  return request(`/audit/activity/purge?older_than_days=${days}`, { method: "DELETE" });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function actionColor(action: string): string {
  if (action.includes("deleted") || action.includes("archived") || action.includes("purged") || action.includes("suspended"))
    return "bg-destructive/15 text-destructive";
  if (action.includes("created") || action.includes("approved") || action.includes("imported"))
    return "bg-green-500/15 text-green-500";
  if (action.includes("updated") || action.includes("changed") || action.includes("exported"))
    return "bg-yellow-500/15 text-yellow-500";
  return "bg-secondary text-muted-foreground";
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ log, expanded, onToggle }: {
  log     : LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${actionColor(log.action)}`}>
            {log.action.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{log.performed_by}</span>
          {log.target_label && (
            <span className="text-xs text-foreground font-medium truncate">
              → {log.target_label}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatTs(log.timestamp)}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {log.notes && (
            <p className="text-xs text-muted-foreground italic">{log.notes}</p>
          )}
          {(log.old_value || log.new_value) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {log.old_value && (
                <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-2">
                  <p className="text-xs text-destructive font-medium mb-1">Before</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(log.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_value && (
                <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-2">
                  <p className="text-xs text-green-500 font-medium mb-1">After</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(log.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          {log.target_id && (
            <p className="text-xs text-muted-foreground font-mono">
              Target ID: {log.target_id} · Type: {log.target_type}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Log List with pagination ─────────────────────────────────────────────────
function LogList({ fetcher }: { fetcher: (page: number, search: string) => Promise<LogPage> }) {
  const [data, setData]         = useState<LogPage | null>(null);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [draft, setDraft]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async (p: number, s: string) => {
    setLoading(true);
    try {
      const result = await fetcher(p, s);
      setData(result);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page, search); }, [page, search]);

  const handleSearch = () => {
    setPage(1);
    setSearch(draft);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>Search</Button>
        {search && (
          <Button variant="ghost" onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Log table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/50">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="px-4 py-3 animate-pulse">
                <div className="h-4 bg-secondary/50 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No log entries found.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data.logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                expanded={expanded === log.id}
                onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {data.pages} · {data.total} entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={page >= data.pages}
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

// ─── Purge Dialog ─────────────────────────────────────────────────────────────
function PurgeDialog({
  purgeableCount, onConfirm, onCancel, loading,
}: {
  purgeableCount: number;
  onConfirm     : (days: number) => void;
  onCancel      : () => void;
  loading       : boolean;
}) {
  const [days, setDays] = useState(90);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Purge Activity Logs</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Delete logs older than</p>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full bg-secondary text-foreground rounded-lg px-3 py-2 text-sm border border-border"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days (recommended)</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>

        {purgeableCount > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="text-destructive font-semibold">{purgeableCount} entries</span> are
            currently eligible for purge at the 90-day threshold.
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
            onClick={() => onConfirm(days)}
            disabled={loading}
          >
            {loading ? "Purging..." : "Purge Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = "critical" | "activity";

export default function AuditPage() {
  const [tab, setTab]             = useState<Tab>("critical");
  const [summary, setSummary]     = useState<AuditSummary | null>(null);
  const [showPurge, setShowPurge] = useState(false);
  const [purging, setPurging]     = useState(false);

  useEffect(() => {
    getAuditSummary().then(setSummary).catch(() => {});
  }, []);

  const handlePurge = async (days: number) => {
    setPurging(true);
    try {
      const result = await purgeActivityLogs(days);
      toast.success(`Purged ${result.deleted_count} activity log entries`);
      setShowPurge(false);
      const updated = await getAuditSummary();
      setSummary(updated);
    } catch {
      toast.error("Purge failed");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete record of all system actions
          </p>
        </div>
        {tab === "activity" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setShowPurge(true)}
          >
            <Trash2 className="h-4 w-4" />
            Purge Old Logs
            {summary?.activity_logs.purgeable_count
              ? ` (${summary.activity_logs.purgeable_count})`
              : ""
            }
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Critical Logs</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.critical_logs.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Permanent · never purged</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Activity Logs</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.activity_logs.total}</p>
            {summary.activity_logs.purgeable_count > 0 && (
              <p className="text-xs text-destructive mt-0.5">
                {summary.activity_logs.purgeable_count} eligible for purge
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-secondary/50 p-1">
        <button
          onClick={() => setTab("critical")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === "critical"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Critical
        </button>
        <button
          onClick={() => setTab("activity")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === "activity"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" />
          Activity
        </button>
      </div>

      {/* Log list */}
      {tab === "critical" && <LogList fetcher={getCriticalLogs} />}
      {tab === "activity" && <LogList fetcher={getActivityLogs} />}

      {/* Purge dialog */}
      {showPurge && (
        <PurgeDialog
          purgeableCount = {summary?.activity_logs.purgeable_count || 0}
          onConfirm      = {handlePurge}
          onCancel       = {() => setShowPurge(false)}
          loading        = {purging}
        />
      )}
    </div>
  );
}