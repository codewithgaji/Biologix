import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Fingerprint, Clock, FileSpreadsheet, Mail, Phone, MapPin,
  ArrowRight, Shield, BarChart3, Menu, X, CheckCircle2,
  UploadCloud, Users2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── tokens ────────────────────────────────────────────────────────────────
// ink:      #0B1E3D  (headings / primary text)
// slate:    #475569  (body text)
// cyan:     #0891B2  (primary action / accent)
// sky:      #0EA5E9  (secondary accent, used sparingly)
// bg alt:   #F8FAFC
// border:   #E2E8F0

const features = [
  { icon: Fingerprint,   title: "Biometric import",   desc: "Plug in your ZKTeco device and pull employee records in seconds — no manual data entry." },
  { icon: Clock,         title: "Real-time tracking",  desc: "Clock-ins, clock-outs, and hours worked are captured automatically from the machine logs." },
  { icon: FileSpreadsheet, title: "Excel reporting",   desc: "Generate department, monthly, or yearly reports with attendance breakdowns your HR team can act on." },
  { icon: UploadCloud,   title: "Instant sync",        desc: "Two-machine support for separate entry and exit points, with automatic punch detection." },
  { icon: Shield,        title: "Secure by design",    desc: "JWT-protected admin access. Your employee data stays on your own infrastructure." },
  { icon: BarChart3,     title: "Shift analytics",     desc: "Morning, afternoon, and night shifts tracked against expected vs. actual hours, per employee." },
];

const steps = [
  { step: "01", title: "Connect the device", desc: "Import attendance logs directly from your existing biometric machine — no new hardware required." },
  { step: "02", title: "Data is organized automatically", desc: "BioLogix matches punches to employees and shifts, and flags anything that needs a human look." },
  { step: "03", title: "Export what HR needs", desc: "Pull a clean, color-coded Excel report for any department, month, or year in one click." },
];

const founders = [
  {
    name: "Oladimeji Opeyemi",
    imageSrc: "/founders/oladimeji.jpg",
    role: "Co-Founder & Innovator",
    bio: "As the Co-Founder and Innovator of BioLogix, I drove the vision and strategic direction behind the system, focusing on transforming HR operations through digital innovation. By collaborating with Gaji and the IT Department, I helped deliver a solution that reduces manual workload, improves efficiency, and supports better organizational decision-making.",
  },
  {
    name: "Gaji Yaqub",
    imageSrc: "/founders/Gaji.png",
    role: "Co-Founder & Lead Developer",
    bio: "As a Software Engineer, I developed BioLogix with the guidance of my senior, Mr. Opeyemi, and the IT Department. I built the entire infrastructure with FastAPI and React, designed to save the HR team time and cut down on tedious manual work.",
    portfolio: "gajilabs.com",
  },
];

// ── mobile nav ──────────────────────────────────────────────────────────────
function MobileMenu({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center">
                <Fingerprint className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                BioLogix
              </span>
            </div>
            <button onClick={onClose} className="text-[#475569] hover:text-[#0B1E3D] transition-colors p-1" aria-label="Close menu">
              <X size={22} />
            </button>
          </div>
          <nav className="flex flex-col items-start justify-center flex-1 gap-1 px-6">
            {["Features", "How it works", "Founders", "About", "Contact"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={onClose}
                className="w-full py-4 text-lg font-semibold text-[#0B1E3D] border-b border-[#F1F5F9]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {item}
              </a>
            ))}
            <Link to="/login" onClick={onClose} className="w-full mt-6">
              <Button className="w-full font-semibold gap-2 bg-[#0891B2] hover:bg-[#0e7490] text-white">
                Admin login <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── main ────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const navItems = ["Features", "How it works", "Founders", "About", "Contact"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600&display=swap');
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>

      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="min-h-screen w-full bg-white text-[#0B1E3D]">

        {/* ── NAV ── */}
        <header
          className={`sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 md:px-10 py-4 bg-white/95 backdrop-blur transition-shadow ${
            scrolled ? "shadow-[0_1px_0_0_#E2E8F0]" : ""
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#0891B2] flex items-center justify-center">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>
              BioLogix
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#475569]">
            {navItems.map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-[#0891B2] transition-colors">
                {item}
              </a>
            ))}
          </nav>

          <Link to="/login" className="hidden md:block">
            <Button className="text-sm font-semibold gap-2 bg-[#0891B2] hover:bg-[#0e7490] text-white">
              Admin login <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>

          <button
            className="md:hidden text-[#0B1E3D] p-1"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* ── HERO ── */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0891B2] mb-5">
              <Fingerprint className="h-3.5 w-3.5" />
              Biometric Attendance Management
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.08] mb-5 text-[#0B1E3D]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Attendance software your HR team will actually enjoy using
            </h1>
            <p className="text-base sm:text-lg text-[#475569] leading-relaxed mb-8 max-w-xl">
              BioLogix replaces expensive, clunky ZKTeco desktop software with a modern web
              dashboard — biometric imports, real-time tracking, and clean Excel reports, built
              for teams that want to own their data.
            </p>
            <div className="flex flex-col xs:flex-row flex-wrap gap-3 mb-9">
              <Link to="/login" className="w-full xs:w-auto">
                <Button
                  size="lg"
                  className="w-full xs:w-auto font-semibold px-7 gap-2 bg-[#0891B2] hover:bg-[#0e7490] text-white"
                >
                  Open dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features" className="w-full xs:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full xs:w-auto font-semibold px-7 border-[#CBD5E1] text-[#0B1E3D] hover:bg-[#F8FAFC]"
                >
                  See features
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#475569]">
              {["No per-seat licensing", "Self-hosted data", "Built for multi-machine setups"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0891B2]" /> {t}
                </span>
              ))}
            </div>
          </motion.div>

          {/* dashboard mockup — signature element */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_-20px_rgba(11,30,61,0.25)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <span className="text-sm font-semibold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Today's attendance
                </span>
                <span className="text-xs font-medium text-[#0891B2] bg-[#E0F2FE] px-2 py-1 rounded-full">
                  Live
                </span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { name: "Amaka Chukwu", dept: "Finance", time: "8:02 AM", status: "On time" },
                  { name: "Tunde Bakare", dept: "Operations", time: "8:41 AM", status: "Late" },
                  { name: "Ifeoma Nwosu", dept: "HR", time: "7:55 AM", status: "On time" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between rounded-xl border border-[#F1F5F9] px-3.5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1E3D]">{row.name}</p>
                      <p className="text-xs text-[#94A3B8]">{row.dept}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#475569]">{row.time}</p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          row.status === "On time"
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : "bg-[#FEF3C7] text-[#B45309]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-[#F1F5F9] px-3.5 py-3.5">
                  <p className="text-xs font-medium text-[#94A3B8] mb-2">Average hours this week</p>
                  <div className="flex items-end gap-1.5 h-14">
                    {[62, 78, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-md bg-[#0891B2]/80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="bg-[#F8FAFC] border-y border-[#E2E8F0]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              className="max-w-2xl mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-semibold tracking-wide text-[#0891B2] uppercase mb-3">What it does</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Everything the old system charged extra for
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="rounded-2xl bg-white border border-[#E2E8F0] p-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E0F2FE] flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-[#0891B2]" />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#475569]">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            className="max-w-2xl mb-12"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-semibold tracking-wide text-[#0891B2] uppercase mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              From machine to report, in three steps
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative pl-0"
              >
                <span
                  className="text-sm font-bold text-[#0891B2] block mb-3"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  {s.step}
                </span>
                <h3 className="text-lg font-bold mb-2 text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#475569]">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── FOUNDERS ── */}
        <section id="founders" className="bg-[#F8FAFC] border-y border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              className="max-w-2xl mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-semibold tracking-wide text-[#0891B2] uppercase mb-3">The people</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Who built this
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {founders.map((founder, i) => (
                <motion.div
                  key={founder.name}
                  className="rounded-2xl bg-white border border-[#E2E8F0] p-6 sm:p-7"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-[#E0F2FE] flex-shrink-0 border border-[#E2E8F0]">
                      {founder.imageSrc ? (
                        <img src={founder.imageSrc} alt={founder.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users2 className="h-6 w-6 text-[#0891B2]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {founder.name}
                      </h3>
                      <p className="text-xs font-semibold text-[#0891B2]">{founder.role}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-[#475569] mb-3">{founder.bio}</p>
                  {founder.portfolio && (
                    <a
                      href={`https://${founder.portfolio}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0891B2] hover:text-[#0e7490]"
                    >
                      {founder.portfolio} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section id="about" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-semibold tracking-wide text-[#0891B2] uppercase mb-3">About</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Why BioLogix exists
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-[#475569]">
              <p>
                BioLogix was built out of frustration with ZKTeco's overpriced, clunky desktop
                software. Organizations with biometric attendance machines deserved a modern,
                web-based system they could actually own and customize — not a black-box install
                that locks them in.
              </p>
              <p>
                We built a full-stack replacement: a FastAPI backend that reads the raw binary
                data files directly off the machine, a PostgreSQL database for clean storage, and
                a React dashboard that makes attendance management intuitive for any HR team.
              </p>
              <p>
                BioLogix supports multi-machine setups, shift-based expected hours, department
                analytics, holiday exclusions, and one-click Excel exports — everything the
                original software charged a premium for, and more.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="bg-[#F8FAFC] border-y border-[#E2E8F0]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              className="mb-10"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs font-semibold tracking-wide text-[#0891B2] uppercase mb-3">Get in touch</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Contact
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Mail,   label: "Email",    value: "hello@biologix.app",   href: "mailto:hello@biologix.app" },
                { icon: Phone,  label: "Phone",    value: "0706 501 8436",        href: "tel:+2347065018436" },
                { icon: MapPin, label: "Location", value: "Nigeria",              href: "#" },
              ].map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-start gap-2.5 rounded-2xl bg-white border border-[#E2E8F0] p-5"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#E0F2FE] flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-[#0891B2]" />
                  </div>
                  <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-semibold text-[#0B1E3D]">{item.value}</p>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="px-4 sm:px-6 py-8 text-center border-t border-[#E2E8F0]">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Fingerprint className="h-4 w-4 text-[#94A3B8]" />
            <span className="font-bold text-[#0B1E3D]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              BioLogix
            </span>
          </div>
          <p className="text-xs text-[#94A3B8]">
            © {new Date().getFullYear()} BioLogix. Built with precision.
          </p>
        </footer>
      </div>
    </>
  );
}