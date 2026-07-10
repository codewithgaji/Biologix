import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, CalendarCheck, Upload, Download,
  LogOut, Menu, X, Fingerprint, CalendarDays, BarChart2, Archive,
  ShieldCheck, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { useRole } from "@/hooks/useRole";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isAdmin, isEditor, isPayroll } = useRole();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === path
      : location.pathname.startsWith(path);

  // Build nav dynamically based on role
  const navItems = [
    { label: "Overview",    path: "/dashboard",             icon: LayoutDashboard, show: true        },
    { label: "Employees",   path: "/dashboard/employees",   icon: Users,           show: true        },
    { label: "Departments", path: "/dashboard/departments", icon: Building2,       show: true        },
    { label: "Attendance",  path: "/dashboard/attendance",  icon: CalendarCheck,   show: true        },
    { label: "Analytics",   path: "/dashboard/analytics",   icon: BarChart2,       show: true        },
    { label: "Leaves",      path: "/dashboard/leaves",      icon: CalendarDays,    show: true        },
    { label: "Holidays",    path: "/dashboard/holidays",    icon: CalendarDays,    show: true        },
    { label: "Archive",     path: "/dashboard/archive",     icon: Archive,         show: true        },
    { label: "Import Data", path: "/dashboard/import",      icon: Upload,          show: isEditor    },
    { label: "Export",      path: "/dashboard/export",      icon: Download,        show: isPayroll   },
    { label: "Users",       path: "/dashboard/users",       icon: UserCog,         show: isAdmin     },
    { label: "Audit Log",   path: "/dashboard/audit",       icon: ShieldCheck,     show: isAdmin     },
  ].filter((item) => item.show);

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive(item.path)
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  // Show current user info in sidebar footer
  const userName  = localStorage.getItem("biologix_name")  || "User";
  const userRole  = localStorage.getItem("biologix_role")  || "viewer";
  const userEmail = localStorage.getItem("biologix_email") || "";

  const roleBadgeColor: Record<string, string> = {
    admin  : "bg-primary/15 text-primary",
    editor : "bg-green-500/15 text-green-500",
    payroll: "bg-yellow-500/15 text-yellow-500",
    viewer : "bg-secondary text-muted-foreground",
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card/50 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
          <Fingerprint className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-foreground">BioLogix</span>
        </div>

        <div className="flex-1 py-4 overflow-y-auto">
          <NavLinks />
        </div>

        {/* User info footer */}
        <div className="px-4 py-3 border-t border-border space-y-1">
          <p className="text-xs font-medium text-foreground truncate">{userName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          <span className={cn(
            "inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1",
            roleBadgeColor[userRole] || roleBadgeColor.viewer
          )}>
            {userRole}
          </span>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-6 w-6 text-primary" />
                <span className="font-bold text-foreground">BioLogix</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
              <NavLinks />
            </div>
            <div className="px-4 py-3 border-t border-border space-y-1">
              <p className="text-xs font-medium text-foreground truncate">{userName}</p>
              <span className={cn(
                "inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                roleBadgeColor[userRole] || roleBadgeColor.viewer
              )}>
                {userRole}
              </span>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-card/80 backdrop-blur-lg">
          <button
            className="lg:hidden text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}