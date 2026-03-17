import { useState, useEffect } from "react";
import { getDepartments, exportAttendance } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

type ExportType = "month" | "range" | "year";

export default function Export() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptId, setDeptId] = useState("");
  const [exportType, setExportType] = useState<ExportType>("month");
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"));
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDepartments().then((d) => setDepartments(d || [])).catch(() => {});
  }, []);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (deptId) params.department_id = deptId;

      if (exportType === "month") {
        params.month = month;
        params.year = year;
      } else if (exportType === "range") {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      } else {
        params.year = year;
      }

      const blob = await exportAttendance(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_export.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const types: { value: ExportType; label: string }[] = [
    { value: "month", label: "By Month" },
    { value: "range", label: "By Date Range" },
    { value: "year", label: "Full Year" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Export Attendance</h1>

      <div className="glass-card rounded-xl p-6 max-w-xl space-y-5">
        {/* Department */}
        <div>
          <Label className="text-foreground">Department (optional)</Label>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full mt-1 bg-secondary text-foreground rounded-md px-3 py-2 text-sm border border-border"
          >
            <option value="">All Departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Export type toggle */}
        <div>
          <Label className="text-foreground mb-2 block">Export Type</Label>
          <div className="flex gap-2">
            {types.map((t) => (
              <button
                key={t.value}
                onClick={() => setExportType(t.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportType === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic fields */}
        {exportType === "month" && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-foreground">Month</Label>
              <Input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label className="text-foreground">Year</Label>
              <Input type="number" min="2000" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {exportType === "range" && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label className="text-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {exportType === "year" && (
          <div>
            <Label className="text-foreground">Year</Label>
            <Input type="number" min="2000" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1" />
          </div>
        )}

        <Button className="w-full" onClick={handleExport} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          {loading ? "Generating..." : "Export"}
        </Button>
      </div>
    </div>
  );
}
