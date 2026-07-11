export type UserRole = "viewer" | "editor" | "payroll" | "admin";

export function useRole() {
  const role = (localStorage.getItem("biologix_role") || "viewer") as UserRole;
  return {
    role,
    isAdmin  : role === "admin",
    isEditor : role === "editor"  || role === "admin",
    isPayroll: role === "payroll" || role === "admin",
    canEdit  : role === "editor"  || role === "admin",
    canExport: role === "payroll" || role === "admin",
  };
}