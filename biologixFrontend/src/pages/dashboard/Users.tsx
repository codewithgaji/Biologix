import { useEffect, useState } from "react";
import {
  getAdminUsers, approveUser, changeUserRole,
  suspendUser, reactivateUser, deleteAdminUser
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  UserCog, Clock, CheckCircle2, XCircle,
  ShieldCheck, Eye, FileDown, Pencil, AlertTriangle, Trash2
} from "lucide-react";

type AdminStatus = "pending" | "active" | "suspended";
type AdminRole   = "viewer" | "editor" | "payroll" | "admin";

interface AdminUser {
  id           : number;
  full_name    : string;
  email        : string;
  role         : AdminRole;
  status       : AdminStatus;
  is_superuser : boolean;
  created_at   : string;
  last_login_at: string | null;
}

const ROLES: AdminRole[] = ["viewer", "editor", "payroll", "admin"];

const roleIcon: Record<AdminRole, any> = {
  viewer : Eye,
  editor : Pencil,
  payroll: FileDown,
  admin  : ShieldCheck,
};

const roleColor: Record<AdminRole, string> = {
  viewer : "bg-secondary text-muted-foreground",
  editor : "bg-green-500/15 text-green-500",
  payroll: "bg-yellow-500/15 text-yellow-500",
  admin  : "bg-primary/15 text-primary",
};

const statusColor: Record<AdminStatus, string> = {
  pending  : "bg-yellow-500/15 text-yellow-500",
  active   : "bg-green-500/15 text-green-500",
  suspended: "bg-destructive/15 text-destructive",
};

// ─── Error Dialog ─────────────────────────────────────────────────────────────
function ErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Action Failed</h3>
            <p className="text-xs text-muted-foreground">The server rejected this request</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <Button className="w-full" onClick={onClose}>Got it</Button>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, loading, destructive,
}: {
  title        : string;
  message      : string;
  confirmLabel : string;
  onConfirm    : () => void;
  onCancel     : () => void;
  loading      : boolean;
  destructive ?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            destructive ? "bg-destructive/15" : "bg-primary/15"
          }`}>
            <AlertTriangle className={`h-5 w-5 ${destructive ? "text-destructive" : "text-primary"}`} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">This action will take effect immediately</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className={`flex-1 ${destructive ? "bg-destructive hover:bg-destructive/90 text-white" : ""}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({
  user, onApprove, onRoleChange, onSuspend, onReactivate, onDelete, isSelf,
}: {
  user        : AdminUser;
  onApprove   : (userId: number, role: AdminRole) => void;
  onRoleChange: (userId: number, role: AdminRole) => void;
  onSuspend   : (userId: number) => void;
  onReactivate: (userId: number) => void;
  onDelete    : (userId: number) => void;
  isSelf      : boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<AdminRole>(user.role);
  const RoleIcon    = roleIcon[user.role];
  const isProtected = user.is_superuser;

  return (
    <div className={`glass-card rounded-xl p-4 space-y-3 ${
      user.status === "pending" ? "border border-yellow-500/30" : ""
    }`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground text-sm">{user.full_name}</p>
            {isSelf && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                You
              </span>
            )}
            {isProtected && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Protected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColor[user.status]}`}>
          {user.status}
        </span>
      </div>

      {/* Role + last login */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${roleColor[user.role]}`}>
          <RoleIcon className="h-3 w-3" />
          {user.role}
        </span>
        <span>
          {user.last_login_at
            ? `Last login ${new Date(user.last_login_at).toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric"
              })}`
            : "Never logged in"
          }
        </span>
      </div>

      {/* Actions */}
      {!isSelf && !isProtected && (
        <div className="pt-2 border-t border-border/50 space-y-2">

          {/* Pending — approve with role selector */}
          {user.status === "pending" && (
            <div className="flex gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                className="flex-1 bg-secondary text-foreground rounded-lg px-3 py-1.5 text-xs border border-border"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button
                size="sm"
                className="gap-1.5 bg-green-500 hover:bg-green-600 text-white"
                onClick={() => onApprove(user.id, selectedRole)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          )}

          {/* Active — change role or suspend */}
          {user.status === "active" && (
            <div className="flex gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                className="flex-1 bg-secondary text-foreground rounded-lg px-3 py-1.5 text-xs border border-border"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button
                size="sm" variant="outline" className="gap-1.5"
                onClick={() => onRoleChange(user.id, selectedRole)}
                disabled={selectedRole === user.role}
              >
                Update
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => onSuspend(user.id)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Suspend
              </Button>
            </div>
          )}

          {/* Suspended — reactivate + delete */}
          {user.status === "suspended" && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm" variant="outline" className="w-full gap-1.5"
                onClick={() => onReactivate(user.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Reactivate
              </Button>
              <Button
                size="sm" variant="outline"
                className="w-full gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => onDelete(user.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete permanently
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Footer messages */}
      {isSelf && (
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          You cannot modify your own account.
        </p>
      )}
      {isProtected && !isSelf && (
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
          This account is protected and cannot be modified.
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]               = useState<AdminUser[]>([]);
  const [loading, setLoading]           = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirm, setConfirm]           = useState<{
    action     : () => Promise<void>;
    title      : string;
    message    : string;
    label      : string;
    destructive?: boolean;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const currentEmail = localStorage.getItem("biologix_email") || "";

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.action();
      await load();
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      setErrorMessage(
        err instanceof Error ? err.message : "This action could not be completed."
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleApprove = (userId: number, role: AdminRole) => {
    const user = users.find((u) => u.id === userId);
    setConfirm({
      title  : "Approve User",
      message: `Approve ${user?.full_name} with role "${role}"? They will immediately be able to log in.`,
      label  : "Approve",
      action : async () => {
        await approveUser(userId, role);
        toast.success(`${user?.full_name} approved as ${role}`);
      },
    });
  };

  const handleRoleChange = (userId: number, role: AdminRole) => {
    const user = users.find((u) => u.id === userId);
    setConfirm({
      title  : "Change Role",
      message: `Change ${user?.full_name}'s role from "${user?.role}" to "${role}"?`,
      label  : "Change Role",
      action : async () => {
        await changeUserRole(userId, role);
        toast.success(`${user?.full_name}'s role updated to ${role}`);
      },
    });
  };

  const handleSuspend = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    setConfirm({
      title      : "Suspend User",
      message    : `Suspend ${user?.full_name}? They will immediately lose access to the dashboard.`,
      label      : "Suspend",
      destructive: true,
      action     : async () => {
        await suspendUser(userId);
        toast.success(`${user?.full_name} suspended`);
      },
    });
  };

  const handleReactivate = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    setConfirm({
      title  : "Reactivate User",
      message: `Reactivate ${user?.full_name}? They will be able to log in again.`,
      label  : "Reactivate",
      action : async () => {
        await reactivateUser(userId);
        toast.success(`${user?.full_name} reactivated`);
      },
    });
  };

  const handleDelete = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    setConfirm({
      title      : "Delete User",
      message    : `Permanently delete ${user?.full_name}? This cannot be undone. Their account will be removed from the system entirely.`,
      label      : "Delete permanently",
      destructive: true,
      action     : async () => {
        await deleteAdminUser(userId);
        toast.success(`${user?.full_name} deleted`);
      },
    });
  };

  const pending   = users.filter((u) => u.status === "pending");
  const active    = users.filter((u) => u.status === "active");
  const suspended = users.filter((u) => u.status === "suspended");

  // ── shared props for every UserCard ───────────────────────────────────────
  const cardProps = {
    onApprove   : handleApprove,
    onRoleChange: handleRoleChange,
    onSuspend   : handleSuspend,
    onReactivate: handleReactivate,
    onDelete    : handleDelete,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
          {pending.length > 0 && (
            <span className="ml-2 text-yellow-500 font-medium">
              · {pending.length} pending approval
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 h-36 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <h2 className="text-sm font-semibold text-foreground">
                  Pending Approval
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({pending.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pending.map((u) => (
                  <UserCard key={u.id} user={u} isSelf={u.email === currentEmail} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* Active */}
          {active.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h2 className="text-sm font-semibold text-foreground">
                  Active Users
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({active.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((u) => (
                  <UserCard key={u.id} user={u} isSelf={u.email === currentEmail} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {/* Suspended */}
          {suspended.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground">
                  Suspended
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({suspended.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suspended.map((u) => (
                  <UserCard key={u.id} user={u} isSelf={u.email === currentEmail} {...cardProps} />
                ))}
              </div>
            </div>
          )}

          {users.length === 0 && (
            <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
              <UserCog className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No users registered yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          title        = {confirm.title}
          message      = {confirm.message}
          confirmLabel = {confirm.label}
          destructive  = {confirm.destructive}
          loading      = {confirming}
          onConfirm    = {runConfirm}
          onCancel     = {() => setConfirm(null)}
        />
      )}

      {/* Error dialog */}
      {errorMessage && (
        <ErrorDialog
          message = {errorMessage}
          onClose = {() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}