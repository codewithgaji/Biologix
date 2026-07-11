import { useEffect, useState } from "react";
import { getDepartments, getEmployees, createDepartment, updateDepartment, deleteDepartment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search, Users, ArrowLeft, IdCard } from "lucide-react";

export default function Departments() {
  const [departments, setDepartments]   = useState<any[]>([]);
  const [employees, setEmployees]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [empSearch, setEmpSearch]       = useState("");
  const [activeDept, setActiveDept]     = useState<any>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editing, setEditing]           = useState<any>(null);
  const [name, setName]                 = useState("");
  const [reportable, setReportable]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const load = () => {
  Promise.all([getDepartments(), getEmployees()])
    .then(([depts, emps]) => {
      // Count employees per department and attach to dept object
      const empsArray = emps || [];
      const deptsWithCount = (depts || []).map((d: any) => ({
        ...d,
        employee_count: empsArray.filter((e: any) => e.department_id === d.id).length,
      }));
      setDepartments(deptsWithCount);
      setEmployees(empsArray);
    })
    .catch(() => toast.error("Failed to load"))
    .finally(() => setLoading(false));
};

  useEffect(() => { load(); }, []);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const deptEmployees = activeDept
    ? employees.filter((e) =>
        e.department_id === activeDept.id &&
        (
          (e.name         || "").toLowerCase().includes(empSearch.toLowerCase()) ||
          (e.badge_number || "").toString().includes(empSearch) ||
          (e.user_id      || "").toString().includes(empSearch)
        )
      )
    : [];

  const openCreate = () => { setEditing(null); setName(""); setReportable(false); setModalOpen(true); };
  const openEdit   = (d: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(d); setName(d.name); setReportable(d.is_reportable); setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment(editing.id, { name, is_reportable: reportable });
        toast.success("Department updated");
        if (activeDept?.id === editing.id) setActiveDept({ ...activeDept, name, is_reportable: reportable });
      } else {
        await createDepartment({ name, is_reportable: reportable });
        toast.success("Department created");
      }
      setModalOpen(false);
      load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDepartment(confirmDelete.id);
      toast.success(`${confirmDelete.name} deleted`);
      setConfirmDelete(null);
      if (activeDept?.id === confirmDelete.id) setActiveDept(null);
      load();
    } catch { toast.error("Delete failed"); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  );

  // ── Department detail view ──────────────────────────────────────────────────
  if (activeDept) {
    const fullDept = departments.find((d) => d.id === activeDept.id) || activeDept;
    return (
      <div className="space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveDept(null); setEmpSearch(""); }}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{fullDept.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  fullDept.is_reportable
                    ? "bg-success/15 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {fullDept.is_reportable ? "Reportable" : "Not reportable"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {fullDept.employee_count ?? 0} employee{fullDept.employee_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-9 sm:ml-0">
            <Button variant="outline" size="sm" onClick={(e) => openEdit(fullDept, e)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline" size="sm"
              className="text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => setConfirmDelete(fullDept)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Search employees */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, badge or machine ID..."
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Employee list */}
        <div className="glass-card rounded-xl overflow-hidden">
          {deptEmployees.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">
                {empSearch ? `No employees matching "${empSearch}"` : "No employees in this department"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 text-left">Badge #</th>
                      <th className="px-4 py-3 text-left">Machine ID</th>
                      <th className="px-4 py-3 text-left">Full Name</th>
                      <th className="px-4 py-3 text-left">Shift</th>
                      <th className="px-4 py-3 text-left">Work Days</th>
                      <th className="px-4 py-3 text-left">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmployees.map((emp: any) => (
                      <tr key={emp.user_id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-4 py-3 font-mono text-xs">{emp.badge_number || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.user_id}</td>
                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {emp.shift
                            ? { morning: "Morning", afternoon: "Afternoon", night: "Night", day: "Day" }[emp.shift as string] ?? emp.shift
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {emp.work_days === "mon_fri" ? "Mon – Fri" : emp.work_days === "mon_sat" ? "Mon – Sat" : "—"}
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
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/50">
                {deptEmployees.map((emp: any) => (
                  <div key={emp.user_id} className="p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(emp.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{emp.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          Badge {emp.badge_number || "—"}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <IdCard className="h-3 w-3" />
                          {emp.user_id}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground capitalize">{emp.shift || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.work_days === "mon_fri" ? "Mon–Fri" : emp.work_days === "mon_sat" ? "Mon–Sat" : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Edit / delete dialogs */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit Department</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-foreground">Department Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && !saving && name.trim() && handleSave()} />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <Switch checked={reportable} onCheckedChange={setReportable} />
                <div>
                  <Label className="text-foreground">Reportable</Label>
                  <p className="text-xs text-muted-foreground">Include in attendance reports</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Department</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDelete?.name}</span>?
              {confirmDelete?.employee_count > 0 && (
                <span className="block mt-1 text-warning">
                  This department has {confirmDelete.employee_count} employee{confirmDelete.employee_count !== 1 ? "s" : ""} assigned to it.
                </span>
              )}
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Department list view ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{departments.length} total</p>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">New Department</span>
              <span className="sm:hidden">New</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editing ? "Edit Department" : "New Department"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-foreground">Department Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering"
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && !saving && name.trim() && handleSave()}
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <Switch checked={reportable} onCheckedChange={setReportable} />
                <div>
                  <Label className="text-foreground cursor-pointer">Reportable</Label>
                  <p className="text-xs text-muted-foreground">Include in attendance reports</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Department"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-muted-foreground">
          {search
            ? <><p className="font-medium">No results for "{search}"</p><p className="text-sm mt-1">Try a different search term</p></>
            : <><Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="font-medium">No departments yet</p><p className="text-sm mt-1">Create one to get started</p></>
          }
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((d: any) => (
            <div
              key={d.id}
              onClick={() => { setActiveDept(d); setEmpSearch(""); }}
              className="glass-card rounded-xl p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 border border-transparent transition-all cursor-pointer"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground truncate">{d.name}</h3>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => openEdit(d, e)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}
                    className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{d.employee_count ?? 0} employee{d.employee_count !== 1 ? "s" : ""}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  d.is_reportable
                    ? "bg-success/15 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {d.is_reportable ? "Reportable" : "Not reportable"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Department</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDelete?.name}</span>?
            {confirmDelete?.employee_count > 0 && (
              <span className="block mt-1 text-warning">
                This department has {confirmDelete.employee_count} employee{confirmDelete.employee_count !== 1 ? "s" : ""} assigned to it.
              </span>
            )}
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}