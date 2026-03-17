import { useEffect, useState } from "react";
import { getHolidays, createHoliday, deleteHoliday } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function Holidays() {
  const now                             = new Date();
  const [year, setYear]                 = useState(now.getFullYear());
  const [holidays, setHolidays]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [name, setName]                 = useState("");
  const [dateVal, setDateVal]           = useState("");
  const [saving, setSaving]             = useState(false);

  const load = () => {
    getHolidays()
      .then((h) => setHolidays(h || []))
      .catch(() => toast.error("Failed to load holidays"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Filter holidays by selected year
  const forYear = holidays.filter((h) => new Date(h.date).getFullYear() === year);

  // Group by month
  const byMonth: Record<number, any[]> = {};
  forYear.forEach((h) => {
    const m = new Date(h.date).getMonth(); // 0-indexed
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(h);
  });

  const handleSave = async () => {
    if (!name.trim() || !dateVal) return;
    setSaving(true);
    try {
      await createHoliday({ name: name.trim(), date: dateVal });
      toast.success("Holiday added");
      setModalOpen(false);
      setName("");
      setDateVal("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteHoliday(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
      setConfirmDelete(null);
      load();
    } catch { toast.error("Delete failed"); }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long",
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Public Holidays</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {forYear.length} holiday{forYear.length !== 1 ? "s" : ""} in {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year picker */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(year - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground w-12 text-center">{year}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setYear(year + 1)}
              disabled={year >= now.getFullYear() + 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Add holiday */}
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setName(""); setDateVal(""); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Add Holiday</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-foreground">Add Public Holiday</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-foreground">Holiday Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Christmas Day"
                    className="mt-1"
                    onKeyDown={(e) => e.key === "Enter" && !saving && name.trim() && dateVal && handleSave()}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Date</Label>
                  <Input
                    type="date"
                    value={dateVal}
                    onChange={(e) => setDateVal(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !dateVal}
                >
                  {saving ? "Saving..." : "Add Holiday"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {forYear.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-foreground">No holidays for {year}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add public holidays so they are excluded from expected work day calculations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byMonth)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([monthIdx, items]) => (
              <div key={monthIdx} className="glass-card rounded-xl overflow-hidden">
                {/* Month header */}
                <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                  <h2 className="text-sm font-semibold text-foreground">
                    {MONTHS[Number(monthIdx)]}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {items.length} holiday{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Holidays list */}
                <div className="divide-y divide-border/50">
                  {items
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((h: any) => {
                      const d       = new Date(h.date);
                      const day     = d.getDate();
                      const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
                      const isPast  = d < now;
                      return (
                        <div key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/20">
                          <div className="flex items-center gap-4">
                            {/* Date badge */}
                            <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg text-center shrink-0 ${
                              isPast ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"
                            }`}>
                              <span className="text-xs leading-none">{weekday}</span>
                              <span className="text-base font-semibold leading-tight">{day}</span>
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                                {h.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(h.date)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfirmDelete(h)}
                            className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Remove Holiday</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-semibold text-foreground">{confirmDelete?.name}</span> ({confirmDelete?.date}) from the holiday calendar? This will affect expected work day calculations for all employees.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}