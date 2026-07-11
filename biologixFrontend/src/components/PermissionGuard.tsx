import { ShieldX, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClose    : () => void;
  requiredRole: "editor" | "payroll" | "admin";
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor : "Editors and Admins can create and edit employee records, manage leaves, and import data.",
  payroll: "Payroll officers and Admins can export attendance reports.",
  admin  : "Only Admins can perform this action.",
};

const ROLE_LABELS: Record<string, string> = {
  editor : "Editor or Admin",
  payroll: "Payroll or Admin",
  admin  : "Admin",
};

export default function PermissionGuard({ onClose, requiredRole }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">

        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <ShieldX className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Access Restricted</h3>
            <p className="text-xs text-muted-foreground">
              Requires: <span className="font-medium text-foreground">{ROLE_LABELS[requiredRole]}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {ROLE_DESCRIPTIONS[requiredRole]}
        </p>

        {/* Current role context */}
        <div className="bg-secondary/50 rounded-xl px-4 py-3 text-xs text-muted-foreground">
          Your current role is{" "}
          <span className="font-semibold text-foreground capitalize">
            {localStorage.getItem("biologix_role") || "viewer"}
          </span>
          . Contact your administrator if you need elevated access.
        </div>

        <Button className="w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}