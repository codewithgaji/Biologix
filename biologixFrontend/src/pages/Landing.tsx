import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  Fingerprint, Clock, FileSpreadsheet, Mail, Phone, MapPin,
  ArrowRight, Zap, Shield, BarChart3, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FingerprintAnimation from "@/components/FingerprintAnimation";

// ─── shard clip paths ────────────────────────────────────────────────────────
const SHARD_CLIP       = `polygon(8% 0%,94% 2%,100% 12%,98% 88%,92% 100%,6% 98%,0% 86%,2% 14%)`;
const SHARD_CLIP_2     = `polygon(4% 6%,88% 0%,100% 10%,96% 92%,88% 100%,10% 96%,0% 82%,2% 8%)`;
const SHARD_GLOW_CLIP  = `polygon(6% 2%,96% 0%,100% 8%,99% 90%,94% 100%,4% 99%,0% 88%,1% 10%)`;

// ─── animated fingerprint bg ──────────────────────────────────────────────────
function FingerprintBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${10 + i * 16}%`, top: `${20 + (i % 3) * 25}%` }}
          animate={{ rotate: [0, 360], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 20 + i * 4, repeat: Infinity, ease: "linear" }}
        >
          <Fingerprint
            size={typeof window !== "undefined" && window.innerWidth < 640 ? 60 + i * 10 : 120 + i * 20}
            className="text-cyan-400"
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── glowing orbs ─────────────────────────────────────────────────────────────
function GlowOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-48 h-48 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
          top: "-10%", left: "-5%",
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-40 h-40 sm:w-60 sm:h-60 md:w-80 md:h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          bottom: "10%", right: "5%",
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ─── shard photo frame ────────────────────────────────────────────────────────
function ShardFrame({
  imageSrc, name, role, bio, index,
}: {
  imageSrc?: string;
  name: string;
  role: string;
  bio: string;
  index: number;
}) {
  const isEven = index % 2 === 0;

  return (
    <motion.div
      className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-8 md:gap-16`}
      initial={{ opacity: 0, x: isEven ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Shard frame */}
      <div className="relative flex-shrink-0 w-52 h-60 sm:w-64 sm:h-72 md:w-72 md:h-80">
        <motion.div
          className="absolute inset-[-6px]"
          style={{
            clipPath: SHARD_GLOW_CLIP,
            background: "linear-gradient(135deg, rgba(6,182,212,0.4), rgba(59,130,246,0.2), rgba(6,182,212,0.1))",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-[-2px]"
          style={{ clipPath: SHARD_CLIP, background: "linear-gradient(135deg, #06b6d4, #3b82f6, #06b6d4)" }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ clipPath: SHARD_CLIP }}>
          <div
            className="absolute top-0 left-0 w-1/3 h-full opacity-20"
            style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.6) 0%, transparent 100%)" }}
          />
          <div
            className="absolute top-0 right-8 w-[2px] h-2/3 opacity-30"
            style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.8), transparent)" }}
          />
        </div>
        <div className="absolute inset-[1px] overflow-hidden" style={{ clipPath: SHARD_CLIP_2 }}>
          {imageSrc ? (
            <img src={imageSrc} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: "linear-gradient(160deg, #0f1f35 0%, #0a1628 50%, #0d1f3a 100%)" }}
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <Fingerprint className="text-cyan-400/50" size={56} />
              </motion.div>
              <p className="text-cyan-400/40 text-xs font-mono tracking-widest uppercase">Photo</p>
            </div>
          )}
        </div>
        <div
          className="absolute -bottom-2 -right-2 w-8 h-8 opacity-60"
          style={{ clipPath: "polygon(100% 0%, 100% 100%, 0% 100%)", background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
        />
        <div
          className="absolute -top-2 -left-2 w-6 h-6 opacity-40"
          style={{ clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)", background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
        />
      </div>

      {/* Text */}
      <div className="flex-1 text-center md:text-left max-w-lg w-full px-2 md:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <p className="text-xs font-mono tracking-[0.3em] text-cyan-400 uppercase mb-2">{role}</p>
          <h3
            className="text-2xl sm:text-3xl md:text-4xl font-black mb-4"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: "linear-gradient(135deg, #f0f9ff, #bae6fd, #7dd3fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {name}
          </h3>
          <div
            className="w-12 h-[2px] mb-5 mx-auto md:mx-0"
            style={{ background: "linear-gradient(90deg, #06b6d4, transparent)" }}
          />
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: "rgba(186,230,253,0.7)", fontFamily: "'DM Sans', sans-serif" }}
          >
            {bio}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── animated logo ─────────────────────────────────────────────────────────────
function AnimatedLogo({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 2.2, duration: 0.4 }}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="flex items-center gap-3"
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.4, times: [0, 0.2, 0.75, 1] }}
      >
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 1.5, ease: "easeInOut" }}>
          <Fingerprint className="h-10 w-10 sm:h-16 sm:w-16 text-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
        </motion.div>
        <span
          className="text-3xl sm:text-5xl font-black"
          style={{
            fontFamily: "'Syne', sans-serif",
            background: "linear-gradient(135deg, #f0f9ff, #06b6d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          BioLogix
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── features data ────────────────────────────────────────────────────────────
const features = [
  { icon: Fingerprint,    title: "Biometric Import",   desc: "Plug in your ZKTeco flash drive and import employee data in seconds. No manual entry." },
  { icon: Clock,          title: "Real-time Tracking",  desc: "Clock in, clock out, hours worked — all captured automatically from machine logs." },
  { icon: FileSpreadsheet,title: "Excel Reports",       desc: "Generate department, monthly, or yearly reports with attendance analytics and color-coded status." },
  { icon: Zap,            title: "Instant Sync",        desc: "Two-machine support for separate entry/exit tracking. Smart punch detection built in." },
  { icon: Shield,         title: "Secure Access",       desc: "JWT-protected admin portal. Your employee data stays yours — no third-party cloud." },
  { icon: BarChart3,      title: "Shift Analytics",     desc: "Morning, afternoon, night, or day shifts. Expected vs actual hours tracked per employee." },
];

// ─── founders data 
const founders = [
  {
    name: "Oladimeji Opeyemi",
    imageSrc: "/founders/oladimeji.jpg",
    role: "Co-Founder & Innovator",
    bio: "As the Co-Founder and Innovator of BioLogix, I drove the vision and strategic direction behind the system, focusing on transforming HR operations through digital innovation. By collaborating with Gaji and the IT Department, I helped deliver a solution that reduces manual workload, improves efficiency, and supports better organizational decision-making.",
  },
  {
    name: "Gaji Yaqub",
    role: "Co-Founder & Lead Developer",
    imageSrc: "/founders/Gaji.png",
    bio: "As a Software Engineer, I developed Biologix with the Right Resources gotten from My Senior(Mr Opeyemi) and IT Department. I Built the Entire infrastructure with FastAPI and ReactJs. This system is Built to make reduce the tedious work done by the HR team saving them Time and Resources.",
  },
];

// ─── mobile nav 
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(6,13,26,0.97)", backdropFilter: "blur(16px)" }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(6,182,212,0.12)" }}>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-7 w-7 text-cyan-400" />
              <span className="text-xl font-black" style={{ fontFamily: "'Syne', sans-serif", background: "linear-gradient(135deg,#f0f9ff,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                BioLogix
              </span>
            </div>
            <button onClick={onClose} className="text-cyan-400/60 hover:text-cyan-400 transition-colors p-1">
              <X size={24} />
            </button>
          </div>
          <nav className="flex flex-col items-center justify-center flex-1 gap-8">
            {["Features", "Founders", "About", "Contact"].map((item, i) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={onClose}
                className="text-2xl font-black tracking-wide hover:text-cyan-400 transition-colors"
                style={{ fontFamily: "'Syne', sans-serif", color: "rgba(186,230,253,0.7)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                {item}
              </motion.a>
            ))}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Link to="/login" onClick={onClose}>
                <Button
                  size="lg"
                  className="font-semibold gap-2 mt-4"
                  style={{ background: "linear-gradient(135deg, #0891b2, #3b82f6)", border: "none", color: "white" }}
                >
                  Admin Login <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── main 
export default function Landing() {
  const [logoAnimDone, setLogoAnimDone] = useState(false);
  const [showNav, setShowNav]           = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowNav(true), 2600);
    return () => clearTimeout(t);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
      `}</style>

      {!logoAnimDone && <AnimatedLogo onDone={() => setLogoAnimDone(true)} />}

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div
        className="min-h-screen relative w-full overflow-x-hidden"
        style={{
          background: "linear-gradient(160deg, #060d1a 0%, #091525 40%, #060e1c 100%)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <FingerprintBg />
        <GlowOrbs />

        {/* Scanline overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.3) 2px, rgba(6,182,212,0.3) 3px)",
          }}
        />

        {/* ── NAV ── */}
        <AnimatePresence>
          {showNav && (
            <motion.header
              className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 md:px-10 py-3 sm:py-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                background: "rgba(6,13,26,0.85)",
                backdropFilter: "blur(12px)",
                borderBottom: "1px solid rgba(6,182,212,0.12)",
              }}
            >
              {/* Logo */}
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ filter: ["drop-shadow(0 0 6px rgba(6,182,212,0.6))","drop-shadow(0 0 14px rgba(6,182,212,0.9))","drop-shadow(0 0 6px rgba(6,182,212,0.6))"] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Fingerprint className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" />
                </motion.div>
                <span
                  className="text-lg sm:text-xl font-black"
                  style={{ fontFamily: "'Syne', sans-serif", background: "linear-gradient(135deg, #f0f9ff, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  BioLogix
                </span>
              </div>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm" style={{ color: "rgba(186,230,253,0.6)" }}>
                {["Features", "Founders", "About", "Contact"].map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-cyan-400 transition-colors tracking-wide">
                    {item}
                  </a>
                ))}
              </nav>

              {/* Desktop CTA */}
              <Link to="/login" className="hidden md:block">
                <Button
                  className="text-sm font-semibold gap-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.15))",
                    border: "1px solid rgba(6,182,212,0.4)",
                    color: "#67e8f9",
                  }}
                >
                  Admin Login <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>

              {/* Mobile hamburger */}
              <button
                className="md:hidden text-cyan-400/70 hover:text-cyan-400 transition-colors p-1"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
            </motion.header>
          )}
        </AnimatePresence>

        {/* ── HERO ── */}
        <section className="relative flex flex-col items-center justify-center px-4 sm:px-6 pt-28 sm:pt-32 md:pt-36 pb-20 sm:pb-28 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: logoAnimDone ? 0 : 2.6, duration: 0.8 }}
            className="scale-75 sm:scale-90 md:scale-100"
          >
            <FingerprintAnimation />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: logoAnimDone ? 0.1 : 2.8, duration: 0.7 }}
            className="mt-6 sm:mt-8 w-full"
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.4em] text-cyan-400 uppercase mb-3 sm:mb-4">
              Biometric Attendance Management
            </p>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] mb-4 sm:mb-6"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #f0f9ff 0%, #bae6fd 40%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Bio<span style={{ color: "#06b6d4", WebkitTextFillColor: "#06b6d4" }}>Logix</span>
            </h1>
            <p
              className="text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
              style={{ color: "rgba(186,230,253,0.65)" }}
            >
              Replacing expensive ZKTeco software with a custom-built system that does more -
              biometric imports, real-time tracking, and beautiful Excel reports.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: logoAnimDone ? 0.3 : 3.1, duration: 0.6 }}
            className="mt-8 sm:mt-10 flex flex-col xs:flex-row flex-wrap gap-3 sm:gap-4 justify-center w-full px-4 sm:px-0"
          >
            <Link to="/login" className="w-full xs:w-auto">
              <Button
                size="lg"
                className="w-full xs:w-auto font-semibold px-6 sm:px-8 gap-2 text-sm sm:text-base"
                style={{
                  background: "linear-gradient(135deg, #0891b2, #3b82f6)",
                  border: "none",
                  color: "white",
                  boxShadow: "0 0 30px rgba(6,182,212,0.3)",
                }}
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features" className="w-full xs:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full xs:w-auto font-semibold px-6 sm:px-8 text-sm sm:text-base"
                style={{
                  borderColor: "rgba(6,182,212,0.3)",
                  color: "#67e8f9",
                  background: "transparent",
                }}
              >
                See Features
              </Button>
            </a>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 hidden sm:block"
            animate={{ y: [0, 8, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-[1px] h-10 sm:h-12 mx-auto" style={{ background: "linear-gradient(180deg, transparent, #06b6d4, transparent)" }} />
          </motion.div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-32">
          <motion.div
            className="text-center mb-10 sm:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.4em] text-cyan-400 uppercase mb-3">What It Does</p>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-black"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #f0f9ff, #7dd3fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Built Different
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="relative rounded-2xl p-5 sm:p-6 overflow-hidden group cursor-default"
                style={{
                  background: "linear-gradient(135deg, rgba(6,182,212,0.06), rgba(59,130,246,0.04))",
                  border: "1px solid rgba(6,182,212,0.12)",
                }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ borderColor: "rgba(6,182,212,0.35)", scale: 1.02 }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(6,182,212,0.08), transparent 70%)" }}
                />
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4"
                  style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.2)" }}
                  whileHover={{ scale: 1.1 }}
                >
                  <f.icon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </motion.div>
                <h3
                  className="text-sm sm:text-base font-bold mb-2"
                  style={{ fontFamily: "'Syne', sans-serif", color: "#e0f2fe" }}
                >
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "rgba(186,230,253,0.55)" }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── FOUNDERS ── */}
        <section id="founders" className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-24 sm:pb-36">
          <motion.div
            className="text-center mb-12 sm:mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.4em] text-cyan-400 uppercase mb-3">The People</p>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-black"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #f0f9ff, #7dd3fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Who Built This
            </h2>
          </motion.div>

          <div className="space-y-16 sm:space-y-24">
            {founders.map((founder, i) => (
              <ShardFrame key={founder.name} {...founder} index={i} />
            ))}
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section id="about" className="relative max-w-4xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div
            className="rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(6,182,212,0.07), rgba(59,130,246,0.05))",
              border: "1px solid rgba(6,182,212,0.15)",
            }}
          >
            <div
              className="absolute top-0 right-0 w-40 h-40 sm:w-64 sm:h-64 opacity-20"
              style={{ background: "radial-gradient(circle, rgba(6,182,212,0.4), transparent 70%)" }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.4em] text-cyan-400 uppercase mb-3">About</p>
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 sm:mb-6"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  background: "linear-gradient(135deg, #f0f9ff, #7dd3fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Why BioLogix Exists
              </h2>
              <div className="space-y-3 sm:space-y-4 text-sm sm:text-base" style={{ color: "rgba(186,230,253,0.65)", lineHeight: "1.8" }}>
                <p>
                  BioLogix was built out of frustration with ZKTeco's overpriced, clunky desktop software.
                  Organizations with biometric attendance machines deserved a modern, web-based system that
                  they could actually own and customize - not a black-box install that locks you in.
                </p>
                <p>
                  We built a full-stack replacement: a FastAPI backend that reads the raw binary DAT files
                  directly off the machine, a PostgreSQL database for clean storage, and a React dashboard
                  that makes attendance management intuitive for any HR team.
                </p>
                <p>
                  BioLogix supports multi-machine setups, shift-based expected hours, department analytics,
                  holiday exclusions, and one-click Excel exports - everything the original software charged
                  a premium for, and more.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="relative max-w-4xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <motion.div
            className="text-center mb-8 sm:mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[10px] sm:text-xs font-mono tracking-[0.3em] sm:tracking-[0.4em] text-cyan-400 uppercase mb-3">Get In Touch</p>
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-black"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #f0f9ff, #7dd3fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Contact
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              { icon: Mail,   label: "Email",    value: "hello@biologix.app", href: "mailto:hello@biologix.app" },
              { icon: Phone,  label: "Phone",    value: "+234 070 650 184 36",   href: "#" },
              { icon: MapPin, label: "Location", value: "Nigeria",             href: "#" },
            ].map((item, i) => (
              <motion.a
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-3 rounded-2xl p-5 sm:p-6 text-center group"
                style={{
                  background: "rgba(6,182,212,0.05)",
                  border: "1px solid rgba(6,182,212,0.1)",
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ borderColor: "rgba(6,182,212,0.3)", scale: 1.03 }}
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(6,182,212,0.12)" }}
                >
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <p className="text-[10px] sm:text-xs font-mono tracking-widest text-cyan-400/60 uppercase">{item.label}</p>
                <p className="text-xs sm:text-sm font-medium" style={{ color: "#bae6fd" }}>{item.value}</p>
              </motion.a>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer
          className="relative px-4 sm:px-6 py-6 sm:py-8 text-center"
          style={{ borderTop: "1px solid rgba(6,182,212,0.08)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
            <Fingerprint className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400/50" />
            <span
              className="font-black text-base sm:text-lg"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #94a3b8, #67e8f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              BioLogix
            </span>
          </div>
          <p className="text-[10px] sm:text-xs" style={{ color: "rgba(186,230,253,0.3)" }}>
            © {new Date().getFullYear()} BioLogix. Built with precision.
          </p>
        </footer>
      </div>
    </>
  );
}