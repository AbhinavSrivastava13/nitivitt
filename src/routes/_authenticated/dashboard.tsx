import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Target, Shield, PiggyBank, Wallet, TrendingUp, FlaskConical, GraduationCap,
  Briefcase, Sparkles, ArrowRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfile, getFinancialProfile, listAssets, listLiabilities, listGoals, listInsurance,
} from "@/lib/services/profile.service";
import {
  calculateNitiScore, calculateNitiAge, calculateEmergencyFund, calculateNetWorth,
  generateRecommendations,
} from "@/lib/niti-core";
import type { NitiCoreInput } from "@/lib/niti-core";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NitiVitt" },
      { name: "description", content: "Where you stand financially — NitiScore™, NitiAge™, Net Worth and your next best move." },
    ],
  }),
  component: Dashboard,
});

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user!;
      const [profile, fp, assets, liabs, goals, insurance] = await Promise.all([
        getProfile(user.id), getFinancialProfile(user.id),
        listAssets(user.id), listLiabilities(user.id),
        listGoals(user.id), listInsurance(user.id),
      ]);
      return { user, profile, fp, assets, liabs, goals, insurance };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useDashboardData();

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteHeader />
        <main className="container-page py-16">
          <p className="text-sm text-muted-foreground">Loading your financial snapshot…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { profile, fp, assets, liabs, insurance } = data;
  const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
  const hasTerm = insurance.some((i) => i.insurance_type === "term");
  const hasHealth = insurance.some((i) => i.insurance_type === "health");
  const termCover = insurance.filter((i) => i.insurance_type === "term")
    .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

  const input: NitiCoreInput = {
    ageYears: ageFromDob(profile?.date_of_birth ?? null),
    monthlyIncome: Number(fp?.monthly_income ?? 0),
    monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
    monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
    liquidAssets, totalAssets, totalLiabilities, monthlyEmi,
    monthlyInvestments: 0, totalInvestments: 0,
    hasTermInsurance: hasTerm, hasHealthInsurance: hasHealth, termCover,
    retirementCorpus: 0, retirementAge: Number(fp?.retirement_age ?? 60),
    riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
  };

  const hasData = Number(fp?.monthly_income ?? 0) > 0;
  const score = calculateNitiScore(input);
  const nitiAge = calculateNitiAge(input);
  const emergency = calculateEmergencyFund(input);
  const netWorth = calculateNetWorth(input);
  const recs = generateRecommendations(input);
  const first = profile?.full_name?.split(" ")[0] ?? "there";

  const fpUpdated = (fp as unknown as { updated_at?: string } | null)?.updated_at;
  const lastUpdated = fpUpdated ? new Date(fpUpdated) : null;
  const topRecs = recs.slice(0, 3);

  const ageDelta = Number(nitiAge.value) - input.ageYears;
  const ageBadge = ageDelta < 0
    ? { label: `Ahead by ${Math.abs(ageDelta)}y`, cls: "bg-secondary-soft text-secondary" }
    : ageDelta > 0
      ? { label: `Behind by ${ageDelta}y`, cls: "bg-warning-soft text-warning" }
      : { label: "On par", cls: "bg-muted text-muted-foreground" };

  const emStatus = emergency.status === "on_track"
    ? { label: "On track", cls: "bg-secondary-soft text-secondary" }
    : emergency.status === "needs_attention"
      ? { label: "Needs attention", cls: "bg-primary-soft text-primary" }
      : { label: "Critical", cls: "bg-warning-soft text-warning" };

  const nwAssetsPct = totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 0;

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-8 md:py-10">
        {/* ── Top header ────────────────────────────────────────────── */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Welcome back</p>
            <h1 className="mt-1 truncate font-display text-2xl text-foreground md:text-3xl">Hi, {first}.</h1>
            {lastUpdated && (
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Last updated {lastUpdated.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
          <Link
            to="/financial-health"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted md:text-sm"
          >
            Financial Health Report <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {!hasData && (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm">
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

        {/* ── HERO: 2x2 left grid + full-height NitiPath right ─────── */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          {/* LEFT: 2x2 metric grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
            {/* NitiScore — visually most prominent */}
            <Link
              to="/financial-health"
              className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary-soft/70 to-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">NitiScore™</p>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Grade {score.grade}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-6xl font-semibold leading-none text-foreground">{score.value}</span>
                <span className="text-xs text-muted-foreground">/ 1000</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.min(100, (score.value / 1000) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {score.value >= 750 ? "Excellent overall financial health." :
                  score.value >= 600 ? "Solid foundation — some pillars still need work." :
                  score.value >= 400 ? "Under strain — a few high-impact fixes will move you fast." :
                  "Fragile — focus on protection and buffer first."}
              </p>
            </Link>

            {/* NitiAge */}
            <Link
              to="/financial-health"
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiAge™</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ageBadge.cls}`}>
                  {ageDelta < 0 ? <ArrowDownRight className="h-3 w-3" /> : ageDelta > 0 ? <ArrowUpRight className="h-3 w-3" /> : null}
                  {ageBadge.label}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-6xl font-semibold leading-none text-foreground">{nitiAge.value}</span>
                <span className="text-xs text-muted-foreground">yrs</span>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Actual age <span className="font-semibold text-foreground">{input.ageYears}</span> · your money habits behave like this age.
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {ageDelta < 0 ? "You are financially older than your years — a good sign." :
                 ageDelta > 0 ? "You are financially younger than your years — habits need catch-up." :
                 "Right on track with your years."}
              </p>
            </Link>

            {/* Net Worth */}
            <Link
              to="/net-worth"
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Net Worth</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${netWorth.value >= 0 ? "bg-secondary-soft text-secondary" : "bg-warning-soft text-warning"}`}>
                  {netWorth.value >= 0 ? "Positive" : "Negative"}
                </span>
              </div>
              <div className="mt-3 font-display text-3xl leading-tight text-foreground">{formatINR(netWorth.value)}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Assets {formatINR(totalAssets)}</span>
                <span>Liab. {formatINR(totalLiabilities)}</span>
              </div>
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-secondary transition-[width] duration-700" style={{ width: `${nwAssetsPct}%` }} />
                <div className="h-full bg-warning/70" style={{ width: `${100 - nwAssetsPct}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {netWorth.value >= 0 ? "You own more than you owe — keep the compounding on." : "Liabilities exceed assets — prioritise debt paydown."}
              </p>
            </Link>

            {/* Emergency Fund */}
            <Link
              to="/emergency-fund"
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Emergency Fund</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${emStatus.cls}`}>{emStatus.label}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl leading-tight text-foreground">{Number(emergency.value).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">/ 6 months</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary transition-[width] duration-700"
                  style={{ width: `${Math.min(100, (Number(emergency.value) / 6) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {Number(emergency.value) >= 6 ? "Buffer is full — you can invest with confidence."
                  : Number(emergency.value) >= 3 ? "Partial cover — keep topping up monthly."
                  : "Below safety line — prioritise the buffer above returns."}
              </p>
            </Link>
          </div>

          {/* RIGHT: NitiPath — spans the entire hero height */}
          <aside className="rounded-2xl border border-primary/30 bg-gradient-to-b from-card to-primary-soft/20 p-5 shadow-soft lg:col-span-1 lg:h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Target className="h-4 w-4" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">NitiPath™</p>
              </div>
              <Link to="/recommendations" className="text-[11px] font-semibold text-primary hover:underline">All →</Link>
            </div>
            <p className="mt-3 font-display text-lg text-foreground">What should I do next?</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Your top 3 priorities, ranked by impact.</p>

            {topRecs.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                You're clear of critical actions right now. Keep saving and revisit monthly.
              </div>
            ) : (
              <ol className="mt-4 flex flex-col gap-2.5">
                {topRecs.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      to="/recommendations"
                      search={{ rec: r.id }}
                      className="group block rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                          r.priority === "high" ? "bg-warning-soft text-warning" :
                          r.priority === "medium" ? "bg-primary-soft text-primary" :
                          "bg-secondary-soft text-secondary"
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                              r.priority === "high" ? "bg-warning/15 text-warning" :
                              r.priority === "medium" ? "bg-primary/10 text-primary" :
                              "bg-muted text-muted-foreground"
                            }`}>P{i + 1} · {r.priority}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold leading-tight text-foreground">{r.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{r.explanation}</p>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>

        {/* ── NitiSim — single conversational entry ─────────────────── */}
        <section className="mt-8">
          <Link
            to="/simulator"
            className="group grid gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary-soft/40 via-card to-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiSim™</p>
              <p className="mt-1 font-display text-xl text-foreground">Explore any financial decision before you make it.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                "What if I increase my SIP by ₹3,000?" · "Can I retire at 50?" · "Can I buy a ₹1 Cr home in 5 years?"
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              Open NitiSim <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </section>

        {/* ── NitiGuide — Ask, don't summarise ──────────────────────── */}
        <section className="mt-4">
          <Link
            to="/ai-coach"
            className="group grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiGuide™</p>
              <p className="mt-1 font-display text-xl text-foreground">Ask why any number looks the way it does.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                "Why is my score low?" · "Why is my emergency fund weak?" · "Explain this recommendation."
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground group-hover:border-primary/40">
              Ask NitiGuide <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </section>

        {/* ── Modules ───────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Modules</p>
              <h2 className="mt-1 font-display text-xl text-foreground md:text-2xl">Manage every part of your money</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const MODULES = [
  { to: "/net-worth", icon: TrendingUp, name: "Net Worth", hint: "Assets − liabilities" },
  { to: "/emergency-fund", icon: Wallet, name: "Emergency Fund", hint: "Months of runway" },
  { to: "/insurance", icon: Shield, name: "Insurance", hint: "Cover adequacy" },
  { to: "/retirement", icon: PiggyBank, name: "Retirement", hint: "Corpus gap" },
  { to: "/goals", icon: Target, name: "Goals", hint: "Track & fund" },
  { to: "/peer-benchmark", icon: Briefcase, name: "Peer Benchmark", hint: "Where you stand" },
  { to: "/recommendations", icon: Sparkles, name: "NitiPath", hint: "Full action plan" },
  { to: "/simulator", icon: FlaskConical, name: "NitiSim", hint: "What-if scenarios" },
  { to: "/ai-coach", icon: GraduationCap, name: "NitiGuide", hint: "Ask the coach" },
] as const;
