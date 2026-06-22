import { useState, useEffect, useRef } from "react";
import { importUsers, importAttendance, getImportStatus } from "@/lib/api";
import {
  Upload, Users, LogIn, LogOut, CheckCircle2,
  SkipForward, XCircle, AlertTriangle, Loader2, Clock, ShieldAlert
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
            Confirm the file is the correct one, rename it exactly as required, then try again.
          </p>
        </div>

        <Button className="w-full" onClick={onClose}>
          Got it, I'll fix it
        </Button>
      </div>
    </div>
  );
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Reads the first N lines of an attendance .dat file (text format)
 * and checks whether the punch status column matches the expected value.
 *   clock_in  → status column should be "0"
 *   clock_out → status column should be "1"
 *
 * We sample the first 20 non-empty lines to avoid reading the whole file.
 * If the majority don't match, we reject.
 */
async function validateAttendanceContent(
  file: File,
  expectedType: "clock_in" | "clock_out"
): Promise<{ valid: boolean; reason?: string }> {
  const expectedStatus = expectedType === "clock_in" ? "0" : "1";
  const labelMap = { "0": "check-in (0)", "1": "check-out (1)" };

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text   = (e.target?.result as string) || "";
      const lines  = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const sample = lines.slice(0, 20);

      if (sample.length === 0) {
        resolve({ valid: false, reason: "The file appears to be empty." });
        return;
      }

      let matches   = 0;
      let mismatches = 0;

      for (const line of sample) {
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue; // not enough columns to check
        const status = parts[4];
        if (status === expectedStatus) matches++;
        else if (status === "0" || status === "1") mismatches++;
      }

      // If we have clear mismatches and no matches, it's the wrong file
      if (mismatches > 0 && matches === 0) {
        const foundLabel    = expectedStatus === "0" ? "check-out (1)" : "check-in (0)";
        const expectedLabel = labelMap[expectedStatus];
        resolve({
          valid : false,
          reason: `This file contains ${foundLabel} records but you're trying to import it as ${expectedType.replace("_", " ")}. The punch status column shows "${expectedStatus === "0" ? "1" : "0"}" but expected "${expectedStatus}" (${expectedLabel}). Please upload the correct file.`,
        });
        return;
      }

      resolve({ valid: true });
    };
    reader.onerror = () => resolve({ valid: true }); // don't block on read error
    reader.readAsText(file);
  });
}

// ─── Import Card ──────────────────────────────────────────────────────────────
function ImportCard({
  title, subtitle, warning, instruction, icon: Icon,
  onImport, accept, requiredFilename, importType,
}: {
  title: string; subtitle: string; warning?: string; instruction?: string;
  icon: any; onImport: (file: File) => Promise<any>; accept: string;
  requiredFilename: string;                           // exact name required
  importType?: "clock_in" | "clock_out" | "users";   // for content validation
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
    e.target.value = ""; // reset input immediately so same file can be reselected

    // ── 1. Exact filename check ──────────────────────────────────────────────
    if (file.name.toLowerCase() !== requiredFilename.toLowerCase()) {
      setRejection({
        title  : "Wrong filename",
        message: `Expected a file named exactly "${requiredFilename}" but got "${file.name}". Please rename your file correctly before importing.`,
      });
      return;
    }

    // ── 2. Content validation for attendance files ───────────────────────────
    if (importType === "clock_in" || importType === "clock_out") {
      const check = await validateAttendanceContent(file, importType);
      if (!check.valid) {
        setRejection({
          title  : "Wrong file content",
          message: check.reason || "The file content does not match the expected import type.",
        });
        return;
      }
    }

    // ── 3. All good — proceed ────────────────────────────────────────────────
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
          }`}>
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

      {/* Rejection dialog — rendered outside the card so it overlays correctly */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ImportData() {
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
            importType="users"
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
            importType="clock_in"
          />
          <ImportCard
            title="Import Clock-Out"
            subtitle="Upload the renamed clock_out.dat file from your evening / sign-out machine."
            instruction="Rename file → clock_out.dat before uploading"
            icon={LogOut}
            onImport={(file) => importAttendance(file, "clock_out")}
            accept=".dat"
            requiredFilename="clock_out.dat"
            importType="clock_out"
          />
        </div>
      </div>
    </div>
  );
}