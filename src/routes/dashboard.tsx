import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Target,
  Shield,
  PiggyBank,
  Wallet,
  TrendingUp,
  Sparkles,
  Users,
  FlaskConical,
  Settings,
  UserCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { calculateNitiScore } from "@/lib/finance/niti-score";
import { formatINR, emergencyFundTarget, requiredMonthlySIP } from "@/lib/finance/core";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your NitiScore — NitiVitt" },
      {
        name: "description",
        content:
          "Your financial health, broken into six measurable pillars. Every number is calculated, every recommendation explained.",
      },
    ],
  }),
  component: DashboardPreview,
});

/**
 * This is a transparent demo of the live dashboard: it computes a real NitiScore
 * from a sample financial profile so users can see the framework before signing
 * up. Once auth + persistence land, the same components will render against the
 * authenticated user's profile.
 */
function DashboardPreview() {
  const sample = {
    monthlyIncome: 120000,
    monthlyExpenses: 70000,
    monthlyEssentialExpenses: 45000,
    liquidSavings: 95000,
    totalInvestments: 480000,
    monthlyInvestments: 18000,
    monthlyEMI: 18000,
    totalLiabilities: 850000,
    hasTermInsurance: true,
    hasHealthInsurance: false,
    retirementCorpus: 350000,
    ageYears: 31,
  };
  const result = calculateNitiScore(sample);
  const efTarget = emergencyFundTarget(sample.monthlyEssentialExpenses);
  const efGap = Math.max(0, efTarget - sample.liquidSavings);
  const efMonthly = requiredMonthlySIP(efGap, 0.06, 1);

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Demo profile · Aarav, 31
            </p>
            <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Your NitiScore™
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              This is computed from real math — open{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/lib/finance/niti-score.ts</code>{" "}
              to read the formula.
            </p>
          </div>
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            See the math →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Overall score
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-7xl text-foreground">{result.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                  <BandPill band={result.band} />
                </div>
              </div>
              <div className="flex flex-col gap-1 text-right text-xs text-muted-foreground">
                <p>Strengths: {result.strengths.join(", ") || "—"}</p>
                <p>Needs work: {result.weaknesses.join(", ") || "—"}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {result.pillars.map((p) => (
                <div key={p.pillar} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{p.pillar}</span>
                    <span className="text-muted-foreground">{Math.round(p.score)}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.score}%`,
                        backgroundColor:
                          p.score >= 75
                            ? "var(--color-secondary)"
                            : p.score >= 50
                              ? "var(--color-primary)"
                              : "var(--color-warning)",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Top recommendation
            </p>
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              Build emergency fund to 6 months
            </h2>
            <dl className="mt-5 space-y-3.5 text-sm">
              <Row label="Reason" value={`You hold ${(sample.liquidSavings / sample.monthlyEssentialExpenses).toFixed(1)} months of essentials.`} />
              <Row label="Target" value={formatINR(efTarget)} />
              <Row label="Gap" value={formatINR(efGap)} />
              <Row label="Action" value={`Save ${formatINR(efMonthly)} / month for 12 months in a liquid fund.`} />
              <Row label="Confidence" value="High · deterministic" />
            </dl>
          </aside>
        </div>

        <ModuleGrid />

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
          This is a demo profile. Authentication, persistence, and your own data are coming next —
          the foundation is wired so it drops in without rework.
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const MODULES = [
  { to: "/goals", icon: Target, name: "Goals", desc: "Am I on track?" },
  { to: "/retirement", icon: PiggyBank, name: "Retirement", desc: "Will I have enough?" },
  { to: "/insurance", icon: Shield, name: "Insurance", desc: "Am I protected?" },
  { to: "/emergency-fund", icon: Wallet, name: "Emergency Fund", desc: "How long can I last?" },
  { to: "/net-worth", icon: TrendingUp, name: "Net Worth", desc: "What am I worth?" },
  { to: "/recommendations", icon: Sparkles, name: "Recommendations", desc: "What's next?" },
  { to: "/simulator", icon: FlaskConical, name: "NitiSim™", desc: "What if…" },
  { to: "/ai-coach", icon: Sparkles, name: "NitiGuide™", desc: "Help me understand." },
  { to: "/peer-benchmark", icon: Users, name: "Peer Benchmark", desc: "Where do I stand?" },
  { to: "/financial-health", icon: TrendingUp, name: "Financial Health", desc: "Six pillars, in detail." },
  { to: "/profile", icon: UserCircle, name: "Profile", desc: "Your single source of truth." },
  { to: "/settings", icon: Settings, name: "Settings", desc: "Privacy & assumptions." },
] as const;

function ModuleGrid() {
  return (
    <section className="mt-14">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Your modules</h2>
        <p className="text-xs text-muted-foreground">Every module shows its math.</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{m.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function BandPill({ band }: { band: string }) {
  const tone =
    band === "Excellent" || band === "Strong"
      ? "bg-secondary-soft text-secondary"
      : band === "Stable"
        ? "bg-primary-soft text-primary"
        : "bg-warning/15 text-warning";
  return (
    <span className={`ml-2 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{band}</span>
  );
}
