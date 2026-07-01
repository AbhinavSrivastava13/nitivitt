import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import {
  getProfile,
  getFinancialProfile,
  listAssets,
  listLiabilities,
  listGoals,
  listInsurance,
} from "@/lib/services/profile.service";
import { calculateNitiScore, calculateNitiAge, generateRecommendations } from "@/lib/niti-core";
import type { NitiCoreInput } from "@/lib/niti-core";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — NitiVitt" },
      { name: "description", content: "Your financial health, broken into six measurable pillars." },
    ],
  }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user!;
      const [profile, fp, assets, liabs, goals, insurance] = await Promise.all([
        getProfile(user.id),
        getFinancialProfile(user.id),
        listAssets(user.id),
        listLiabilities(user.id),
        listGoals(user.id),
        listInsurance(user.id),
      ]);
      return { user, profile, fp, assets, liabs, goals, insurance };
    },
  });
}

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function Dashboard() {
  const { data, isLoading } = useDashboardData();

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteHeader />
        <main className="container-page py-16">
          <p className="text-sm text-muted-foreground">Loading your NitiScore…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { profile, fp, assets, liabs, goals, insurance } = data;
  const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
  const hasTerm = insurance.some((i) => i.insurance_type === "term");
  const hasHealth = insurance.some((i) => i.insurance_type === "health");
  const termCover = insurance
    .filter((i) => i.insurance_type === "term")
    .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

  const input: NitiCoreInput = {
    ageYears: ageFromDob(profile?.date_of_birth ?? null),
    monthlyIncome: Number(fp?.monthly_income ?? 0),
    monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
    monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
    liquidAssets,
    totalAssets,
    totalLiabilities,
    monthlyEmi,
    monthlyInvestments: 0,
    totalInvestments: 0,
    hasTermInsurance: hasTerm,
    hasHealthInsurance: hasHealth,
    termCover,
    retirementCorpus: 0,
    retirementAge: Number(fp?.retirement_age ?? 60),
    riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
  };

  const hasData = Number(fp?.monthly_income ?? 0) > 0;
  const score = calculateNitiScore(input);
  const nitiAge = calculateNitiAge(input);
  const recs = generateRecommendations(input);

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </p>
            <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">Your NitiScore™</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Computed from your profile — open your <Link to="/profile" className="underline">profile</Link> to
              update assets, income, and goals.
            </p>
          </div>
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            See the math →
          </Link>
        </div>

        {!hasData && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm">
            <p className="font-semibold text-foreground">Add your finances to unlock your real NitiScore.</p>
            <p className="mt-1 text-muted-foreground">Head to your profile and add income, assets, and liabilities.</p>
            <Link
              to="/profile"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
            >
              Complete your profile →
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overall score</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-7xl text-foreground">{score.value}</span>
                  <span className="text-sm text-muted-foreground">/1000</span>
                  <span className="ml-2 rounded-full bg-secondary-soft px-2.5 py-1 text-xs font-semibold text-secondary">
                    Grade {score.grade}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-primary p-4 text-primary-foreground">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">NitiAge™</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl">{nitiAge.value}</span>
                  <span className="text-xs text-primary-foreground/70">yrs</span>
                </div>
                <p className="mt-1 text-[11px] text-primary-foreground/70">vs. real {input.ageYears}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {score.breakdown.map((p) => (
                <div key={p.pillar} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{p.pillar}</span>
                    <span className="text-muted-foreground">{Math.round(p.pillarScore)}</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.pillarScore}%`,
                        backgroundColor:
                          p.pillarScore >= 75
                            ? "var(--color-secondary)"
                            : p.pillarScore >= 50
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Top recommendations</p>
            {recs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Great job — no critical actions right now.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recs.slice(0, 3).map((r) => (
                  <li key={r.id} className="border-b border-border/60 pb-3 last:border-0">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.nextAction}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/recommendations"
              className="mt-4 inline-block text-xs font-semibold text-primary hover:underline"
            >
              View all →
            </Link>
          </aside>
        </div>

        <QuickStats
          income={Number(fp?.monthly_income ?? 0)}
          expenses={Number(fp?.monthly_expenses ?? 0)}
          netWorth={totalAssets - totalLiabilities}
          goals={goals.length}
        />

        <ModuleGrid />
      </main>
      <SiteFooter />
    </div>
  );
}

function QuickStats({
  income,
  expenses,
  netWorth,
  goals,
}: {
  income: number;
  expenses: number;
  netWorth: number;
  goals: number;
}) {
  const items = [
    { label: "Monthly income", value: formatINR(income) },
    { label: "Monthly expenses", value: formatINR(expenses) },
    { label: "Net worth", value: formatINR(netWorth) },
    { label: "Active goals", value: goals.toString() },
  ];
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i.label}</p>
          <p className="mt-1 font-display text-2xl text-foreground">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

const MODULES = [
  { to: "/goals", icon: Target, name: "Goals" },
  { to: "/retirement", icon: PiggyBank, name: "Retirement" },
  { to: "/insurance", icon: Shield, name: "Insurance" },
  { to: "/emergency-fund", icon: Wallet, name: "Emergency Fund" },
  { to: "/net-worth", icon: TrendingUp, name: "Net Worth" },
  { to: "/recommendations", icon: Sparkles, name: "Recommendations" },
  { to: "/simulator", icon: FlaskConical, name: "NitiSim™" },
  { to: "/ai-coach", icon: Sparkles, name: "NitiGuide™" },
  { to: "/peer-benchmark", icon: Users, name: "Peer Benchmark" },
  { to: "/financial-health", icon: TrendingUp, name: "Financial Health" },
  { to: "/profile", icon: UserCircle, name: "Profile" },
  { to: "/settings", icon: Settings, name: "Settings" },
] as const;

function ModuleGrid() {
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl text-foreground md:text-3xl">Your modules</h2>
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
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
