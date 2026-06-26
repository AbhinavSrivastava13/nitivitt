import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/principles")({
  head: () => ({
    meta: [
      { title: "Our principles — NitiVitt" },
      {
        name: "description",
        content:
          "The non-negotiables behind NitiVitt: no commissions, no stock tips, no fake urgency. Trust before revenue, every time.",
      },
    ],
  }),
  component: Principles,
});

const RULES = [
  { t: "Education before recommendation", d: "We explain the why before we ever suggest the what." },
  { t: "Logic before opinion", d: "If a formula can't decide it, an opinion shouldn't." },
  { t: "Transparency before conversion", d: "Every assumption, calculation, and source is visible." },
  { t: "Trust before revenue", d: "We will never trade your trust for a commission." },
  { t: "Long-term wealth over short-term returns", d: "Plans are measured in decades, not quarters." },
];

const PROMISES = [
  "No hidden commissions",
  "No misleading claims",
  "No guaranteed-return promises",
  "No fake urgency",
  "No biased recommendations",
  "Every assumption disclosed",
];

function Principles() {
  return (
    <PageShell
      eyebrow="Principles"
      title="The non-negotiables."
      lede="These aren't taglines. They are the constraints we engineer against — the reason NitiVitt looks and behaves the way it does."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {RULES.map((r, i) => (
          <div key={r.t} className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <span className="font-display text-2xl text-primary">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{r.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-secondary/30 bg-secondary-soft p-8">
        <h3 className="font-display text-2xl text-foreground">Our promises to you</h3>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-center gap-3 text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-16 font-display text-3xl italic text-muted-foreground">
        "AI assists. Mathematics decides."
      </p>
    </PageShell>
  );
}
