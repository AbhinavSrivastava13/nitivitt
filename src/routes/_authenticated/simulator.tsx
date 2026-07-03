import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, ArrowRight, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { runSimulation } from "@/lib/niti-sim.functions";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "NitiSim™ — Scenario Simulator — NitiVitt" },
      { name: "description", content: "Ask any 'what if' about your money. NitiSim recomputes your plan using NitiCore™ and explains the impact." },
    ],
  }),
  component: Simulator,
});

const EXAMPLES = [
  "What if I increase my SIP by ₹3,000/month?",
  "Can I retire at 50?",
  "What if my salary increases by 10%?",
  "What if I prepay ₹10 lakh of my home loan?",
  "Can I buy a ₹1 crore house in 5 years?",
  "What if my rent doubles?",
];

type SimResult = Awaited<ReturnType<typeof runSimulation>>;

function Simulator() {
  const fn = useServerFn(runSimulation);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fn({ data: { question: q.trim() } });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <FlaskConical className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">NitiSim™</p>
        </div>
        <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">What happens if…</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ask any question about your money. NitiSim reads your real profile, changes only what you asked, recomputes with NitiCore™, and explains the impact.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); void submit(question); }}
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What if I increase my SIP by ₹5,000 and retire at 55?"
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {loading ? "Simulating…" : (<>Run scenario <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </form>

        {!result && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Try one of these</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => { setQuestion(e); void submit(e); }}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:bg-primary-soft/50"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
            {error}
          </div>
        )}

        {result && (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scenario</p>
                <span className="rounded-full bg-secondary-soft px-2.5 py-0.5 text-[10px] font-semibold text-secondary">Deterministic · NitiCore™</span>
              </div>
              <h2 className="mt-1 font-display text-2xl text-foreground">{result.scenarioTitle}</h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <SnapshotCard title="Your baseline" snap={result.baseline} tone="muted" />
                <SnapshotCard title="Simulated" snap={result.simulated} tone="primary" compare={result.baseline} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">NitiGuide™ explains</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{result.explanation}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 4).map((e) => (
                <button
                  key={e}
                  onClick={() => { setQuestion(e); void submit(e); }}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

type Snap = SimResult["baseline"];

function SnapshotCard({ title, snap, tone, compare }: { title: string; snap: Snap; tone: "muted" | "primary"; compare?: Snap }) {
  const rows: { label: string; value: string; base?: number; sim?: number; higherIsBetter: boolean }[] = [
    { label: "NitiScore™", value: `${snap.nitiScore}/1000 · ${snap.grade}`, base: compare?.nitiScore, sim: snap.nitiScore, higherIsBetter: true },
    { label: "NitiAge™", value: `${snap.nitiAge} yrs`, base: compare?.nitiAge, sim: snap.nitiAge, higherIsBetter: false },
    { label: "Net Worth", value: formatINR(snap.netWorth), base: compare?.netWorth, sim: snap.netWorth, higherIsBetter: true },
    { label: "Savings rate", value: `${snap.savingsRatePct.toFixed(1)}%`, base: compare?.savingsRatePct, sim: snap.savingsRatePct, higherIsBetter: true },
    { label: "Emergency fund", value: `${snap.emergencyMonths.toFixed(1)} mo`, base: compare?.emergencyMonths, sim: snap.emergencyMonths, higherIsBetter: true },
    { label: "Debt ratio", value: `${snap.debtRatioPct.toFixed(1)}%`, base: compare?.debtRatioPct, sim: snap.debtRatioPct, higherIsBetter: false },
    { label: "Retirement", value: snap.retirementStatus.replace("_", " "), higherIsBetter: true },
  ];
  return (
    <div className={`rounded-xl border p-5 ${tone === "primary" ? "border-primary/40 bg-primary-soft/30" : "border-border bg-surface"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              {r.value}
              {compare && r.base !== undefined && r.sim !== undefined && r.base !== r.sim && (
                <DeltaIcon delta={r.sim - r.base} higherIsBetter={r.higherIsBetter} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeltaIcon({ delta, higherIsBetter }: { delta: number; higherIsBetter: boolean }) {
  if (delta === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const good = higherIsBetter ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  return <Icon className={`h-3.5 w-3.5 ${good ? "text-secondary" : "text-warning"}`} />;
}
