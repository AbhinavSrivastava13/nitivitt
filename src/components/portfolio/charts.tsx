/**
 * NitiInvest™ premium chart primitives — powered by recharts.
 * All charts share a design-token palette so light/dark themes stay consistent.
 */
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

// Softer, INDmoney/Apple-Health inspired palette — muted jewel tones, high contrast in both themes.
export const CHART_PALETTE = [
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#ec4899", // pink
  "#22c55e", // emerald
  "#f97316", // orange
];

export interface Slice { label: string; pct: number; value: number }

interface DonutProps {
  title: string;
  subtitle?: string;
  slices: Slice[];
  empty?: string;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({ title, subtitle, slices, empty, centerLabel, centerValue }: DonutProps) {
  const data = slices.slice(0, 7);
  const total = data.reduce((a, s) => a + s.pct, 0);
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-soft md:p-10">
      <div>
        <h4 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h4>
        {subtitle && <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="mt-8 text-xs text-muted-foreground">{empty ?? "No data yet."}</p>
      ) : (
        <div className="mt-10 grid gap-10 sm:grid-cols-[360px_1fr] sm:items-center">
          <div className="relative mx-auto h-[360px] w-[360px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="pct"
                  nameKey="label"
                  innerRadius={112}
                  outerRadius={170}
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={4}
                >
                  {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
                  }}
                  formatter={(v: number, n) => [`${v}%`, n as string]}
                />
              </PieChart>
            </ResponsiveContainer>
            {(centerValue || centerLabel) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                {centerValue && <span className="font-display text-3xl text-foreground">{centerValue}</span>}
                {centerLabel && <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{centerLabel}</span>}
              </div>
            )}
          </div>
          <ul className="space-y-2.5 text-[13px]">
            {data.map((s, i) => (
              <li key={s.label} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface/70">
                <span className="flex min-w-0 items-center gap-3 text-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                  <span className="truncate font-medium">{s.label}</span>
                </span>
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{s.pct}%</span>
              </li>
            ))}
            {total < 99.5 && (
              <li className="pt-2 text-[10px] italic text-muted-foreground">Shown: {total.toFixed(0)}% of tracked value</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface GaugeProps {
  title: string;
  subtitle?: string;
  value: number; // 0..100
  label: string;
  tone?: "primary" | "success" | "warning" | "danger";
  footer?: React.ReactNode;
}

const TONE_COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success, 142 71% 45%))",
  warning: "#f59e0b",
  danger: "hsl(var(--destructive))",
};

export function Gauge({ title, subtitle, value, label, tone = "primary", footer }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [{ name: title, value: clamped, fill: TONE_COLORS[tone] }];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="relative mt-3 h-[160px]">
        <ResponsiveContainer>
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="font-display text-3xl leading-none text-foreground">{clamped}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className="mt-2 text-center text-sm font-semibold text-foreground">{label}</p>
      {footer && <div className="mt-2 text-center text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Distinct series colours — You / Recommended / Peer average. */
export const SERIES_COLORS = {
  you: "#6366f1",
  recommended: "#14b8a6",
  peer: "#f59e0b",
};

export function AllocationBars({ rows }: { rows: { label: string; you: number; recommended: number; peer?: number }[] }) {
  const hasPeer = rows.some((r) => typeof r.peer === "number");
  const data = rows.map((r) => ({
    name: r.label,
    You: r.you,
    Recommended: r.recommended,
    ...(hasPeer ? { "Peer average": r.peer ?? 0 } : {}),
  }));
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <YAxis unit="%" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            formatter={(v: number, n) => [`${v}%`, n as string]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="You" fill={SERIES_COLORS.you} radius={[6, 6, 0, 0]} />
          <Bar dataKey="Recommended" fill={SERIES_COLORS.recommended} radius={[6, 6, 0, 0]} />
          {hasPeer && <Bar dataKey="Peer average" fill={SERIES_COLORS.peer} radius={[6, 6, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal distribution of individual holdings by share of portfolio. */
export function HoldingsDistribution({ rows }: { rows: { name: string; pct: number }[] }) {
  const data = rows.slice(0, 10).map((r) => ({ name: r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name, Share: r.pct }));
  if (data.length === 0) return null;
  return (
    <div style={{ height: Math.max(200, data.length * 38) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" unit="%" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => [`${v}%`, "Share"]}
          />
          <Bar dataKey="Share" radius={[0, 6, 6, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.Share >= 25 ? "hsl(var(--destructive))" : d.Share >= 15 ? SERIES_COLORS.peer : SERIES_COLORS.you} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Peer benchmark — you vs your cohort, per metric. */
export function PeerBars({ rows }: { rows: { label: string; you: number; typical: number; unit: string }[] }) {
  const data = rows.map((r) => ({ name: r.label, You: r.you, "Peer cohort": r.typical }));
  return (
    <div style={{ height: Math.max(260, data.length * 46) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="You" fill={SERIES_COLORS.you} radius={[0, 5, 5, 0]} />
          <Bar dataKey="Peer cohort" fill={SERIES_COLORS.peer} radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


interface HeroScoreProps { score: number; label: string }

export function HeroScore({ score, label }: HeroScoreProps) {
  const s = Math.max(0, Math.min(100, score));
  const tone = s >= 75 ? "success" : s >= 55 ? "primary" : "danger";
  const color = TONE_COLORS[tone];
  const data = [{ name: "score", value: s, fill: color }];
  return (
    <div className="relative mx-auto h-[360px] w-[360px] md:h-[440px] md:w-[440px]">
      <ResponsiveContainer>
        <RadialBarChart innerRadius="82%" outerRadius="100%" data={data} startAngle={225} endAngle={-45}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={24} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">NitiInvest™</span>
        <span className="mt-3 font-display text-8xl leading-none text-foreground md:text-9xl">{s}</span>
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">out of 100</span>
        <span className="mt-4 max-w-[200px] text-center text-[13px] font-semibold text-foreground/90">{label}</span>
      </div>
    </div>
  );
}
