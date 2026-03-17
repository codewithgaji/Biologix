import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Fingerprint, Clock, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import FingerprintAnimation from "@/components/FingerprintAnimation";

const features = [
  {
    icon: Fingerprint,
    title: "Biometric Import",
    desc: "Plug in your ZKTeco flash drive and import employee data instantly.",
  },
  {
    icon: Clock,
    title: "Real-time Attendance Tracking",
    desc: "Clock in, clock out, hours worked — all captured automatically.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export Reports",
    desc: "Generate Excel reports by department, month, or year with one click.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">BioLogix</span>
        </div>
        <Link to="/login">
          <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground">
            Admin Login
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-24 text-center max-w-4xl mx-auto">
        <FingerprintAnimation />
        <motion.h1
          className="mt-10 text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Bio<span className="text-primary">Logix</span>
        </motion.h1>
        <motion.p
          className="mt-2 text-lg text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Biometric Attendance Management System
        </motion.p>
        <motion.p
          className="mt-4 text-xl text-secondary-foreground max-w-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Automating employee attendance capture for modern organizations
        </motion.p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            className="glass-card rounded-xl p-6 hover:glow-teal transition-shadow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 + i * 0.15 }}
          >
            <f.icon className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
