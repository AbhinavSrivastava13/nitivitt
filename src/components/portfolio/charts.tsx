/**
 * NitiInvest™ visualization system - powered by recharts.
 *
 * Design principle: different question → different visualisation.
 *   Comparison    → grouped horizontal bars
 *   Composition   → donut / stacked bar
 *   Concentration → ranked bars + threshold line
 *   Sector        → treemap
 *   Diagnostics   → rings, meters, threshold markers
 *   Projection    → interactive line chart
 *
 * Colour is semantic and used sparingly. Charts communicate through position,
 * shape, typography and labels first.
 */
import { Fragment, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  LabelList,
  ReferenceLine,
  Treemap,
} from "recharts";

/** Semantic series colours - one meaning per colour, used sparingly. */
export const SERIES_COLORS = {
  you: "#3f4d75", // current user position - calm slate-indigo
  recommended: "#0d9488", // scenario / alternative series - teal
  nitiCore: "#9c8355", // NitiCore™ recommendation - muted champagne
  positive: "#15803d",
  attention: "#b45309",
  action: "#b91c1c",
  peer: "#8b7f5e",
};

/** Restrained composition palette - differentiated without being loud. */
export const CHART_PALETTE = [
  "#3f4d75",
  "#0d9488",
  "#6b7fb3",
  "#4c8fa8",
  "#8b7f5e",
  "#9a6b8e",
  "#5f7a5c",
  "#a8a29e",
];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  color: "var(--foreground)",
  boxShadow: "0 12px 32px -14px rgba(0,0,0,0.3)",
};

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; hint?: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-baseline gap-2">
          <span
            className="mt-1 h-2.5 w-4 shrink-0 rounded-[2px]"
            style={
              i.dashed
                ? {
                    background: `repeating-linear-gradient(135deg, ${i.color} 0 4px, transparent 4px 7px)`,
                    border: `1px solid ${i.color}`,
                  }
                : { background: i.color }
            }
          />
          <span className="text-[12px] font-semibold text-foreground">{i.label}</span>
          {i.hint && <span className="text-[11px] text-muted-foreground">{i.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

export interface Slice {
  label: string;
  pct: number;
  value: number;
}

export function NoData({ children }: { children?: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-xs leading-relaxed text-muted-foreground">
      {children ?? "Data not available."}
    </p>
  );
}

/* ───────────────── COMPARISON - You vs NitiCore™ ───────────────── */

export function ComparisonBars({
  rows,
}: {
  rows: { label: string; you: number; recommended: number }[];
}) {
  const max = Math.max(100, ...rows.flatMap((r) => [r.you, r.recommended]));
  return (
    <div className="space-y-7">
      <ChartLegend
        items={[
          { label: "You", color: SERIES_COLORS.you, hint: "current mix" },
          {
            label: "NitiCore™ recommended",
            color: SERIES_COLORS.nitiCore,
            hint: "your age, horizon & risk",
            dashed: true,
          },
        ]}
      />
      <ul className="space-y-6">
        {rows.map((r) => {
          const gap = Math.round((r.you - r.recommended) * 10) / 10;
          const aligned = Math.abs(gap) <= 5;
          return (
            <li key={r.label} className="group">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-foreground">{r.label}</span>
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">{r.you}%</span>
                  <span className="px-1.5">→</span>
                  {r.recommended}%
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    You
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/70">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${(r.you / max) * 100}%`, background: SERIES_COLORS.you }}
                    />
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Target
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full border border-dashed border-border">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(r.recommended / max) * 100}%`,
                        background: `repeating-linear-gradient(135deg, ${SERIES_COLORS.nitiCore} 0 5px, ${SERIES_COLORS.nitiCore}55 5px 10px)`,
                      }}
                    />
                  </span>
                </div>
              </div>
              {!aligned && (
                <p className="mt-2 text-[11px] text-foreground/75">
                  <span className="font-mono tabular-nums font-semibold">
                    {gap > 0 ? "+" : "−"}
                    {Math.abs(gap)}
                  </span>{" "}
                  percentage points {gap > 0 ? "above" : "below"} the recommended level.
                </p>
              )}
              {aligned && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  In line with the recommended band.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────────── COMPOSITION - donut ───────────────── */

export function AllocationDonut({
  slices,
  formatValue,
  centerLabel,
  centerValue,
  empty,
}: {
  slices: Slice[];
  formatValue: (n: number) => string;
  centerLabel: string;
  centerValue: string;
  empty?: string;
}) {
  const data = slices.filter((s) => s.pct > 0).slice(0, 8);
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return <NoData>{empty}</NoData>;

  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
      <div className="relative mx-auto aspect-square w-full max-w-[240px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="label"
              innerRadius="68%"
              outerRadius="99%"
              paddingAngle={1.5}
              stroke="var(--card)"
              strokeWidth={3}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  fillOpacity={active === null || active === i ? 1 : 0.28}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n) => [`${v}%`, n as string]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl text-foreground">
            {active === null ? centerValue : `${data[active].pct}%`}
          </span>
          <span className="mt-1 max-w-[70%] text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {active === null ? centerLabel : data[active].label}
          </span>
        </div>
      </div>
      <ul className="space-y-0.5">
        {data.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-baseline gap-3 rounded-lg px-2.5 py-2 transition-colors ${active === i ? "bg-muted/60" : ""}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px]"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {s.label}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">{s.pct}%</span>
            {s.value > 0 && (
              <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatValue(s.value)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────── CONCENTRATION - ranked bars ───────────────── */

export function ConcentrationBars({
  rows,
  formatValue,
  threshold = 15,
}: {
  rows: { name: string; pct: number; value?: number }[];
  formatValue: (n: number) => string;
  threshold?: number;
}) {
  const top = rows.slice(0, 10);
  if (top.length === 0) return <NoData />;
  const data = top.map((r, i) => ({
    name: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name,
    fullName: r.name,
    Share: r.pct,
    rank: i,
  }));
  const top5 = Math.round(top.slice(0, 5).reduce((a, r) => a + r.pct, 0) * 10) / 10;
  const largest = top[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Largest position
          </p>
          <p className="mt-1 font-display text-xl leading-tight text-foreground">{largest.name}</p>
        </div>
        <p className="font-mono text-[13px] tabular-nums text-foreground">
          {largest.pct}%{largest.value ? ` · ${formatValue(largest.value)}` : ""}
        </p>
      </div>
      <div style={{ height: Math.max(190, data.length * 38) }} className="mt-5 w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 48, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              x={threshold}
              stroke={SERIES_COLORS.attention}
              strokeDasharray="5 4"
              label={{
                value: `${threshold}% concentration line`,
                position: "top",
                fill: SERIES_COLORS.attention,
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.25 }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, _n, p) => [
                `${v}% of portfolio${(p?.payload?.rank ?? 9) < 5 ? " · top 5 holding" : ""}`,
                (p?.payload?.fullName as string) ?? "Holding",
              ]}
              labelFormatter={() => ""}
            />
            <Bar dataKey="Share" radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.Share >= 25
                      ? SERIES_COLORS.action
                      : d.Share >= threshold
                        ? SERIES_COLORS.attention
                        : SERIES_COLORS.you
                  }
                  fillOpacity={i === 0 ? 1 : i < 5 ? 0.75 : 0.4}
                />
              ))}
              <LabelList
                dataKey="Share"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Your top five holdings are <span className="font-semibold text-foreground">{top5}%</span> of
        the portfolio. Past the {threshold}% line, a single position starts to steer the whole
        outcome.
      </p>
    </div>
  );
}

/* ───────────────── STACKED COMPOSITION - market cap ───────────────── */

export function StackedComposition({
  slices,
  formatValue,
  caption,
  empty,
}: {
  slices: Slice[];
  formatValue: (n: number) => string;
  caption?: React.ReactNode;
  empty?: string;
}) {
  const data = slices.filter((s) => s.pct > 0);
  const [active, setActive] = useState<string | null>(null);
  if (data.length === 0) return <NoData>{empty}</NoData>;
  return (
    <div>
      {caption}
      <div className="mt-5 flex h-9 w-full overflow-hidden rounded-lg">
        {data.map((s, i) => (
          <span
            key={s.label}
            onMouseEnter={() => setActive(s.label)}
            onMouseLeave={() => setActive(null)}
            title={`${s.label} - ${s.pct}%`}
            style={{
              width: `${s.pct}%`,
              background: CHART_PALETTE[i % CHART_PALETTE.length],
              opacity: active === null || active === s.label ? 1 : 0.35,
            }}
            className="flex h-full items-center justify-center transition-opacity"
          >
            {s.pct >= 12 && (
              <span className="px-1 font-mono text-[11px] tabular-nums text-white/95">
                {s.pct}%
              </span>
            )}
          </span>
        ))}
      </div>
      <ul className="mt-5 space-y-1">
        {data.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setActive(s.label)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-baseline gap-3 rounded-lg px-2 py-1.5 transition-colors ${active === s.label ? "bg-muted/60" : ""}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px]"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
              {s.label}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">{s.pct}%</span>
            {s.value > 0 && (
              <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatValue(s.value)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────── SECTOR - treemap ───────────────── */

interface TreemapNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  pct?: number;
}

function SectorTile(props: TreemapNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, name = "", pct = 0 } = props;
  const color = CHART_PALETTE[index % CHART_PALETTE.length];
  const showLabel = width > 66 && height > 34;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={color}
        stroke="var(--card)"
        strokeWidth={3}
      />
      {showLabel && (
        <>
          <text x={x + 10} y={y + 20} fill="#fff" fontSize={11} fontWeight={600}>
            {name.length > Math.floor(width / 7)
              ? `${name.slice(0, Math.max(3, Math.floor(width / 7) - 1))}…`
              : name}
          </text>
          <text x={x + 10} y={y + 36} fill="rgba(255,255,255,0.85)" fontSize={11}>
            {pct}%
          </text>
        </>
      )}
    </g>
  );
}

export function SectorTreemap({
  slices,
  formatValue,
  empty,
  height = 260,
  columns = 2,
}: {
  slices: Slice[];
  formatValue: (n: number) => string;
  empty?: string;
  height?: number;
  columns?: 2 | 3;
}) {
  const data = slices
    .filter((s) => s.pct > 0)
    .map((s) => ({ name: s.label, size: s.pct, pct: s.pct, value: s.value }));
  if (data.length === 0) return <NoData>{empty}</NoData>;
  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer>
          <Treemap
            data={data}
            dataKey="size"
            stroke="var(--card)"
            isAnimationActive={false}
            content={<SectorTile />}
          >
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, _n, p) => [`${v}%`, (p?.payload?.name as string) ?? "Sector"]}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <ul
        className={`mt-5 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}
      >
        {data.slice(0, columns === 3 ? 9 : 8).map((s, i) => (
          <li key={s.name} className="flex items-baseline gap-2.5 border-b border-border/50 pb-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px]"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
              {s.name}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">{s.pct}%</span>
            {s.value > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatValue(s.value)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────── DIAGNOSTIC INDICATORS ───────────────── */

export function ScoreRing({
  value,
  color,
  size = 44,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
      />
    </svg>
  );
}

export function MiniMeter({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(3, v)}%`, background: color }}
      />
    </span>
  );
}

export function ThresholdMarker({
  value,
  threshold,
  color,
}: {
  value: number;
  threshold: number;
  color: string;
}) {
  const scale = Math.max(100, value * 1.2, threshold * 1.6);
  return (
    <span className="relative block h-5 w-full">
      <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: `${(Math.min(value, scale) / scale) * 100}%`, background: color }}
        />
      </span>
      <span
        className="absolute top-0 h-5 border-l border-dashed"
        style={{ left: `${(threshold / scale) * 100}%`, borderColor: "var(--muted-foreground)" }}
      />
    </span>
  );
}

/* ───────────────── PROJECTION - interactive line chart ───────────────── */

export function ProjectionChart({
  data,
  format,
  series,
  height = 320,
  fill = false,
}: {
  data: { year: number; base: number; alternative: number; third?: number }[];
  format: (n: number) => string;
  series: { key: "base" | "alternative" | "third"; label: string; color: string; dash?: string }[];
  height?: number | string;
  /** When true, the chart stretches to fill its flex parent instead of using a fixed height. */
  fill?: boolean;
}) {
  const labelOf = (k: string) => series.find((s) => s.key === k)?.label ?? k;
  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <ChartLegend
        items={series.map((s) => ({ label: s.label, color: s.color, dashed: Boolean(s.dash) }))}
      />
      <div
        className={`mt-4 w-full ${fill ? "min-h-0 flex-1" : ""}`}
        style={fill ? undefined : { height }}
      >
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(v: number) => (v === 0 ? "Today" : `${v}y`)}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              dy={6}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v: number) => format(v)}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v: number) => (v === 0 ? "Today" : `In ${v} years`)}
              formatter={(v: number, n) => [format(v), labelOf(n as string)]}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={s.key === "base" ? 2.5 : 2}
                strokeDasharray={s.dash}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ───────────────── CONCENTRATION - editorial ladder ───────────────── */

/**
 * Holdings distribution, presented as an editorial ranked ladder rather than a
 * chart. The largest position is stated in full; every other holding is a thin
 * measured rule against a shared scale, with the concentration threshold drawn
 * once as a quiet vertical guide.
 */
export function ConcentrationLadder({
  rows,
  formatValue,
  threshold = 15,
}: {
  rows: { name: string; pct: number; value?: number }[];
  formatValue: (n: number) => string;
  threshold?: number;
}) {
  const top = rows.slice(0, 10);
  if (top.length === 0) return <NoData />;
  const scale = Math.max(threshold * 1.6, ...top.map((r) => r.pct)) * 1.08;
  const lead = top[0];
  const rest = top.slice(1);
  const top5 = Math.round(top.slice(0, 5).reduce((a, r) => a + r.pct, 0) * 10) / 10;
  const guide = (threshold / scale) * 100;
  const toneOf = (p: number) =>
    p >= 25 ? SERIES_COLORS.action : p >= threshold ? SERIES_COLORS.attention : SERIES_COLORS.you;

  return (
    <div>
      {/* Lead position */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface/60 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Largest position
            </p>
            <p className="mt-1 truncate font-display text-xl leading-tight text-foreground">
              {lead.name}
            </p>
          </div>
          <div className="text-right">
            <p
              className="font-display text-3xl leading-none tracking-tight"
              style={{ color: toneOf(lead.pct) }}
            >
              {lead.pct}%
            </p>
            {lead.value ? (
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatValue(lead.value)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{ width: `${(lead.pct / scale) * 100}%`, background: toneOf(lead.pct) }}
          />
        </div>
      </div>

      {/* Ranked ladder */}
      {rest.length > 0 && (
        <div className="relative mt-3">
          <span
            className="pointer-events-none absolute inset-y-0 hidden border-l border-dashed border-border sm:block"
            style={{ left: `calc(46% + ${guide}% * 0.42)` }}
            aria-hidden
          />
          <ul>
            {rest.map((r, i) => (
              <li
                key={`${r.name}-${i}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 border-b border-border/50 py-2 last:border-0 sm:grid-cols-[1.5rem_minmax(0,44%)_1fr_auto]"
              >
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <span className="truncate text-[13px] font-medium text-foreground">{r.name}</span>
                <span className="col-span-2 mt-1 flex items-center gap-3 sm:col-span-1 sm:mt-0">
                  <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted/70">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(r.pct / scale) * 100}%`,
                        background: toneOf(r.pct),
                        opacity: 0.85,
                      }}
                    />
                  </span>
                  <span className="w-11 shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {r.pct}%
                  </span>
                </span>
                <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:block">
                  {r.value ? formatValue(r.value) : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <span>
          Top five holdings hold <span className="font-semibold text-foreground">{top5}%</span> of
          the portfolio.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-l border-dashed border-muted-foreground" />
          {threshold}% concentration line
        </span>
      </p>
    </div>
  );
}

/* ───────────────── COMPARISON - paired allocation tracks ───────────────── */

/**
 * Allocation comparison as paired horizontal tracks on a single rail: the
 * filled bar is the user's current weight, the champagne marker is the
 * NitiCore™ recommended weight. One rail per asset class keeps the section
 * compact and avoids repeating the two-bar comparison pattern.
 */
export function ComparisonTracks({
  rows,
  peerNote,
}: {
  rows: { label: string; you: number; recommended: number }[];
  peerNote?: React.ReactNode;
}) {
  const max = Math.max(20, ...rows.flatMap((r) => [r.you, r.recommended])) * 1.08;
  return (
    <div>
      <ChartLegend
        items={[
          { label: "You", color: SERIES_COLORS.you, hint: "current mix" },
          {
            label: "NitiCore™",
            color: SERIES_COLORS.nitiCore,
            hint: "recommended for your profile",
          },
        ]}
      />
      <ul className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-3">
        {rows.map((r) => {
          const gap = Math.round((r.you - r.recommended) * 10) / 10;
          const aligned = Math.abs(gap) <= 5;
          return (
            <li key={r.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground">
                  {r.label}
                </span>
                <span
                  className={`shrink-0 font-mono text-[11.5px] font-semibold tabular-nums ${
                    aligned ? "text-muted-foreground" : "text-foreground"
                  }`}
                  title="Gap against the NitiCore™ recommendation"
                >
                  {aligned ? "in line" : `${gap > 0 ? "+" : "−"}${Math.abs(gap)}pp`}
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {[
                  { key: "You", v: r.you, color: SERIES_COLORS.you },
                  { key: "NitiCore™", v: r.recommended, color: SERIES_COLORS.nitiCore },
                ].map((t) => (
                  <div
                    key={t.key}
                    className="grid grid-cols-[4.25rem_minmax(0,1fr)_2.75rem] items-center gap-x-2"
                  >
                    <span className="truncate text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                      {t.key}
                    </span>
                    <span className="block h-[7px] overflow-hidden rounded-full bg-muted/70">
                      <span
                        className="block h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${(t.v / max) * 100}%`, background: t.color }}
                      />
                    </span>
                    <span className="text-right font-mono text-[11.5px] tabular-nums text-foreground">
                      {t.v}%
                    </span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {peerNote && (
        <div className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {peerNote}
        </div>
      )}
    </div>
  );
}


/* ───────────────── EXPOSURE - overlap composition ───────────────── */

export interface ExposureGroup {
  label: string;
  pct: number;
  value: number;
  members: { name: string; pct: number }[];
}

/**
 * What actually drives the portfolio: holdings collapsed into the exposure
 * they share. A single composition rail plus the contributing positions -
 * deliberately not another bar chart.
 */
export function ExposureOverlap({
  groups,
  formatValue,
  empty,
}: {
  groups: ExposureGroup[];
  formatValue: (n: number) => string;
  empty?: string;
}) {
  const data = groups.filter((g) => g.pct > 0);
  const [active, setActive] = useState<string | null>(null);
  if (data.length === 0) return <NoData>{empty}</NoData>;
  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-xl">
        {data.map((g, i) => (
          <span
            key={g.label}
            onMouseEnter={() => setActive(g.label)}
            onMouseLeave={() => setActive(null)}
            title={`${g.label} - ${g.pct}%`}
            style={{
              width: `${g.pct}%`,
              background: CHART_PALETTE[i % CHART_PALETTE.length],
              opacity: active === null || active === g.label ? 1 : 0.32,
            }}
            className="flex h-full items-center justify-center transition-opacity"
          >
            {g.pct >= 10 && (
              <span className="px-1 font-mono text-[11px] tabular-nums text-white/95">
                {g.pct}%
              </span>
            )}
          </span>
        ))}
      </div>
      <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {data.map((g, i) => (
          <li
            key={g.label}
            onMouseEnter={() => setActive(g.label)}
            onMouseLeave={() => setActive(null)}
            className={`rounded-xl px-2.5 py-2 transition-colors ${active === g.label ? "bg-muted/50" : ""}`}
          >
            <div className="flex items-baseline gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px]"
                style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
                {g.label}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-foreground">{g.pct}%</span>
              {g.value > 0 && (
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatValue(g.value)}
                </span>
              )}
            </div>
            <p className="mt-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">
              {g.members
                .slice(0, 4)
                .map((m) => `${m.name} ${m.pct}%`)
                .join(" · ")}
              {g.members.length > 4 ? ` · +${g.members.length - 4} more` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────── EFFECTIVENESS - dial ───────────────── */

/**
 * A single large deterministic score. Deliberately typographic: one arc, one
 * number, no gauge needle theatre.
 */
export function EffectivenessDial({
  score,
  delta,
  caption,
  size = 150,
}: {
  score: number;
  delta?: number;
  caption?: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, score));
  const r = (size - 14) / 2;
  const c = Math.PI * r; // half circle
  const color =
    v >= 80 ? SERIES_COLORS.positive : v >= 60 ? SERIES_COLORS.you : SERIES_COLORS.attention;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 18 }}>
        <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
          <path
            d={`M 7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={9}
            strokeLinecap="round"
          />
          <path
            d={`M 7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            style={{ transition: "stroke-dasharray 400ms ease" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="font-display text-[2.75rem] leading-none tracking-tight text-foreground tabular-nums">
            {v}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            out of 100
          </span>
        </div>
      </div>
      {typeof delta === "number" && delta !== 0 && (
        <p
          className="mt-3 font-mono text-[12px] tabular-nums"
          style={{ color: delta > 0 ? SERIES_COLORS.positive : SERIES_COLORS.attention }}
        >
          {delta > 0 ? "+" : "−"}
          {Math.abs(delta)} vs your current plan
        </p>
      )}
      {caption && <p className="mt-2 text-center text-[11px] text-muted-foreground">{caption}</p>}
    </div>
  );
}

/* ───────────────── NITISIM™ - scenario matrix ───────────────── */

/**
 * Each cell shows the projected outcome for a contribution/return combination,
 * so cells always differ where the model differs. The effectiveness score sits
 * underneath as a secondary read.
 */
export function ScenarioMatrix({
  cells,
  columns,
  rows,
  activeStepUp,
  activeScenario,
  formatValue,
  onSelect,
}: {
  cells: { stepUp: number; scenario: string; score: number; projected: number }[];
  columns: { key: string; label: string }[];
  rows: number[];
  activeStepUp: number;
  activeScenario: string;
  formatValue: (n: number) => string;
  onSelect?: (stepUp: number, scenario: string) => void;
}) {
  const values = cells.map((c) => c.projected);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const shade = (v: number) => {
    const t = hi === lo ? 0.35 : (v - lo) / (hi - lo);
    // Restrained single-hue ramp - no traffic lights.
    return `color-mix(in oklab, ${SERIES_COLORS.you} ${Math.round(8 + t * 40)}%, var(--card))`;
  };
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `minmax(3.4rem,4.5rem) repeat(${columns.length}, minmax(0,1fr))` }}
    >
      <span />
      {columns.map((c) => (
        <span
          key={c.key}
          className="pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          {c.label}
        </span>
      ))}
      {rows.map((r) => (
        <Fragment key={`row-${r}`}>
          <span className="flex items-center justify-end pr-2 text-right text-[10.5px] font-medium leading-tight text-muted-foreground">
            {r}% step-up
          </span>
          {columns.map((c) => {
            const cell = cells.find((x) => x.stepUp === r && x.scenario === c.key);
            const active = r === activeStepUp && c.key === activeScenario;
            return (
              <button
                key={`${r}-${c.key}`}
                type="button"
                onClick={() => onSelect?.(r, c.key)}
                className={`m-[3px] rounded-lg px-1 py-2 text-center transition-all ${
                  active ? "ring-2 ring-foreground/70" : "hover:ring-1 hover:ring-border"
                }`}
                style={{ background: shade(cell?.projected ?? 0) }}
              >
                <span className="block font-mono text-[11.5px] font-semibold tabular-nums text-foreground sm:text-[12.5px]">
                  {cell ? formatValue(cell.projected) : "-"}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-muted-foreground">
                  {cell ? `${cell.score}/100` : ""}
                </span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}


/* ───────────────── STRESS - scenario rails ───────────────── */

export function StressScenarios({
  rows,
  formatValue,
}: {
  rows: { label: string; detail: string; impact: number; after: number; pctOfPortfolio: number }[];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.pctOfPortfolio));
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label} className="border-b border-border/50 pb-3.5 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[13px] font-semibold text-foreground">{r.label}</span>
            <span className="font-mono text-[12px] tabular-nums text-foreground">
              −{formatValue(r.impact)}
              <span className="ml-2 text-muted-foreground">→ {formatValue(r.after)}</span>
            </span>
          </div>
          <span className="mt-2 block h-[6px] w-full overflow-hidden rounded-full bg-muted/70">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(r.pctOfPortfolio / max) * 100}%`,
                background: SERIES_COLORS.attention,
                opacity: 0.85,
              }}
            />
          </span>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {r.detail} That is {r.pctOfPortfolio}% of today&rsquo;s portfolio value.
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────── PEER - paired comparison rails ───────────────── */

/**
 * Compact peer comparison table: metric, your value against the cohort value on
 * one shared rail, and a one-word status. The full deterministic verdict stays
 * available as the row title so no engine text is lost.
 */
export function PeerRails({
  rows,
}: {
  rows: { label: string; you: number; typical: number; unit: string; verdict: string }[];
}) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,5rem)] items-center gap-x-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span>Metric</span>
        <span className="text-right">You · cohort</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const max = Math.max(r.you, r.typical, 1) * 1.15;
          const diff = r.you - r.typical;
          const tolerance = Math.max(2, r.typical * 0.1);
          const status =
            Math.abs(diff) <= tolerance ? "In line" : diff > 0 ? "Above typical" : "Below typical";
          const statusClass =
            status === "In line"
              ? "text-muted-foreground"
              : diff > 0
                ? "text-foreground"
                : "text-foreground/70";
          return (
            <li
              key={r.label}
              title={r.verdict}
              className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,5rem)] items-center gap-x-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-foreground">{r.label}</p>
                <div className="mt-1.5 space-y-[3px]">
                  <span className="block h-[5px] w-full overflow-hidden rounded-full bg-muted/70">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(r.you / max) * 100}%`, background: SERIES_COLORS.you }}
                    />
                  </span>
                  <span className="block h-[5px] w-full overflow-hidden rounded-full bg-muted/40">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(r.typical / max) * 100}%`,
                        background: SERIES_COLORS.peer,
                        opacity: 0.7,
                      }}
                    />
                  </span>
                </div>
              </div>
              <span className="text-right font-mono text-[11.5px] tabular-nums">
                <span className="font-semibold text-foreground">
                  {r.you}
                  {r.unit}
                </span>
                <span className="px-1 text-muted-foreground">·</span>
                <span style={{ color: SERIES_COLORS.peer }}>
                  {r.typical}
                  {r.unit}
                </span>
              </span>
              <span
                className={`text-right text-[10px] font-semibold uppercase tracking-[0.1em] ${statusClass}`}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


/* ───────────────── STRESS - drawdown ladder ───────────────── */

/**
 * Premium stress visualisation: one rail per scenario where the shaded band is
 * the value that survives the fall and the notched segment is the loss. Numbers
 * lead, explanation follows. Same data as StressScenarios - presentation only.
 */
export function StressWaterfall({
  rows,
  total,
  formatValue,
}: {
  rows: { label: string; detail: string; impact: number; after: number; pctOfPortfolio: number }[];
  total: number;
  formatValue: (n: number) => string;
}) {
  const base = Math.max(1, total);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Today
        </span>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
          {formatValue(total)}
        </span>
      </div>
      <ul className="mt-3 space-y-3.5">
        {rows.map((r) => {
          const keepPct = Math.max(0, Math.min(100, (r.after / base) * 100));
          return (
            <li key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-[12.5px] font-semibold text-foreground">{r.label}</span>
                <span className="font-mono text-[11.5px] tabular-nums">
                  <span style={{ color: SERIES_COLORS.action }}>−{formatValue(r.impact)}</span>
                  <span className="px-1.5 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{r.pctOfPortfolio}%</span>
                </span>
              </div>
              <div className="mt-1.5 flex h-7 w-full items-stretch overflow-hidden rounded-lg bg-muted/50">
                <span
                  className="flex items-center justify-end pr-2 transition-[width] duration-500"
                  style={{ width: `${keepPct}%`, background: SERIES_COLORS.you }}
                >
                  <span className="truncate font-mono text-[11px] font-semibold tabular-nums text-background">
                    {formatValue(r.after)}
                  </span>
                </span>
                <span
                  className="flex-1"
                  style={{
                    background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${SERIES_COLORS.action} 28%, var(--card)) 0 5px, var(--card) 5px 10px)`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{r.detail}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-[2px]"
            style={{ background: SERIES_COLORS.you }}
          />
          Value remaining
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-[2px]"
            style={{
              background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${SERIES_COLORS.action} 40%, var(--card)) 0 4px, var(--card) 4px 8px)`,
            }}
          />
          Loss
        </span>
      </p>
    </div>
  );
}

/* ───────────────── HEALTH - compact semicircular gauge ───────────────── */

export function HealthGauge({
  score,
  color,
  size = 108,
  children,
}: {
  score: number;
  color: string;
  size?: number;
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(100, score));
  const r = (size - 12) / 2;
  const c = Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display text-[1.6rem] leading-none tracking-tight tabular-nums text-foreground">
          {v}
        </span>
        {children}
      </div>
    </div>
  );
}

/* ───────────────── CONCENTRATION - semi-donut gauge ───────────────── */

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const p = (t: number) => {
    const a = Math.PI * (1 - t);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
}

/**
 * Concentration presented as a semi-donut: the sweep is the largest position's
 * share of the portfolio against a scale that always contains the 15% guide, so
 * how concentrated the portfolio is reads instantly. The ranked list underneath
 * keeps the supporting positions on the same page.
 */
export function ConcentrationGauge({
  rows,
  formatValue,
  threshold = 15,
}: {
  rows: { name: string; pct: number; value?: number }[];
  formatValue: (n: number) => string;
  threshold?: number;
}) {
  const top = rows.slice(0, 8);
  if (top.length === 0) return <NoData />;
  const lead = top[0];
  const scale = Math.max(threshold * 2, Math.ceil((lead.pct * 1.25) / 5) * 5);
  const tone =
    lead.pct >= 25 ? SERIES_COLORS.action : lead.pct >= threshold ? SERIES_COLORS.attention : SERIES_COLORS.positive;
  const W = 240;
  const H = 128;
  const cx = W / 2;
  const cy = H - 8;
  const r = 96;
  const t = Math.min(1, lead.pct / scale);
  const guide = Math.min(1, threshold / scale);
  const gx = cx + (r + 12) * Math.cos(Math.PI * (1 - guide));
  const gy = cy - (r + 12) * Math.sin(Math.PI * (1 - guide));
  const top5 = Math.round(top.slice(0, 5).reduce((a, x) => a + x.pct, 0) * 10) / 10;

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="relative w-full shrink-0 sm:w-[240px]" style={{ maxWidth: W }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" style={{ display: "block", aspectRatio: `${W} / ${H}` }} role="img" aria-label={`Largest holding ${lead.pct}% of portfolio`}>

            <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="var(--muted)" strokeWidth={13} strokeLinecap="round" />
            <path
              d={arcPath(cx, cy, r, 0, Math.max(0.012, t))}
              fill="none"
              stroke={tone}
              strokeWidth={13}
              strokeLinecap="round"
              style={{ transition: "d 400ms ease" }}
            />
            <line
              x1={cx + (r - 11) * Math.cos(Math.PI * (1 - guide))}
              y1={cy - (r - 11) * Math.sin(Math.PI * (1 - guide))}
              x2={cx + (r + 8) * Math.cos(Math.PI * (1 - guide))}
              y2={cy - (r + 8) * Math.sin(Math.PI * (1 - guide))}
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
            <text
              x={gx}
              y={gy}
              textAnchor={guide < 0.5 ? "end" : "start"}
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em" }}
            >
              {threshold}%
            </text>
          </svg>
          <div className="absolute inset-x-0 bottom-1 flex flex-col items-center px-6 text-center">
            <span className="font-display text-[2.1rem] leading-none tracking-tight tabular-nums" style={{ color: tone }}>
              {lead.pct}%
            </span>
            <span className="mt-1 line-clamp-1 max-w-full text-[11px] font-semibold text-foreground">
              {lead.name}
            </span>
            {lead.value ? (
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {formatValue(lead.value)}
              </span>
            ) : null}
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-[5px]">
          {top.slice(0, 6).map((h, i) => (
            <li key={`${h.name}-${i}`} className="grid grid-cols-[1.1rem_minmax(0,1fr)_2.6rem_3.6rem] items-center gap-x-2">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {i + 1}
              </span>
              <span className="truncate text-[11.5px] font-medium text-foreground">{h.name}</span>
              <span className="text-right font-mono text-[11px] font-semibold tabular-nums" style={{ color: h.pct >= threshold ? tone : "var(--foreground)" }}>
                {h.pct}%
              </span>
              <span className="text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {h.value ? formatValue(h.value) : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 border-t border-border/70 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Top five holdings hold <span className="font-semibold text-foreground">{top5}%</span> of the
        portfolio. The dashed mark is the {threshold}% single-position guide.
      </p>
    </div>
  );
}

/* ───────────────── PEER - benchmark bars ───────────────── */

export function PeerBars({
  rows,
}: {
  rows: { label: string; you: number; typical: number; unit: string; verdict: string }[];
}) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const max = Math.max(r.you, r.typical, 1) * 1.18;
        const diff = r.you - r.typical;
        const tolerance = Math.max(r.unit === "%" ? 3 : 5, r.typical * 0.12);
        const status =
          Math.abs(diff) <= tolerance
            ? "In line"
            : diff > 0
              ? "Higher than typical"
              : "Below typical";
        return (
          <li key={r.label} title={r.verdict}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] font-semibold text-foreground">{r.label}</span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {status}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-[2.4rem_minmax(0,1fr)_3.2rem] items-center gap-x-2">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                You
              </span>
              <span className="block h-[7px] overflow-hidden rounded-full bg-muted/70">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${(r.you / max) * 100}%`, background: SERIES_COLORS.you }}
                />
              </span>
              <span className="text-right font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {r.you}
                {r.unit}
              </span>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Cohort
              </span>
              <span className="block h-[7px] overflow-hidden rounded-full bg-muted/40">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(r.typical / max) * 100}%`, background: SERIES_COLORS.peer, opacity: 0.75 }}
                />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: SERIES_COLORS.peer }}>
                {r.typical}
                {r.unit}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────── HEALTH - compact threshold bar ───────────────── */

export function ThresholdBar({
  score,
  color,
  markerPct = 60,
  markerLabel,
}: {
  score: number;
  color: string;
  markerPct?: number;
  markerLabel?: string;
}) {
  const v = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="relative h-[9px] w-full overflow-hidden rounded-full bg-muted/70">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, v)}%`, background: color }}
        />
      </div>
      <div className="relative mt-1 h-3">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          style={{ left: `${Math.min(92, Math.max(8, markerPct))}%` }}
        >
          ▲ {markerLabel ?? "target"}
        </span>
      </div>
    </div>
  );
}

/* ───────────────── STRESS - personalised exposure shock ───────────────── */

export function PersonalStress({
  stress,
  formatValue,
}: {
  stress: import("@/lib/portfolio-analyzer/effectiveness").PersonalisedStress;
  formatValue: (n: number) => string;
}) {
  const maxLoss = Math.max(1, ...stress.legs.map((l) => l.loss));
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Portfolio impact", value: `−${stress.impactPct}%`, strong: true },
          { label: "Estimated loss", value: `−${formatValue(stress.loss)}` },
          { label: "Value remaining", value: formatValue(stress.after) },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border px-3 py-2 ${c.strong ? "border-foreground/25 bg-surface/70" : "border-border/70"}`}
          >
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {c.label}
            </p>
            <p
              className="mt-1 font-display text-lg leading-none tracking-tight"
              style={{ color: c.strong ? SERIES_COLORS.action : "var(--foreground)" }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <ul className="mt-3 space-y-2 border-t border-border/70 pt-3">
        {stress.legs.slice(0, 6).map((l) => (
          <li key={l.label} title={l.basis}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[11.5px] font-medium text-foreground">
                {l.label} <span className="text-muted-foreground">· {l.pct}%</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                −{l.shockPct}% · −{formatValue(l.loss)}
              </span>
            </div>
            <span className="mt-1 block h-[6px] w-full overflow-hidden rounded-full bg-muted/60">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(l.loss / maxLoss) * 100}%`, background: SERIES_COLORS.action, opacity: 0.8 }}
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px] leading-relaxed text-foreground/85">{stress.explanation}</p>
      {stress.unclassifiedPct > 0 && (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          {stress.unclassifiedPct}% of the portfolio could not be classified reliably, so no shock
          was assumed for it.
        </p>
      )}
      <p className="mt-2 border-t border-border/60 pt-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Illustrative scenario based on NitiCore™ exposure assumptions - not a forecast.
      </p>
    </div>
  );
}

/* ───────────────── STRESS - simple personalised market ladder ───────────────── */

export function MarketStressLadderView({
  ladder,
  formatValue,
}: {
  ladder: import("@/lib/portfolio-analyzer/effectiveness").MarketStressLadder;
  formatValue: (n: number) => string;
}) {
  const maxLoss = Math.max(1, ...ladder.rows.map((r) => r.loss));
  return (
    <div>
      <ul className="space-y-2.5">
        {ladder.rows.map((r) => (
          <li key={r.label} className="rounded-xl border border-border/70 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-semibold text-foreground">{r.label}</span>
              <span
                className="font-mono text-[12px] font-semibold tabular-nums"
                style={{ color: SERIES_COLORS.action }}
              >
                −{r.impactPct}% · −{formatValue(r.loss)}
              </span>
            </div>
            <span className="mt-1.5 block h-[6px] w-full overflow-hidden rounded-full bg-muted/60">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(r.loss / maxLoss) * 100}%`, background: SERIES_COLORS.action, opacity: 0.8 }}
              />
            </span>
            <p className="mt-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              Value remaining · {formatValue(r.after)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-foreground/85">{ladder.explanation}</p>
      {ladder.unclassifiedPct > 0 && (
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
          {ladder.unclassifiedPct}% of the portfolio could not be classified reliably, so no shock
          was assumed for it.
        </p>
      )}
      <p className="mt-2 border-t border-border/60 pt-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        Illustrative scenario, not a forecast.
      </p>
    </div>
  );
}
