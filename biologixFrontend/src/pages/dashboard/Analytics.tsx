/**
 * Analytics.tsx
 * Premium analytics dashboard wired to /analytics/* endpoints.
 * Sections:
 *  1. KPI strip (workforce overview)
 *  2. Attendance trend — area chart, year selector, click-to-drilldown by month
 *  3. Department ranking — horizontal bar chart, click segment → punctuality modal
 *  4. Punctuality — bubble / bar chart, click → per-employee drilldown
 *  5. Clock-in behaviour — scatter of avg_clockin_time vs consistency_score
 *  6. Workforce simulator — drag-slider that projects output impact
 *  7. Department of the Month — trophy card
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Legend, ReferenceLine,
} from "recharts";
import {
  Trophy, TrendingUp, Users, AlertCircle, Clock,
  Activity, ChevronDown, X, Award, Zap, BarChart2,
  Star, ArrowUp, ArrowDown, Minus, RefreshCw
} from "lucide-react";

// ── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
function getToken() { return localStorage.getItem("biologix_token"); }
async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return r.json();
}

// ── Types ────────────────────────────────────────────────────────────────────
interface WorkforceOverview {
  total_employees: number; active_last_60_days: number;
  inactive_last_60_days: number; never_recorded: number;
  new_last_30_days: number; no_shift_assigned: number; no_dept_assigned: number;
  department_breakdown: { department_id: number | null; department_name: string; headcount: number }[];
}
interface TrendMonth {
  month: number; month_name: string;
  attendance_rate: number; total_present: number; total_expected: number;
}
interface DeptRank {
  department_id: number; department_name: string; employee_count: number;
  attendance_rate: number; punctuality_score: number; hours_rate: number;
  composite_score: number; days_present: number; expected_days: number;
  punctuality_breakdown: { early: number; on_time: number; late: number; very_late: number };
}
interface PunctualityRow {
  user_id: number; badge_number: string | number; name: string;
  department: string; shift: string; shift_start: string;
  total_check_ins: number; early: number; on_time: number;
  late: number; very_late: number; punctuality_rate: number; avg_mins_late: number;
}
interface ClockInRow {
  user_id: number; badge_number: string | number; name: string;
  department: string; shift: string; expected_start: string;
  avg_clockin_time: string; consistency_score: number;
  dominant_pattern: string; punctuality_rate: number;
  longest_absence_streak: number;
  punctuality_breakdown: { early: number; on_time: number; late: number; very_late: number };
}
interface DeptOfMonth {
  month: string; year: number;
  winner: DeptRank | null;
  ranking: DeptRank[];
}

// ── Color palette (matches project theme) ───────────────────────────────────
const PALETTE = {
  primary:   "#3b82f6",
  success:   "#22c55e",
  warning:   "#f59e0b",
  danger:    "#ef4444",
  purple:    "#a855f7",
  teal:      "#14b8a6",
  muted:     "#6b7280",
  dept: ["#3b82f6","#14b8a6","#a855f7","#f59e0b","#ef4444","#ec4899","#10b981","#f97316"],
};

const TREND_COLORS = { good: "#22c55e", mid: "#f59e0b", bad: "#ef4444" };
function trendColor(v: number) { return v >= 80 ? TREND_COLORS.good : v >= 60 ? TREND_COLORS.mid : TREND_COLORS.bad; }

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function kpi(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function pct(n: number) { return `${n.toFixed(1)}%`; }

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = "h-40", className = "" }: { h?: string; className?: string }) {
  return <div className={`${h} ${className} rounded-xl bg-secondary/40 animate-pulse`} />;
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Custom Tooltip base ───────────────────────────────────────────────────────
function ChartTip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 shadow-xl border border-border text-xs space-y-1 min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold text-foreground">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/70 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. KPI Strip
// ══════════════════════════════════════════════════════════════════════════════
function KpiStrip({ data }: { data: WorkforceOverview }) {
  const cards = [
    { label: "Total Employees",  value: kpi(data.total_employees),      icon: <Users className="h-4 w-4" />,    color: "text-primary",   bg: "bg-primary/10" },
    { label: "Active (60d)",     value: kpi(data.active_last_60_days),  icon: <Activity className="h-4 w-4" />, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Inactive (60d)",   value: kpi(data.inactive_last_60_days),icon: <Minus className="h-4 w-4" />,    color: "text-yellow-500",bg: "bg-yellow-500/10" },
    { label: "New (30d)",        value: kpi(data.new_last_30_days),     icon: <ArrowUp className="h-4 w-4" />,  color: "text-teal-400",  bg: "bg-teal-400/10" },
    { label: "No Shift",         value: kpi(data.no_shift_assigned),    icon: <AlertCircle className="h-4 w-4" />, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "No Department",    value: kpi(data.no_dept_assigned),     icon: <AlertCircle className="h-4 w-4" />, color: "text-red-500",  bg: "bg-red-500/10" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="glass-card rounded-xl p-4">
          <div className={`w-7 h-7 rounded-lg ${c.bg} ${c.color} flex items-center justify-center mb-2`}>{c.icon}</div>
          <p className="text-2xl font-bold text-foreground leading-none">{c.value}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Attendance Trend
// ══════════════════════════════════════════════════════════════════════════════
function AttendanceTrend({ year, deptId }: { year: number; deptId?: number }) {
  const [data, setData] = useState<TrendMonth[] | null>(null);
  const [drillMonth, setDrillMonth] = useState<TrendMonth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = deptId ? `&department_id=${deptId}` : "";
    api<TrendMonth[]>(`/analytics/attendance-trend?year=${year}${q}`)
      .then(setData).finally(() => setLoading(false));
  }, [year, deptId]);

  if (loading) return <Skeleton h="h-64" />;
  if (!data) return null;

  const avg = data.reduce((s, d) => s + d.attendance_rate, 0) / (data.filter(d => d.attendance_rate > 0).length || 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Year average: <strong className="text-foreground">{pct(avg)}</strong></span>
        <span className="text-xs text-muted-foreground">Click a point to drill down</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          onClick={(p) => p?.activePayload?.[0] && setDrillMonth(p.activePayload[0].payload)}>
          <defs>
            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PALETTE.primary} stopOpacity={0.35} />
              <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month_name" tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v}%`} />
          <Tooltip content={(p) => <ChartTip {...p} label={p.label} formatter={(v: number) => pct(v)} />} />
          <ReferenceLine y={avg} stroke={PALETTE.warning} strokeDasharray="4 4" strokeWidth={1} />
          <Area type="monotone" dataKey="attendance_rate" name="Attendance" stroke={PALETTE.primary}
            strokeWidth={2.5} fill="url(#ag)" dot={{ r: 4, fill: PALETTE.primary, strokeWidth: 2, stroke: "var(--background)" }}
            activeDot={{ r: 7, cursor: "pointer" }} />
        </AreaChart>
      </ResponsiveContainer>

      {drillMonth && (
        <Modal title={`${drillMonth.month_name} ${year} — Attendance Details`} onClose={() => setDrillMonth(null)}>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Attendance Rate", value: pct(drillMonth.attendance_rate), color: trendColor(drillMonth.attendance_rate) },
              { label: "Days Present",    value: drillMonth.total_present.toLocaleString(), color: "text-primary" },
              { label: "Days Expected",   value: drillMonth.total_expected.toLocaleString(), color: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${drillMonth.attendance_rate}%`,
              background: trendColor(drillMonth.attendance_rate),
            }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {drillMonth.total_present} of {drillMonth.total_expected} expected attendance-days fulfilled
          </p>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Department Ranking
// ══════════════════════════════════════════════════════════════════════════════
function DeptRanking({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<DeptRank[] | null>(null);
  const [selected, setSelected] = useState<DeptRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<DeptRank[]>(`/analytics/department-ranking?month=${month}&year=${year}`)
      .then(setData).finally(() => setLoading(false));
  }, [month, year]);

  if (loading) return <Skeleton h="h-64" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>;

  const chartData = data.map((d, i) => ({
    ...d, fill: PALETTE.dept[i % PALETTE.dept.length],
    label: d.department_name.length > 14 ? d.department_name.slice(0, 13) + "…" : d.department_name,
  }));

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Composite = attendance 50% + punctuality 30% + hours 20% — click a bar to drill down
      </p>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
          onClick={(p) => p?.activePayload?.[0] && setSelected(p.activePayload[0].payload)}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: PALETTE.muted }}
            axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: PALETTE.muted }}
            axisLine={false} tickLine={false} width={110} />
          <Tooltip content={(p) => (
            <ChartTip {...p} label={p.payload?.[0]?.payload?.department_name}
              formatter={(v: number, n: string) => n.includes("rate") || n.includes("score") ? pct(v) : v} />
          )} />
          <Bar dataKey="composite_score" name="Composite" radius={[0, 6, 6, 0]} cursor="pointer"
            label={{ position: "right", formatter: (v: number) => pct(v), fontSize: 11, fill: PALETTE.muted }}>
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {selected && (
        <Modal title={`${selected.department_name} — Full Breakdown`} onClose={() => setSelected(null)}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { l: "Composite", v: pct(selected.composite_score),   c: trendColor(selected.composite_score) },
              { l: "Attendance", v: pct(selected.attendance_rate),  c: trendColor(selected.attendance_rate) },
              { l: "Punctuality",v: pct(selected.punctuality_score),c: trendColor(selected.punctuality_score) },
              { l: "Hours Rate", v: pct(selected.hours_rate),       c: trendColor(selected.hours_rate) },
              { l: "Employees",  v: String(selected.employee_count),c: "text-primary" },
              { l: "Days Present",v:`${selected.days_present}/${selected.expected_days}`, c: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.l} className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          <p className="text-sm font-semibold text-foreground mb-3">Punctuality Breakdown</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { l: "Early",    v: selected.punctuality_breakdown.early,     c: "text-blue-400",   bg: "bg-blue-400/10" },
              { l: "On Time",  v: selected.punctuality_breakdown.on_time,   c: "text-green-500",  bg: "bg-green-500/10" },
              { l: "Late",     v: selected.punctuality_breakdown.late,      c: "text-yellow-500", bg: "bg-yellow-500/10" },
              { l: "Very Late",v: selected.punctuality_breakdown.very_late, c: "text-red-500",    bg: "bg-red-500/10" },
            ].map((s) => (
              <div key={s.l} className={`${s.bg} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={[
              { metric: "Attendance", value: selected.attendance_rate },
              { metric: "Punctuality",value: selected.punctuality_score },
              { metric: "Hours",      value: selected.hours_rate },
              { metric: "Composite",  value: selected.composite_score },
            ]}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: PALETTE.muted }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: PALETTE.muted }} axisLine={false} />
              <Radar name={selected.department_name} dataKey="value"
                stroke={PALETTE.primary} fill={PALETTE.primary} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Punctuality Analysis
// ══════════════════════════════════════════════════════════════════════════════
function PunctualityChart({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<PunctualityRow[] | null>(null);
  const [selected, setSelected] = useState<PunctualityRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<PunctualityRow[]>(`/analytics/punctuality?month=${month}&year=${year}`)
      .then(setData).finally(() => setLoading(false));
  }, [month, year]);

  if (loading) return <Skeleton h="h-56" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>;

  // Show top/bottom 12 by rate for readability
  const sorted = [...data].sort((a, b) => b.punctuality_rate - a.punctuality_rate);
  const display = [...sorted.slice(0, 6), ...sorted.slice(-6)].filter(
    (v, i, a) => a.findIndex(x => x.user_id === v.user_id) === i
  ).slice(0, 14);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Showing top & bottom employees — click a bar to drill down</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={display} margin={{ top: 0, right: 50, left: -10, bottom: 50 }}
          onClick={(p) => p?.activePayload?.[0] && setSelected(p.activePayload[0].payload)}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: PALETTE.muted }} angle={-35} textAnchor="end" interval={0} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v}%`} />
          <Tooltip content={(p) => (
            <ChartTip {...p} label={p.payload?.[0]?.payload?.name}
              formatter={(v: number) => pct(v)} />
          )} />
          <Bar dataKey="punctuality_rate" name="Rate" radius={[4, 4, 0, 0]} cursor="pointer">
            {display.map((d, i) => (
              <Cell key={i} fill={trendColor(d.punctuality_rate)} />
            ))}
          </Bar>
          <ReferenceLine y={80} stroke={PALETTE.success} strokeDasharray="4 4" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>

      {selected && (
        <Modal title={`${selected.name} — Punctuality Detail`} onClose={() => setSelected(null)}>
          <div className="flex items-center gap-3 mb-5 p-4 bg-secondary/40 rounded-xl">
            <div>
              <p className="font-semibold text-foreground">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.department} · Shift: {selected.shift} (starts {selected.shift_start})</p>
            </div>
            <div className="ml-auto text-right">
              <p className={`text-2xl font-bold ${trendColor(selected.punctuality_rate)}`}>{pct(selected.punctuality_rate)}</p>
              <p className="text-xs text-muted-foreground">punctuality rate</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { l: "Early",    v: selected.early,     c: "text-blue-400",   bg: "bg-blue-400/10" },
              { l: "On Time",  v: selected.on_time,   c: "text-green-500",  bg: "bg-green-500/10" },
              { l: "Late",     v: selected.late,      c: "text-yellow-500", bg: "bg-yellow-500/10" },
              { l: "Very Late",v: selected.very_late, c: "text-red-500",    bg: "bg-red-500/10" },
            ].map((s) => (
              <div key={s.l} className={`${s.bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          {selected.avg_mins_late > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
              <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-sm text-yellow-500">
                When late, averages <strong>{selected.avg_mins_late} minutes</strong> past shift start
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Clock-in Behaviour Scatter
// ══════════════════════════════════════════════════════════════════════════════
function ClockInBehaviour({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<ClockInRow[] | null>(null);
  const [selected, setSelected] = useState<ClockInRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<ClockInRow[]>(`/analytics/clockin-behaviour?month=${month}&year=${year}`)
      .then(setData).finally(() => setLoading(false));
  }, [month, year]);

  if (loading) return <Skeleton h="h-64" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>;

  // Convert avg_clockin_time "HH:MM" → decimal hour for scatter
  const scatterData = data.map((d) => {
    const [h, m] = (d.avg_clockin_time || "00:00").split(":").map(Number);
    return { ...d, x: h + m / 60, y: d.consistency_score, z: d.punctuality_rate };
  });

  const PATTERN_COLOR: Record<string, string> = {
    early: PALETTE.primary, on_time: PALETTE.success,
    late: PALETTE.warning, very_late: PALETTE.danger, unknown: PALETTE.muted,
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        X = avg clock-in hour · Y = consistency score · colour = dominant pattern · click a dot to inspect
      </p>
      <div className="flex gap-4 flex-wrap mb-3">
        {Object.entries({ early: "Early", on_time: "On Time", late: "Late", very_late: "Very Late" }).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PATTERN_COLOR[k] }} />
            {l}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
          onClick={(p: any) => {
            if (p?.activePayload?.[0]) setSelected(p.activePayload[0].payload);
          }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" dataKey="x" name="Clock-in hour" domain={[4, 22]}
            tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`} />
          <YAxis type="number" dataKey="y" name="Consistency" domain={[0, 100]}
            tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v}`} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={(props: any) => {
            const d = props.payload?.[0]?.payload as ClockInRow & { x: number; y: number } | undefined;
            if (!d) return null;
            return (
              <div className="glass-card rounded-xl px-4 py-3 shadow-xl border border-border text-xs space-y-1 min-w-[180px]">
                <p className="font-semibold text-foreground">{d.name}</p>
                <p className="text-muted-foreground">{d.department}</p>
                <div className="flex justify-between gap-4 pt-1">
                  <span className="text-muted-foreground">Clock-in</span>
                  <span className="font-semibold text-foreground">{d.avg_clockin_time}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Consistency</span>
                  <span className="font-semibold text-foreground">{d.consistency_score.toFixed(1)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Punctuality</span>
                  <span className="font-semibold" style={{ color: trendColor(d.punctuality_rate) }}>{pct(d.punctuality_rate)}</span>
                </div>
              </div>
            );
          }} />
          <Scatter data={scatterData} cursor="pointer">
            {scatterData.map((d, i) => (
              <Cell key={i} fill={PATTERN_COLOR[d.dominant_pattern] || PALETTE.muted} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {selected && (
        <Modal title={`${selected.name} — Clock-in Profile`} onClose={() => setSelected(null)}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {[
              { l: "Avg Clock-in",   v: selected.avg_clockin_time,                  c: "text-primary" },
              { l: "Consistency",    v: `${selected.consistency_score.toFixed(1)}`, c: trendColor(selected.consistency_score) },
              { l: "Punctuality",    v: pct(selected.punctuality_rate),              c: trendColor(selected.punctuality_rate) },
              { l: "Shift Start",    v: selected.expected_start,                     c: "text-muted-foreground" },
              { l: "Shift",          v: selected.shift,                              c: "text-muted-foreground" },
              { l: "Absence Streak", v: `${selected.longest_absence_streak}d`,      c: selected.longest_absence_streak > 3 ? "text-red-500" : "text-muted-foreground" },
            ].map((s) => (
              <div key={s.l} className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>

          <p className="text-sm font-semibold text-foreground mb-3">Pattern Distribution</p>
          <div className="space-y-2">
            {[
              { l: "Early",     v: selected.punctuality_breakdown.early,     color: PALETTE.primary },
              { l: "On Time",   v: selected.punctuality_breakdown.on_time,   color: PALETTE.success },
              { l: "Late",      v: selected.punctuality_breakdown.late,      color: PALETTE.warning },
              { l: "Very Late", v: selected.punctuality_breakdown.very_late, color: PALETTE.danger },
            ].map((s) => {
              const total = Object.values(selected.punctuality_breakdown).reduce((a, b) => a + b, 0);
              const w = total ? (s.v / total) * 100 : 0;
              return (
                <div key={s.l} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">{s.l}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w}%`, background: s.color }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-6 text-right">{s.v}</span>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Workforce Simulator
// ══════════════════════════════════════════════════════════════════════════════
function WorkforceSimulator({ overview }: { overview: WorkforceOverview | null }) {
  const [availability, setAvailability] = useState(75);
  const [efficiency, setEfficiency] = useState(80);

  if (!overview) return <Skeleton h="h-40" />;

  const active = overview.active_last_60_days;
  const total  = overview.total_employees || 1;

  // Simulate: effective_workers = active × (availability/100) × (efficiency/100)
  const effective   = Math.round(active * (availability / 100) * (efficiency / 100));
  const outputUnits = Math.round(effective * 8 * (efficiency / 100)); // hrs/day proxy
  const baseOutput  = Math.round(active * 8 * 0.8); // baseline

  const delta  = outputUnits - baseOutput;
  const deltaP = ((delta / (baseOutput || 1)) * 100).toFixed(1);
  const positive = delta >= 0;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Drag the sliders to project how changes in availability and efficiency affect daily output.
        Based on <strong className="text-foreground">{active}</strong> active employees.
      </p>

      <div className="grid gap-4">
        {/* Availability slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Workforce Availability</label>
            <span className="text-sm font-bold text-primary">{availability}%</span>
          </div>
          <input type="range" min={10} max={100} step={1} value={availability}
            onChange={(e) => setAvailability(+e.target.value)}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary" />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>10% (Crisis)</span><span>100% (Full)</span>
          </div>
        </div>

        {/* Efficiency slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Performance Efficiency</label>
            <span className="text-sm font-bold text-purple-400">{efficiency}%</span>
          </div>
          <input type="range" min={10} max={100} step={1} value={efficiency}
            onChange={(e) => setEfficiency(+e.target.value)}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-purple-400" />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>10% (Minimal)</span><span>100% (Peak)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Effective Workers", v: effective.toLocaleString(),   c: "text-primary" },
          { l: "Projected Output",  v: `${outputUnits.toLocaleString()} h`, c: positive ? "text-green-500" : "text-red-500" },
          { l: "vs Baseline",       v: `${positive ? "+" : ""}${deltaP}%`, c: positive ? "text-green-500" : "text-red-500" },
          { l: "Coverage Rate",     v: pct((effective / total) * 100), c: trendColor((effective / total) * 100) },
        ].map((s) => (
          <div key={s.l} className="bg-secondary/50 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Visual bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Projected capacity vs baseline</span>
          <span className={positive ? "text-green-500" : "text-red-500"}>
            {positive ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}
            {Math.abs(+deltaP)}% {positive ? "above" : "below"} baseline
          </span>
        </div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (outputUnits / (baseOutput * 1.2)) * 100)}%`, background: positive ? PALETTE.success : PALETTE.danger }} />
          {/* baseline marker at ~83% of bar width */}
          <div className="absolute top-0 h-full w-0.5 bg-white/40" style={{ left: `${(baseOutput / (baseOutput * 1.2)) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>0</span>
          <span className="text-white/30">▲ baseline</span>
          <span>+20%</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. Department of the Month Trophy
// ══════════════════════════════════════════════════════════════════════════════
function DeptOfMonth({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<DeptOfMonth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<DeptOfMonth>(`/analytics/department-of-month?month=${month}&year=${year}`)
      .then(setData).finally(() => setLoading(false));
  }, [month, year]);

  if (loading) return <Skeleton h="h-32" />;
  if (!data?.winner) return <p className="text-sm text-muted-foreground text-center py-4">No data for this period.</p>;

  const { winner, ranking } = data;

  return (
    <div className="space-y-4">
      {/* Winner hero */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Trophy className="h-7 w-7 text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-yellow-500 font-semibold uppercase tracking-wider mb-0.5">
              {data.month} {data.year} Winner
            </p>
            <p className="text-2xl font-bold text-foreground">{winner.department_name}</p>
            <p className="text-xs text-muted-foreground">{winner.employee_count} employees · Composite: <strong className="text-yellow-500">{pct(winner.composite_score)}</strong></p>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Star className="h-32 w-32 text-yellow-500" />
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="space-y-2">
        {ranking.slice(0, 5).map((d, i) => (
          <div key={d.department_id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
              {i + 1}
            </span>
            <span className="text-sm text-foreground flex-1">{d.department_name}</span>
            <span className="text-xs text-muted-foreground">{d.employee_count} emp</span>
            <span className={`text-sm font-bold ${trendColor(d.composite_score)}`}>{pct(d.composite_score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Analytics Page
// ══════════════════════════════════════════════════════════════════════════════
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NOW = new Date();

export default function Analytics() {
  const [overview, setOverview] = useState<WorkforceOverview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);

  const [trendYear, setTrendYear] = useState(NOW.getFullYear());
  const [rankMonth, setRankMonth] = useState(NOW.getMonth() + 1);
  const [rankYear,  setRankYear]  = useState(NOW.getFullYear());

  const yearOptions = Array.from({ length: 6 }, (_, i) => NOW.getFullYear() - i);

  useEffect(() => {
    setOvLoading(true);
    api<WorkforceOverview>("/analytics/workforce-overview")
      .then(setOverview).finally(() => setOvLoading(false));
  }, []);

  return (
    <div className="space-y-8 pb-12">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Workforce intelligence & attendance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-xs text-muted-foreground">Live data</span>
        </div>
      </div>

      {/* ── 1. KPI Strip ── */}
      {ovLoading
        ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} h="h-24" />)}</div>
        : overview && <KpiStrip data={overview} />
      }

      {/* ── 2. Attendance Trend + 7. Dept of Month ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Attendance Trend" subtitle="Monthly rate over the year" />
            <select value={trendYear} onChange={(e) => setTrendYear(+e.target.value)}
              className="text-xs bg-secondary text-foreground rounded-lg px-3 py-1.5 border border-border">
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <AttendanceTrend year={trendYear} />
        </div>

        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Dept of the Month" subtitle="Highest composite score" />
          <DeptOfMonth month={rankMonth} year={rankYear} />
        </div>
      </div>

      {/* ── Period selector ── */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis Period</span>
        <select value={rankMonth} onChange={(e) => setRankMonth(+e.target.value)}
          className="text-sm bg-secondary text-foreground rounded-lg px-3 py-1.5 border border-border">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={rankYear} onChange={(e) => setRankYear(+e.target.value)}
          className="text-sm bg-secondary text-foreground rounded-lg px-3 py-1.5 border border-border">
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-1">Applied to ranking, punctuality, clock-in & simulator below ↓</span>
      </div>

      {/* ── 3 & 4. Ranking + Punctuality ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<BarChart2 className="h-4 w-4" />} title="Department Ranking" subtitle="Composite performance score" />
          <DeptRanking month={rankMonth} year={rankYear} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<Clock className="h-4 w-4" />} title="Punctuality Analysis" subtitle="Top & bottom performers" />
          <PunctualityChart month={rankMonth} year={rankYear} />
        </div>
      </div>

      {/* ── 5 & 6. Clock-in Behaviour + Simulator ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<Activity className="h-4 w-4" />} title="Clock-in Behaviour" subtitle="Consistency vs arrival time" />
          <ClockInBehaviour month={rankMonth} year={rankYear} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<Zap className="h-4 w-4" />} title="Workforce Simulator"
            subtitle="Drag sliders to project output impact" />
          <WorkforceSimulator overview={overview} />
        </div>
      </div>

      {/* ── Department headcount strip ── */}
      {overview && (
        <div className="glass-card rounded-2xl p-5">
          <SectionHeader icon={<Users className="h-4 w-4" />} title="Department Headcount" subtitle="Current distribution" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={overview.department_breakdown.filter(d => d.headcount > 0)}
              margin={{ top: 0, right: 8, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="department_name" tick={{ fontSize: 10, fill: PALETTE.muted }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={(p) => <ChartTip {...p} label={p.label} />} />
              <Bar dataKey="headcount" name="Headcount" radius={[4, 4, 0, 0]}>
                {overview.department_breakdown.map((_, i) => (
                  <Cell key={i} fill={PALETTE.dept[i % PALETTE.dept.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}