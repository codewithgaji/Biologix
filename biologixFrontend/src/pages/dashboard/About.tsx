import { useEffect, useState, useRef } from "react";
import { Compass, X } from "lucide-react";

// ── Content ───────────────────────────────────────────────────────────────────
const CONTENT: Record<string, { tag: string; title: string; body: string }> = {
  hub: {
    tag: "The whole system", title: "BioLogix",
    body: "BioLogix counts everyone in and out of work every day, then turns those counts into pay, reports, and peace of mind. It reads fingerprint data straight from the scanning machines at the gate, keeps one tidy record for every person on the payroll, and hands HR everything they need without anyone touching a spreadsheet by hand."
  },
  innovators: {
    tag: "Who and why", title: "Who built this",
    body: "Yaqub Gaji Ayomikun, a CS student at LASU, built the entire system infrastructure using FastAPI and React, replacing ZKTeco proprietary software with something the company could trust and grow with. Oladimeji Israel Opeyemi co-founded and drove the vision — shaping the product's strategic direction and transforming HR operations at Blue World Cosmetics."
  },
  timeline: {
    tag: "How it came together", title: "Timeline",
    body: "First version: raw .dat files turned into real attendance records. Then a live server deployment. Then a full dashboard redesign. A superuser master-key was added for emergencies. A DB admin panel was built for backups and cleanup. Finally, automated weekly backups and a full import history were added so nothing is ever one mistake away from being lost."
  },
  employees: {
    tag: "Feature", title: "Employees",
    body: "The company's single source of truth for who works here. Every staff member has a badge number (what HR sees) and a machine ID (what the ZKTeco device uses). The two are always linked. HR can add starters, update departments or shifts, and move people in bulk from one screen."
  },
  attendance: {
    tag: "Feature", title: "Attendance",
    body: "Every finger-on-scanner moment gets logged — clock in or clock out. The system works out each person's earliest clock-in and latest clock-out, calculates hours worked, and flags anyone who forgot to tap out. This is the raw material everything else is built from."
  },
  imports: {
    tag: "Feature", title: "Imports",
    body: "The fingerprint machines save their data to a flash drive as plain .dat files. This is the part that reads those files and turns them into employee and attendance records. Every file ever imported is kept and dated — so the system can always be rebuilt from scratch if needed."
  },
  exports: {
    tag: "Feature", title: "Exports",
    body: "When it's time to run payroll, one click builds a clean Excel file with everyone's hours, absences, and percentages already worked out — formulas and all — ready for whoever processes pay. Department subtotals and colour-coded status flags included."
  },
  leaves: {
    tag: "Feature", title: "Leaves",
    body: "Not every absence is a problem. Approved time off, sick leave, and planned breaks get recorded here — for one person or for everyone at once. Because the system knows someone was on leave, it won't wrongly flag them as absent when calculating attendance."
  },
  archive: {
    tag: "Feature", title: "Archive",
    body: "When someone leaves the company, their record isn't wiped. It's moved into a holding area with their full attendance history, kept for a set number of days before being permanently cleared. That gap is a safety window in case anything needs recovering."
  },
  analytics: {
    tag: "Feature", title: "Analytics",
    body: "Attendance trends over the year, which department shows up most reliably, who tends to arrive early or late, punctuality scores, and a monthly award for the best-performing department — all shown as charts anyone can read at a glance."
  },
  audit: {
    tag: "Feature", title: "Audit log",
    body: "Every important action in BioLogix — deleting someone, changing a role, importing a file — gets written down permanently and can never be quietly erased. If anyone ever asks who did what and when, the answer is always here."
  },
  dbadmin: {
    tag: "Superuser only", title: "DB admin",
    body: "This section only opens for one person: the system's single trusted superuser. From here they can see how large the database has grown, which tables take the most space, clear out old attendance records by date range, and download a full backup on demand."
  },
  backups: {
    tag: "Feature", title: "Backups",
    body: "Every Sunday at 3 AM, BioLogix quietly copies itself and stores that copy safely — no one needs to remember to do it. A backup can also be downloaded on demand at any time. What's saved is a real, restorable copy of the company's data."
  },
};

// ── Node and edge definitions ─────────────────────────────────────────────────
interface Node { id: string; label: string; hub?: boolean }
interface Edge { from: string; to: string }

const NODES: Node[] = [
  { id: "hub",        label: "BioLogix",   hub: true },
  { id: "innovators", label: "Team"                  },
  { id: "timeline",   label: "Timeline"              },
  { id: "employees",  label: "Employees"             },
  { id: "attendance", label: "Attendance"            },
  { id: "imports",    label: "Imports"               },
  { id: "exports",    label: "Exports"               },
  { id: "leaves",     label: "Leaves"                },
  { id: "archive",    label: "Archive"               },
  { id: "analytics",  label: "Analytics"             },
  { id: "audit",      label: "Audit"                 },
  { id: "dbadmin",    label: "DB Admin"              },
  { id: "backups",    label: "Backups"               },
];

const EDGES: Edge[] = [
  { from: "hub", to: "innovators" },
  { from: "hub", to: "timeline"   },
  { from: "hub", to: "employees"  },
  { from: "hub", to: "attendance" },
  { from: "hub", to: "imports"    },
  { from: "hub", to: "exports"    },
  { from: "hub", to: "leaves"     },
  { from: "hub", to: "archive"    },
  { from: "hub", to: "analytics"  },
  { from: "hub", to: "audit"      },
  { from: "hub", to: "dbadmin"    },
  { from: "hub", to: "backups"    },
];

// ── Layout: polar positions around hub ───────────────────────────────────────
function getLayout(W: number, H: number) {
  const cx = W / 2;
  const cy = H * 0.42;
  const outerR = Math.min(W, H) * 0.36;
  const satellites = NODES.filter(n => !n.hub);
  const positions: Record<string, { x: number; y: number; r: number }> = {};

  positions["hub"] = { x: cx, y: cy, r: Math.min(W, H) * 0.07 };

  satellites.forEach((n, i) => {
    const angle = (i / satellites.length) * Math.PI * 2 - Math.PI / 2;
    positions[n.id] = {
      x: cx + outerR * Math.cos(angle),
      y: cy + outerR * Math.sin(angle),
      r: Math.min(W, H) * 0.044,
    };
  });

  return positions;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({
  nodeId, onClose,
}: {
  nodeId: string; onClose: () => void;
}) {
  const d = CONTENT[nodeId];
  if (!d) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{d.tag}</p>
        <h3 className="text-lg font-semibold text-foreground">{d.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{d.body}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function About() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const animRef    = useRef<number>(0);
  const [selected, setSelected]   = useState<string | null>(null);
  const [hovered,  setHovered]    = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);

  // Keep ref in sync so canvas loop can read without stale closure
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const wrap    = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx     = canvas.getContext("2d")!;

    // ── Pulse particles along edges ──────────────────────────────────────────
    interface Pulse { edgeIdx: number; t: number; speed: number }
    const pulses: Pulse[] = [];
    let lastSpawn = 0;

    function spawnPulse() {
      pulses.push({
        edgeIdx: Math.floor(Math.random() * EDGES.length),
        t: 0,
        speed: 0.004 + Math.random() * 0.004,
      });
    }

    // ── Canvas sizing ────────────────────────────────────────────────────────
    function resize() {
      const W = wrap.clientWidth;
      const H = Math.max(320, Math.min(W * 0.72, 520));
      canvas.style.height = H + "px";
      canvas.width  = W  * devicePixelRatio;
      canvas.height = H  * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── Hit test ─────────────────────────────────────────────────────────────
    function hitNode(mx: number, my: number) {
      const W = wrap.clientWidth;
      const H = canvas.offsetHeight;
      const pos = getLayout(W, H);
      return NODES.find(n => {
        const p = pos[n.id];
        const dx = mx - p.x, dy = my - p.y;
        return Math.sqrt(dx * dx + dy * dy) < p.r + 6;
      }) ?? null;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const n = hitNode(e.clientX - rect.left, e.clientY - rect.top);
      const id = n ? n.id : null;
      setHovered(id);
      canvas.style.cursor = id ? "pointer" : "default";
    }

    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const n = hitNode(e.clientX - rect.left, e.clientY - rect.top);
      if (n) setSelected(n.id);
    }

    function onTouch(e: TouchEvent) {
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const n = hitNode(t.clientX - rect.left, t.clientY - rect.top);
      if (n) setSelected(n.id);
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchend", onTouch);

    // ── Draw loop ─────────────────────────────────────────────────────────────
    function draw(ts: number) {
      animRef.current = requestAnimationFrame(draw);

      const W   = wrap.clientWidth;
      const H   = canvas.offsetHeight;
      const pos = getLayout(W, H);

      // Spawn pulses
      if (ts - lastSpawn > 600) { spawnPulse(); lastSpawn = ts; }

      // Advance pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += pulses[i].speed;
        if (pulses[i].t > 1) pulses.splice(i, 1);
      }

      ctx.clearRect(0, 0, W, H);

      // ── Resolve CSS vars for colors ────────────────────────────────────────
      const cs       = getComputedStyle(document.documentElement);
      const isDark   = document.documentElement.classList.contains("dark");
      const edgeCol  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
      const nodeFill = isDark ? "rgba(59,130,246,0.15)"  : "rgba(59,130,246,0.08)";
      const nodeStr  = isDark ? "rgba(96,165,250,0.7)"   : "rgba(37,99,235,0.55)";
      const hubFill  = isDark ? "rgba(59,130,246,0.25)"  : "rgba(59,130,246,0.15)";
      const hubStr   = isDark ? "#60a5fa"                : "#2563eb";
      const textCol  = isDark ? "rgba(255,255,255,0.82)" : "rgba(15,23,42,0.82)";
      const hov      = hoveredRef.current;

      // ── Edges ──────────────────────────────────────────────────────────────
      EDGES.forEach(e => {
        const a = pos[e.from], b = pos[e.to];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = edgeCol;
        ctx.lineWidth   = 1;
        ctx.stroke();
      });

      // ── Pulses ─────────────────────────────────────────────────────────────
      pulses.forEach(p => {
        const e  = EDGES[p.edgeIdx];
        const a  = pos[e.from], b = pos[e.to];
        const x  = a.x + (b.x - a.x) * p.t;
        const y  = a.y + (b.y - a.y) * p.t;
        const fade = p.t < 0.1 ? p.t / 0.1 : p.t > 0.85 ? (1 - p.t) / 0.15 : 1;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${0.85 * fade})`;
        ctx.fill();
        // soft trail
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${0.18 * fade})`;
        ctx.fill();
      });

      // ── Nodes ──────────────────────────────────────────────────────────────
      NODES.forEach(n => {
        const p    = pos[n.id];
        const isH  = hov === n.id;
        const fill = n.hub ? hubFill : nodeFill;
        const str  = isH ? "#f59e0b" : (n.hub ? hubStr : nodeStr);

        // Glow on hover
        if (isH) {
          ctx.save();
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur  = 18;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(245,158,11,0.12)";
          ctx.fill();
          ctx.restore();
        }

        // Hub pulse ring
        if (n.hub) {
          const ring = ((ts * 0.001) % 1);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + ring * 20, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59,130,246,${0.15 * (1 - ring)})`;
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle   = fill;
        ctx.fill();
        ctx.strokeStyle = str;
        ctx.lineWidth   = isH ? 2 : 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle  = textCol;
        ctx.font       = `${n.hub ? 600 : 500} ${n.hub ? 13 : 11}px var(--font-sans, system-ui)`;
        ctx.textAlign  = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.label, p.x, p.y);
      });
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchend", onTouch);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            System map
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">What BioLogix actually is</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
          A plain-language map of every part of BioLogix - written for anyone who joins later
          and needs to understand what was built, why, and how it fits together,
          without reading any code.
        </p>
        <p className="text-xs text-primary font-medium mt-3">▸ Click any node to read about it</p>
      </div>

      {/* ── Canvas diagram ── */}
      <div
        ref={wrapRef}
        className="glass-card rounded-2xl overflow-hidden w-full"
      >
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* ── Team section ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            name     : "Gaji Yaqub Ayomikun",
            role     : "Co-founder & Lead Developer",
            img      : "/founders/Gaji.png",
            initials : "GY",
            bio      : "Built the entire infrastructure — FastAPI backend, PostgreSQL database, React frontend, biometric parser, analytics engine, and role-based access control.",
          },
          {
            name     : "Oladimeji Israel Opeyemi",
            role     : "Co-founder & Innovator",
            img      : "/founders/oladimeji.jpg",
            initials : "OO",
            bio      : "Drove the vision and strategic direction behind BioLogix, focusing on reducing manual HR workload and improving organisational decision-making through digital tools.",
          },
        ].map(person => (
          <div
            key={person.name}
            className="glass-card rounded-xl p-5 flex items-start gap-4"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 shrink-0 border border-border">
              <img
                src={person.img}
                alt={person.name}
                className="w-full h-full object-cover"
                onError={e => {
                  // Fallback to initials if image missing
                  const t = e.currentTarget;
                  t.style.display = "none";
                  const p = t.parentElement!;
                  p.style.display = "flex";
                  p.style.alignItems = "center";
                  p.style.justifyContent = "center";
                  p.innerHTML = `<span class="text-sm font-semibold text-primary">${person.initials}</span>`;
                }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{person.name}</p>
              <p className="text-xs text-primary mb-2">{person.role}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{person.bio}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <p className="text-xs text-muted-foreground text-center">
        Built by{" "}
        <span className="text-foreground font-medium">Gaji Yaqub Ayomikun</span>
        {" "}and{" "}
        <span className="text-foreground font-medium">Oladimeji Israel Opeyemi</span>
        {" "}for{" "}
        <span className="text-foreground font-medium">Blue World Cosmetics</span>
        {" "}·{" "}
        <span>a reference for whoever comes on board next</span>
      </p>

      {/* ── Modal ── */}
      {selected && (
        <Modal nodeId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}