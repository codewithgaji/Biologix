/**
 * DbAdmin.tsx
 * Superuser-only database administration panel.
 * Priority 1: DB stats — total size + per-table breakdown.
 * Priority 2: Attendance purge by date range, with preview + confirmation.
 * Priority 3 & 5: Manual + scheduled backups via pg_dump, with history.
 */

import { useEffect, useState } from "react";
import { Database, HardDrive, Table2, AlertTriangle, Trash2, X, CalendarRange, DownloadCloud, History } from "lucide-react";
import { previewAttendancePurge, purgeAttendance, getBackupHistory, downloadBackup, downloadHistoricalBackup } from "@/lib/api";

// ── API helper (same pattern as Analytics.tsx) ───────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
function getToken() { return localStorage.getItem("biologix_token"); }
async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return r.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TableStat {
  table_name: string;
  row_count : number;
  total_size: string;
  size_bytes: number;
}
interface DbStatsResponse {
  total_size: string;
  tables    : TableStat[];
}
interface BackupRecord {
  id        : number;
  filename  : string;
  size_bytes: number;
  created_at: string;
}

// ── Formatting helper ────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

// ── Skeleton (matches Analytics.tsx) ─────────────────────────────────────────
function Skeleton({ h = "h-40", className = "" }: { h?: string; className?: string }) {
  return <div className={`${h} ${className} rounded-xl bg-secondary/40 animate-pulse`} />;
}

// ── Section header (matches Analytics.tsx) ───────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Table row bar (proportional to largest table) ────────────────────────────
function TableRow({ table, maxBytes }: { table: TableStat; maxBytes: number }) {
  const isAttendance = table.table_name === "attendance_logs";
  const widthPct = maxBytes > 0 ? (table.size_bytes / maxBytes) * 100 : 0;

  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-40 shrink-0 flex items-center gap-2">
        <Table2 className={`h-3.5 w-3.5 shrink-0 ${isAttendance ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-sm truncate ${isAttendance ? "text-foreground font-semibold" : "text-foreground"}`}>
          {table.table_name}
        </span>
      </div>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isAttendance ? "bg-primary" : "bg-teal-400/70"}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-xs text-muted-foreground text-right">
        {table.row_count.toLocaleString()} rows
      </span>
      <span className="w-20 shrink-0 text-xs font-semibold text-foreground text-right">
        {table.total_size}
      </span>
    </div>
  );
}

// ── Modal wrapper (matches Analytics.tsx) ────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/70 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Attendance Purge Panel
// ══════════════════════════════════════════════════════════════════════════════
function PurgePanel({ onPurged }: { onPurged: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [preview, setPreview]   = useState<{ count: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging]   = useState(false);
  const [result, setResult]     = useState<{ deleted: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const canCheck = dateFrom && dateTo && dateFrom <= dateTo;

  const handleCheck = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await previewAttendancePurge(dateFrom, dateTo);
      setPreview({ count: res.count });
    } catch (e: any) {
      setError(e.message || "Failed to preview purge");
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmPurge = async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await purgeAttendance(dateFrom, dateTo);
      setResult({ deleted: res.deleted });
      setConfirming(false);
      setPreview(null);
      onPurged();
    } catch (e: any) {
      setError(e.message || "Failed to purge records");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <SectionHeader
        icon={<Trash2 className="h-4 w-4" />}
        title="Purge Attendance Data"
        subtitle="Permanently delete attendance_logs within a date range"
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPreview(null); setResult(null); }}
            className="text-sm bg-secondary text-foreground rounded-lg px-3 py-1.5 border border-border"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPreview(null); setResult(null); }}
            className="text-sm bg-secondary text-foreground rounded-lg px-3 py-1.5 border border-border"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={!canCheck || checking}
          className="flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {checking ? "Checking…" : "Preview count"}
        </button>
      </div>

      {dateFrom && dateTo && dateFrom > dateTo && (
        <p className="text-xs text-red-500 mb-3">"From" date must be before "To" date.</p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {preview && (
        <div className="flex items-center justify-between bg-secondary/40 rounded-xl p-4 mb-3">
          <div>
            <p className="text-sm text-foreground">
              <strong className="text-xl font-bold">{preview.count.toLocaleString()}</strong> records match this range
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{dateFrom} to {dateTo}</p>
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={preview.count === 0}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge {preview.count === 0 ? "" : `${preview.count.toLocaleString()} records`}
          </button>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 rounded-lg px-4 py-3">
          Purged <strong>{result.deleted.toLocaleString()}</strong> records successfully.
        </div>
      )}

      {confirming && (
        <Modal title="Confirm permanent purge" onClose={() => setConfirming(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">
                This will permanently delete <strong>{preview?.count.toLocaleString()}</strong> attendance
                records between <strong>{dateFrom}</strong> and <strong>{dateTo}</strong>. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurge}
                disabled={purging}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {purging ? "Purging…" : "Yes, permanently delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Backup Panel — manual download + scheduled backup history
// ══════════════════════════════════════════════════════════════════════════════
function BackupPanel() {
  const [history, setHistory] = useState<BackupRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = () => {
    setLoading(true);
    getBackupHistory()
      .then(setHistory)
      .catch((e) => setError(e.message || "Failed to load backup history"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, []);

  const handleManualBackup = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadBackup();
      // Manual downloads aren't stored in db_backups (only scheduled ones are),
      // so no need to refresh history here.
    } catch (e: any) {
      setError(e.message || "Failed to download backup");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <SectionHeader
        icon={<DownloadCloud className="h-4 w-4" />}
        title="Database Backup"
        subtitle="pg_dump export, scoped to BioLogix tables only"
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleManualBackup}
        disabled={downloading}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 mb-6"
      >
        <DownloadCloud className="h-4 w-4" />
        {downloading ? "Generating backup…" : "Download backup now"}
      </button>

      <div className="flex items-center gap-2 mb-3">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Scheduled Backup History
        </p>
      </div>

      {loading ? (
        <Skeleton h="h-32" />
      ) : history?.length ? (
        <div className="divide-y divide-border/50">
          {history.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm text-foreground">{b.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString()} · {formatBytes(b.size_bytes)}
                </p>
              </div>
              <button
                onClick={() => downloadHistoricalBackup(b.id, b.filename)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-foreground"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          No scheduled backups yet. The first one runs Sunday at 3AM.
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main DB Admin Page
// ══════════════════════════════════════════════════════════════════════════════
export default function DbAdmin() {
  const [stats, setStats]     = useState<DbStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const loadStats = () => {
    setLoading(true);
    setError(null);
    api<DbStatsResponse>("/db-admin/stats")
      .then(setStats)
      .catch((e) => setError(e.message || "Failed to load DB stats"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const maxBytes = stats?.tables.length
    ? Math.max(...stats.tables.map((t) => t.size_bytes))
    : 0;

  return (
    <div className="space-y-8 pb-12">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DB Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Database size, table breakdown & maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">Superuser only</span>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* ── Total size stat card ── */}
      {loading ? (
        <Skeleton h="h-24" />
      ) : stats && (
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{stats.total_size}</p>
            <p className="text-xs text-muted-foreground mt-1">Total database size</p>
          </div>
        </div>
      )}

      {/* ── Table breakdown ── */}
      <div className="glass-card rounded-2xl p-5">
        <SectionHeader
          icon={<Table2 className="h-4 w-4" />}
          title="Table Breakdown"
          subtitle="Sorted by size, largest first"
        />
        {loading ? (
          <Skeleton h="h-64" />
        ) : stats?.tables.length ? (
          <div className="divide-y divide-border/50">
            {stats.tables.map((t) => (
              <TableRow key={t.table_name} table={t} maxBytes={maxBytes} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No table data available.</p>
        )}
      </div>

      {/* ── Attendance purge ── */}
      <PurgePanel onPurged={loadStats} />

      {/* ── Backups ── */}
      <BackupPanel />

    </div>
  );
}