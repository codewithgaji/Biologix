import { Fingerprint, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuth } from "@/lib/api";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md text-center space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Fingerprint className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Account Pending Approval</h1>
        </div>

        <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-500 font-medium">
            Your account is awaiting admin approval
          </p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Your registration was successful. An administrator needs to review
          and approve your account before you can access the dashboard.
          Please check back later or contact your IT administrator.
        </p>

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}