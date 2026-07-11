import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function register(full_name: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/admin/register`, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ full_name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

type Tab = "login" | "register";

export default function Login() {
  const [tab, setTab]           = useState<Tab>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate                = useNavigate();

  const resetForm = () => {
    setEmail(""); setPassword(""); setFullName("");
  };

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    const data = await login(email, password);
    if (data.status === "pending") {
      navigate("/pending-approval");
    } else {
      navigate("/dashboard");
    }
  } catch (err: any) {
    toast.error(err.message || "Invalid credentials");
  } finally {
    setLoading(false);
  }
};

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    setLoading(true);
    try {
      await register(fullName, email, password);
      toast.success("Registration successful! Your account is pending admin approval.");
      resetForm();
      setTab("login");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center">
          <Fingerprint className="h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl font-bold text-foreground">BioLogix</h1>
          <p className="text-sm text-muted-foreground mt-1">Biometric Attendance System</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => { setTab("login"); resetForm(); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab("register"); resetForm(); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Request Access
          </button>
        </div>

        {/* Login form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}

        {/* Register form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Your account will be reviewed by an administrator before you can access the system. You'll need to sign in after approval.
              </p>
            </div>
            <div>
              <Label htmlFor="fullname" className="text-foreground">Full Name</Label>
              <Input
                id="fullname" type="text" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Gaji Opeyemi" required className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reg-email" className="text-foreground">Email</Label>
              <Input
                id="reg-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reg-password" className="text-foreground">Password</Label>
              <Input
                id="reg-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Request Access"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}