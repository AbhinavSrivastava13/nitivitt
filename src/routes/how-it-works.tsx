import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How NitiVitt works — the math behind the score" },
      {
        name: "description",
        content:
          "A transparent walkthrough of the NitiScore framework, the six pillars, the formulas, and the recommendation engine.",
      },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    n: "01",
    title: "Build your financial profile",
    body: "Income, expenses, assets, liabilities, investments, insurance, goals. We never ask for what we don't use.",
  },
  {
    n: "02",
    title: "We compute your NitiScore",
    body: "Six pillars — Savings, Emergency, Insurance, Investments, Debt, Retirement — each weighted, each explainable.",
  },
  {
    n: "03",
    title: "We generate your NitiPath",
    body: "A prioritized roadmap ordered by impact. Every step shows the calculation behind it.",
  },
  {
    n: "04",
    title: "You decide. We coach.",
    body: "NitiGuide explains terms, simulators show 'what if', the Knowledge Hub teaches the why. You stay in control.",
  },
];

const PILLARS = [
  { name: "Savings", weight: 20, target: "Save 30% of monthly income." },
  { name: "Emergency Fund", weight: 15, target: "Hold 6 months of essential expenses." },
  { name: "Insurance", weight: 15, target: "Term + health insurance in place." },
  { name: "Investments", weight: 20, target: "Invest 20% of income monthly." },
  { name: "Debt", weight: 15, target: "EMIs under 20% of income." },
  { name: "Retirement", weight: 15, target: "On track for 25× annual expenses by 60." },
];

function HowItWorks() {
  return (
    <PageShell
      eyebrow="How it works"
      title="The math behind every screen."
      lede="No black boxes, no opinion-as-advice. Here is exactly how NitiVitt computes your score, plans your goals, and surfaces recommendations."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <span className="font-display text-3xl text-primary">{s.n}</span>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-20 font-display text-3xl text-foreground md:text-4xl">
        The six pillars of your NitiScore.
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Each pillar scores 0–100 from a deterministic formula. Final score is a weighted sum.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Pillar</th>
              <th className="px-5 py-3 font-semibold">Weight</th>
              <th className="px-5 py-3 font-semibold">Healthy benchmark</th>
            </tr>
          </thead>
          <tbody>
            {PILLARS.map((p, i) => (
              <tr key={p.name} className={i < PILLARS.length - 1 ? "border-b border-border" : ""}>
                <td className="px-5 py-3.5 font-semibold text-foreground">{p.name}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{p.weight}%</td>
                <td className="px-5 py-3.5 text-foreground">{p.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        Read the source: every formula lives in{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/lib/finance/</code> as a pure,
        unit-testable function. Audit it, fork it, hold us accountable.
      </p>
    </PageShell>
  );
}
