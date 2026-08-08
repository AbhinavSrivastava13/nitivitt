/**
 * NitiInvest™ chart primitives — powered by recharts.
 *
 * Editorial, analytical treatments rather than generic dashboard charts.
 * Every chart answers one financial question, and comparison series
 * (You / Recommended / Peer) are always visually distinct.
 */
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LabelList, ReferenceLine,
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

/** Distinct series treatments — You (solid), Recommended (teal), Peer (muted amber). */
export const SERIES_COLORS = {
  you: "#4f46e5",
  recommended: "#0d9488",
  peer: "#c99a2e",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
  padding: "10px 12px",
  boxShadow: "0 12px 32px -12px rgba(0,0,0,0.28)",
};

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

export function ChartLegend({ items }: { items: { label: string; color: string; hint?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-baseline gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.color }} />
          <span className="text-[12px] font-semibold text-foreground">{i.label}</span>
          {i.hint && <span className="text-[11px] text-muted-foreground">{i.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

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
    <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-soft md:p-9">
      <div>
        <h4 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h4>
        {subtitle && <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-5 text-xs leading-relaxed text-muted-foreground">
          {empty ?? "No data yet."}
        </p>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center">
          <div className="relative mx-auto aspect-square w-full max-w-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="pct"
                  nameKey="label"
                  innerRadius="66%"
                  outerRadius="98%"
                  paddingAngle={1.5}
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                >
                  {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n) => [`${v}%`, n as string]} />
              </PieChart>
            </ResponsiveContainer>
            {(centerValue || centerLabel) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                {centerValue && <span className="font-display text-2xl text-foreground">{centerValue}</span>}
                {centerLabel && <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{centerLabel}</span>}
              </div>
            )}
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {data.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.label}</span>
                <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                </span>
                <span className="w-11 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted-foreground">{s.pct}%</span>
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

/**
 * You vs Recommended vs Peer — grouped columns with in-chart value labels so
 * the reader never has to decode a legend twice.
 */
export function AllocationBars({ rows }: { rows: { label: string; you: number; recommended: number; peer?: number }[] }) {
  const hasPeer = rows.some((r) => typeof r.peer === "number");
  const data = rows.map((r) => ({
    name: r.label,
    You: r.you,
    Recommended: r.recommended,
    ...(hasPeer ? { Peer: r.peer ?? 0 } : {}),
  }));
  return (
    <div>
      <ChartLegend
        items={[
          { label: "You", color: SERIES_COLORS.you, hint: "current mix" },
          { label: "Recommended", color: SERIES_COLORS.recommended, hint: "NitiCore™ target" },
          ...(hasPeer ? [{ label: "Peer", color: SERIES_COLORS.peer, hint: "typical for your cohort" }] : []),
        ]}
      />
      <div className="mt-5 h-[300px] w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: -14 }} barGap={6} barCategoryGap="26%">
            <CartesianGrid strokeDasharray="2 6" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              dy={6}
            />
            <YAxis unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} width={46} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n) => [`${v}%`, n as string]}
            />
            <Bar dataKey="You" fill={SERIES_COLORS.you} radius={[7, 7, 0, 0]} maxBarSize={38}>
              <LabelList dataKey="You" position="top" formatter={(v: number) => `${v}%`} style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="Recommended" fill={SERIES_COLORS.recommended} fillOpacity={0.85} radius={[7, 7, 0, 0]} maxBarSize={38} />
            {hasPeer && <Bar dataKey="Peer" fill={SERIES_COLORS.peer} fillOpacity={0.5} radius={[7, 7, 0, 0]} maxBarSize={38} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Holdings distribution — the largest position is emphasised, the rest recede.
 * The dashed line is the deterministic 15% concentration reference.
 */
export function HoldingsDistribution({ rows }: { rows: { name: string; pct: number }[] }) {
  const top = rows.slice(0, 10);
  const data = top.map((r, i) => ({
    name: r.name.length > 24 ? `${r.name.slice(0, 23)}…` : r.name,
    fullName: r.name,
    Share: r.pct,
    rank: i,
  }));
  if (data.length === 0) return null;
  const top5 = Math.round(top.slice(0, 5).reduce((a, r) => a + r.pct, 0) * 10) / 10;
  return (
    <div>
      <div style={{ height: Math.max(200, data.length * 40) }} className="w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 46, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <ReferenceLine
              x={15}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: "15% concentration line", position: "top", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, _n, p) => [
                `${v}% of portfolio${(p?.payload?.rank ?? 9) < 5 ? " · top 5 holding" : ""}`,
                (p?.payload?.fullName as string) ?? "Holding",
              ]}
              labelFormatter={() => ""}
            />
            <Bar dataKey="Share" radius={[0, 7, 7, 0]} maxBarSize={22}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.Share >= 25 ? "hsl(var(--destructive))" : d.Share >= 15 ? SERIES_COLORS.peer : SERIES_COLORS.you}
                  fillOpacity={i === 0 ? 1 : i < 5 ? 0.82 : 0.45}
                />
              ))}
              <LabelList dataKey="Share" position="right" formatter={(v: number) => `${v}%`} style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Largest holding is shown solid; your top five together are {top5}% of the portfolio. Past the dashed 15% line, one position starts to steer the whole outcome.
      </p>
    </div>
  );
}

/**
 * Peer benchmark — a lollipop comparison. You is a filled dot, the cohort is
 * a hollow marker, and the connector shows the distance between them.
 */
export function PeerLollipop({ rows }: { rows: { label: string; you: number; typical: number; unit: string; verdict: string }[] }) {
  const max = Math.max(...rows.map((r) => Math.max(r.you, r.typical)), 10);
  return (
    <div className="space-y-5">
      <ChartLegend
        items={[
          { label: "You", color: SERIES_COLORS.you },
          { label: "Typical for your cohort", color: SERIES_COLORS.peer },
        ]}
      />
      <ul className="space-y-4">
        {rows.map((r) => {
          const youPos = Math.min(100, (r.you / max) * 100);
          const peerPos = Math.min(100, (r.typical / max) * 100);
          const inLine = r.verdict.startsWith("In line");
          return (
            <li key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-foreground">{r.label}</span>
                <span className="flex items-baseline gap-3 font-mono text-[11px] tabular-nums">
                  <span className="text-foreground">{r.you}{r.unit}</span>
                  <span className="text-muted-foreground">cohort {r.typical}{r.unit}</span>
                </span>
              </div>
              <div className="relative mt-2.5 h-6">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                <div
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                  style={{
                    left: `${Math.min(youPos, peerPos)}%`,
                    width: `${Math.abs(youPos - peerPos)}%`,
                    background: inLine ? "hsl(var(--border))" : SERIES_COLORS.you,
                    opacity: inLine ? 1 : 0.35,
                  }}
                />
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                  style={{ left: `${peerPos}%`, borderColor: SERIES_COLORS.peer }}
                />
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ left: `${youPos}%`, background: SERIES_COLORS.you }}
                />
              </div>
              <p className={`mt-1.5 text-[11px] ${inLine ? "text-muted-foreground" : "text-foreground/80"}`}>{r.verdict}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Portfolio Projection — current path vs adjustable scenarios.
 * Illustrative compounding of a stated assumption, never a forecast.
 */
export function ProjectionChart({
  data, format, baseLabel, altLabel, thirdLabel,
}: {
  data: { year: number; base: number; alternative: number; third?: number }[];
  format: (n: number) => string;
  baseLabel: string;
  altLabel: string;
  thirdLabel?: string;
}) {
  const hasThird = Boolean(thirdLabel) && data.some((d) => typeof d.third === "number");
  return (
    <div>
      <ChartLegend
        items={[
          { label: baseLabel, color: SERIES_COLORS.you },
          { label: altLabel, color: SERIES_COLORS.recommended },
          ...(hasThird ? [{ label: thirdLabel as string, color: SERIES_COLORS.peer }] : []),
        ]}
      />
      <div className="mt-5 h-[320px] w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="np-base" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.you} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES_COLORS.you} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="np-alt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.recommended} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIES_COLORS.recommended} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 6" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(v: number) => (v === 0 ? "Today" : `${v}y`)}
              tick={AXIS_TICK}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              dy={6}
            />
            <YAxis tickFormatter={(v: number) => format(v)} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v: number) => (v === 0 ? "Today" : `In ${v} years`)}
              formatter={(v: number, n) => [
                format(v),
                n === "alternative" ? altLabel : n === "third" ? (thirdLabel ?? "Scenario") : baseLabel,
              ]}
            />
            {hasThird && (
              <Area
                type="monotone"
                dataKey="third"
                stroke={SERIES_COLORS.peer}
                strokeWidth={1.75}
                strokeDasharray="2 5"
                fill="transparent"
                dot={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="alternative"
              stroke={SERIES_COLORS.recommended}
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#np-alt)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="base"
              stroke={SERIES_COLORS.you}
              strokeWidth={2.5}
              fill="url(#np-base)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * You vs NitiCore™ Recommended — an explicit gap reader.
 * Deliberately not a chart you have to decode: each row states both numbers
 * and the distance between them in words.
 */
export function AllocationCompare({
  rows,
}: {
  rows: { label: string; you: number; recommended: number }[];
}) {
  const max = Math.max(100, ...rows.flatMap((r) => [r.you, r.recommended]));
  return (
    <div className="space-y-6">
      <ChartLegend
        items={[
          { label: "You", color: SERIES_COLORS.you, hint: "current mix" },
          { label: "NitiCore™ recommended", color: SERIES_COLORS.recommended, hint: "for your age, horizon & risk" },
        ]}
      />
      <ul className="space-y-5">
        {rows.map((r) => {
          const gap = Math.round((r.you - r.recommended) * 10) / 10;
          const aligned = Math.abs(gap) <= 5;
          return (
            <li key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-foreground">{r.label}</span>
                <span className="font-mono text-[12px] tabular-nums text-foreground">
                  {r.you}% <span className="px-1 text-muted-foreground">→</span> {r.recommended}%
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted/70">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(r.you / max) * 100}%`, background: SERIES_COLORS.you }}
                  />
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full border border-dashed border-border bg-transparent">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.recommended / max) * 100}%`,
                      background: `repeating-linear-gradient(135deg, ${SERIES_COLORS.recommended} 0 6px, ${SERIES_COLORS.recommended}66 6px 12px)`,
                    }}
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {aligned
                  ? "In line with the recommended band."
                  : gap > 0
                    ? `${Math.abs(gap)} percentage points above the recommended level.`
                    : `${Math.abs(gap)} percentage points below the recommended level.`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Premium segmented allocation bar — percentage and rupee value, no pie. */
export function SegmentedAllocation({
  slices,
  formatValue,
  empty,
}: {
  slices: Slice[];
  formatValue: (n: number) => string;
  empty?: string;
}) {
  const data = slices.filter((s) => s.pct > 0);
  if (data.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-5 text-xs leading-relaxed text-muted-foreground">
        {empty ?? "Data unavailable."}
      </p>
    );
  }
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {data.map((s, i) => (
          <span
            key={s.label}
            title={`${s.label} — ${s.pct}%`}
            style={{ width: `${s.pct}%`, background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {data.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2.5 border-b border-border/50 pb-1.5">
            <span className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px]" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">{s.label}</span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">{s.pct}%</span>
            {s.value > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatValue(s.value)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

