import { useState, useEffect, useRef, useMemo } from "react";
import { importUsers, importAttendance, getImportStatus, getImportHistory, downloadImportFile } from "@/lib/api";
import {
  Upload, Users, LogIn, LogOut, CheckCircle2,
  SkipForward, XCircle, AlertTriangle, Loader2, Clock, ShieldAlert,
  History, ChevronDown, ChevronUp, Download, FileText
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type JobStatus = "idle" | "uploading" | "queued" | "processing" | "done" | "error";

interface ImportResult {
  inserted?: number;
  skipped ?: number;
  errors  ?: number;
  type    ?: string;
  detail  ?: string;
}

interface ImportRecord {
  id               : number;
  import_type      : string;   // "users" | "check_in" | "check_out"
  original_filename: string;
  inserted         : number;
  skipped          : number;
  errors           : number;
  imported_by      : string;
  imported_at      : string;
}

// ── month grouping helpers (same as Leaves.tsx) ──────────────────────────────
function getMonthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });
}
function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  users     : { label: "Employees",  icon: Users,  color: "text-primary",   bg: "bg-primary/15" },
  check_in  : { label: "Clock-In",   icon: LogIn,  color: "text-green-500", bg: "bg-green-500/15" },
  check_out : { label: "Clock-Out",  icon: LogOut, color: "text-orange-500",bg: "bg-orange-500/15" },
};

// ─── Rejection Dialog ─────────────────────────────────────────────────────────
function RejectionDialog({
  title, message, onClose,
}: {
  title: string; message: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">Import rejected</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

        <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-3">
          <p className="text-xs text-destructive font-medium">What to do:</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm this is the correct file, rename it exactly as required, then try again.
          </p>
        </div>

        <Button className="w-full" onClick={onClose}>
          Got it, I'll fix it
        </Button>
      </div>
    </div>
  );
}

// ─── Import Card ──────────────────────────────────────────────────────────────
function ImportCard({
  title, subtitle, warning, instruction, icon: Icon,
  onImport, accept, requiredFilename, onComplete,
}: {
  title           : string;
  subtitle        : string;
  warning        ?: string;
  instruction    ?: string;
  icon            : any;
  onImport        : (file: File) => Promise<any>;
  accept          : string;
  requiredFilename: string;
  onComplete      : () => void;
}) {
  const [status, setStatus]       = useState<JobStatus>("idle");
  const [result, setResult]       = useState<ImportResult | null>(null);
  const [rejection, setRejection] = useState<{ title: string; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getImportStatus(jobId);
        if (data.status === "done") {
          stopPolling(); setStatus("done"); setResult(data);
          toast.success("Import complete!");
          onComplete();
        } else if (data.status === "error") {
          stopPolling(); setStatus("error");
          setResult({ detail: data.detail });
          toast.error(data.detail || "Import failed");
        } else {
          setStatus(data.status);
        }
      } catch {
        stopPolling(); setStatus("error");
        toast.error("Lost connection while checking import status");
      }
    }, 3000);
  };

  useEffect(() => () => stopPolling(), []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // ── Filename check — only validation needed ──────────────────────────────
    if (file.name.toLowerCase() !== requiredFilename.toLowerCase()) {
      setRejection({
        title  : "Wrong filename",
        message: `Expected a file named exactly "${requiredFilename}" but received "${file.name}". Please rename your file correctly before importing.`,
      });
      return;
    }

    // ── All good — proceed ───────────────────────────────────────────────────
    setStatus("uploading");
    setResult(null);

    try {
      const res = await onImport(file);
      toast.info("File uploaded! Processing in background...");
      setStatus("queued");
      startPolling(res.job_id);
    } catch (err: any) {
      setStatus("error");
      toast.error(err.message || "Upload failed");
    }
  };

  const isProcessing = status === "uploading" || status === "queued" || status === "processing";

  const statusLabel: Record<JobStatus, string> = {
    idle      : "",
    uploading : "Uploading file...",
    queued    : "Queued, waiting to start...",
    processing: "Processing records...",
    done      : "",
    error     : "",
  };

  return (
    <>
      <div className="glass-card rounded-xl p-6 flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>

        <p className="text-sm text-muted-foreground">{subtitle}</p>

        {/* Required filename badge */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/60 border border-border">
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            File must be named exactly{" "}
            <code className="bg-background px-1.5 py-0.5 rounded border border-border font-mono text-foreground">
              {requiredFilename}
            </code>
          </span>
        </div>

        {instruction && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs text-primary font-mono">{instruction}</span>
          </div>
        )}

        {warning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-warning">{warning}</p>
          </div>
        )}

        {/* Upload area */}
        <label className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors
          ${isProcessing
            ? "border-primary/30 cursor-not-allowed"
            : "border-border cursor-pointer hover:border-primary/50"
          }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              {status === "uploading"
                ? <Loader2 className="h-10 w-10 text-primary animate-spin" />
                : <Clock className="h-10 w-10 text-primary animate-pulse" />
              }
              <span className="text-sm text-primary font-medium">{statusLabel[status]}</span>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to upload</span>
              <span className="text-xs text-muted-foreground/60 mt-1 font-mono">{requiredFilename}</span>
            </>
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleFile}
            className="hidden"
            disabled={isProcessing}
          />
        </label>

        {/* Result */}
        {status === "done" && result && (
          <div className="space-y-1.5 text-sm pt-1 border-t border-border">
            {result.type && (
              <p className="text-xs text-muted-foreground mb-1">
                Detected as: <span className="text-primary font-medium">{result.type}</span>
              </p>
            )}
            {result.inserted != null && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> {result.inserted} imported
              </div>
            )}
            {result.skipped != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <SkipForward className="h-4 w-4" /> {result.skipped} skipped
              </div>
            )}
            {result.errors != null && result.errors > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" /> {result.errors} errors
              </div>
            )}
          </div>
        )}

        {status === "error" && result?.detail && (
          <div className="flex items-center gap-2 text-sm text-destructive pt-1 border-t border-border">
            <XCircle className="h-4 w-4" /> {result.detail}
          </div>
        )}
      </div>

      {rejection && (
        <RejectionDialog
          title={rejection.title}
          message={rejection.message}
          onClose={() => setRejection(null)}
        />
      )}
    </>
  );
}

// ─── Import history row ────────────────────────────────────────────────────────
function ImportRow({ record }: { record: ImportRecord }) {
  const meta = TYPE_META[record.import_type] || { label: record.import_type, icon: FileText, color: "text-muted-foreground", bg: "bg-secondary" };
  const Icon = meta.icon;

  const handleDownload = async () => {
    try {
      await downloadImportFile(record.id, record.original_filename);
    } catch (e: any) {
      toast.error(e.message || "Failed to download file");
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
        <Icon className={`h-5 w-5 ${meta.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{record.original_filename}</span>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
          <span>{formatDateTime(record.imported_at)}</span>
          <span>by {record.imported_by}</span>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 className="h-3 w-3" /> {record.inserted} inserted
          </span>
          {record.skipped > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <SkipForward className="h-3 w-3" /> {record.skipped} skipped
            </span>
          )}
          {record.errors > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" /> {record.errors} errors
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="self-start sm:self-center p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
        title="Download original file"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Import month group ────────────────────────────────────────────────────────
function ImportMonthGroup({
  label, records,
}: {
  label  : string;
  records: ImportRecord[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-xl hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
            {records.length} import{records.length !== 1 ? "s" : ""}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="space-y-2 pl-2">
          {records.map((r) => <ImportRow key={r.id} record={r} />)}
        </div>
      )}
    </div>
  );
}

// ─── Import timeline (main history section) ───────────────────────────────────
function ImportTimeline({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getImportHistory()
      .then(setHistory)
      .catch(() => toast.error("Failed to load import history"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, ImportRecord[]>();
    const sorted = [...history].sort(
      (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
    );
    for (const rec of sorted) {
      const key = getMonthKey(rec.imported_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(rec);
    }
    return map;
  }, [history]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Import History
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No imports yet.</p>
          <p className="text-xs mt-1">Every import you run above will show up here, with the original file saved for download.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedByMonth.entries()).map(([key, records]) => (
            <ImportMonthGroup
              key={key}
              label={getMonthLabel(records[0].imported_at)}
              records={records}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ImportData() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import employee records and attendance logs from your ZKTeco biometric machine.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Step 1 — Employees
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImportCard
            title="Import Employees"
            subtitle="Upload the user.dat file from your ZKTeco flash drive to sync employee records."
            warning="Always import employees before importing attendance. Attendance records will be skipped if the employee doesn't exist."
            icon={Users}
            onImport={importUsers}
            accept=".dat"
            requiredFilename="user.dat"
            onComplete={bumpRefresh}
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Step 2 — Attendance
        </h2>
        <div className="p-3 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground mb-4">
          <strong className="text-foreground">Before uploading:</strong> Rename the attendance file from your machine.
          If it's from the <span className="text-primary font-medium">morning / sign-in machine</span>, rename it to{" "}
          <code className="bg-secondary px-1 rounded">clock_in.dat</code>. If it's from the{" "}
          <span className="text-primary font-medium">evening / sign-out machine</span>, rename it to{" "}
          <code className="bg-secondary px-1 rounded">clock_out.dat</code>.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImportCard
            title="Import Clock-In"
            subtitle="Upload the renamed clock_in.dat file from your morning / sign-in machine."
            instruction="Rename file → clock_in.dat before uploading"
            icon={LogIn}
            onImport={(file) => importAttendance(file, "clock_in")}
            accept=".dat"
            requiredFilename="clock_in.dat"
            onComplete={bumpRefresh}
          />
          <ImportCard
            title="Import Clock-Out"
            subtitle="Upload the renamed clock_out.dat file from your evening / sign-out machine."
            instruction="Rename file → clock_out.dat before uploading"
            icon={LogOut}
            onImport={(file) => importAttendance(file, "clock_out")}
            accept=".dat"
            requiredFilename="clock_out.dat"
            onComplete={bumpRefresh}
          />
        </div>
      </div>

      <ImportTimeline refreshKey={refreshKey} />
    </div>
  );
}