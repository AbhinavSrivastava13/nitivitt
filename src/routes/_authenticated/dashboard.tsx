import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Target, Shield, PiggyBank, Wallet, TrendingUp, Sparkles, FlaskConical,
  Home, Car, Baby, Heart, GraduationCap, Briefcase, Sun, Coins, ArrowRight,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Layers,
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
import { getNitiGuideExplanation } from "@/lib/niti-guide.functions";

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

  const { profile, fp, assets, liabs, goals, insurance } = data;
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

  const lastUpdated = (fp as { updated_at?: string } | null)?.updated_at ? new Date((fp as { updated_at: string }).updated_at) : null;
  const topRecs = recs.slice(0, 3);

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        {/* Welcome */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Welcome back</p>
            <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Hi, {first}.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Where you stand today and what to do next — computed deterministically by NitiCore™.
            </p>
            {lastUpdated && (
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Last updated {lastUpdated.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
          <Link
            to="/financial-health"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Financial Health Report <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!hasData && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm">
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

        {/* HERO: NitiScore + NitiAge + NitiPath (Top 3) */}
        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* NitiScore — hero */}
          <Link
            to="/financial-health"
            className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary-soft/70 to-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">NitiScore™</p>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Grade {score.grade}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-7xl font-semibold leading-none text-foreground">{score.value}</span>
              <span className="text-sm text-muted-foreground">/ 1000</span>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                style={{ width: `${Math.min(100, (score.value / 1000) * 100)}%` }}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Your overall financial health, out of 1000.</p>
          </Link>

          {/* NitiAge */}
          <Link
            to="/financial-health"
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiAge™</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  nitiAge.value < input.ageYears ? "bg-secondary-soft text-secondary" : "bg-warning-soft text-warning"
                }`}
              >
                {nitiAge.value < input.ageYears
                  ? <>Ahead by {input.ageYears - Number(nitiAge.value)}y</>
                  : nitiAge.value > input.ageYears
                    ? <>Behind by {Number(nitiAge.value) - input.ageYears}y</>
                    : <>On par</>}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-7xl font-semibold leading-none text-foreground">{nitiAge.value}</span>
              <span className="text-sm text-muted-foreground">yrs</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Real age: <span className="font-semibold text-foreground">{input.ageYears}</span></p>
            <p className="mt-3 text-xs text-muted-foreground">Financial maturity — how your habits compare to your years.</p>
          </Link>

          {/* NitiPath — Top 3 */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiPath™</p>
              <Link to="/recommendations" className="text-[11px] font-semibold text-primary hover:underline">View all →</Link>
            </div>
            <p className="mt-1 font-display text-lg text-foreground">Your next 3 moves</p>
            {topRecs.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">You're clear of critical actions right now.</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {topRecs.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      to="/recommendations"
                      className="group block rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                          r.priority === "high" ? "bg-warning-soft text-warning" :
                          r.priority === "medium" ? "bg-primary-soft text-primary" :
                          "bg-secondary-soft text-secondary"
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{r.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.nextAction}</p>
                        </div>
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* SECOND ROW: Net Worth + Emergency Fund */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <Link
            to="/net-worth"
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Net Worth</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${netWorth.value >= 0 ? "bg-secondary-soft text-secondary" : "bg-warning-soft text-warning"}`}>
                {netWorth.value >= 0 ? "Positive" : "Negative"}
              </span>
            </div>
            <div className="mt-3 font-display text-4xl text-foreground">{formatINR(netWorth.value)}</div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Assets {formatINR(totalAssets)}</span>
              <span>Liabilities {formatINR(totalLiabilities)}</span>
            </div>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-secondary" style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 0}%` }} />
              <div className="h-full bg-warning/70" style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalLiabilities / (totalAssets + totalLiabilities)) * 100 : 0}%` }} />
            </div>
          </Link>

          <Link
            to="/emergency-fund"
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Emergency Fund</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                emergency.status === "on_track" ? "bg-secondary-soft text-secondary" :
                emergency.status === "needs_attention" ? "bg-primary-soft text-primary" :
                "bg-warning-soft text-warning"
              }`}>
                {emergency.status === "on_track" ? "On track" : emergency.status === "needs_attention" ? "Needs attention" : "Critical"}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl text-foreground">{Number(emergency.value).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">of 6 months</span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-secondary transition-all"
                style={{ width: `${Math.min(100, (Number(emergency.value) / 6) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Liquid buffer vs. essential monthly expenses.</p>
          </Link>
        </section>


        {/* NITIGUIDE */}
        <section className="mt-10">
          <SectionHead
            eyebrow="NitiGuide™" title="Why these numbers matter, in plain English"
            subtitle="AI assists. Mathematics decides. NitiGuide translates NitiCore output into a story you can act on."
            actionLabel="Open NitiGuide"
            actionTo="/ai-coach"
          />
          <NitiGuidePreview />
        </section>

        {/* NITISIM */}
        <section className="mt-10">
          <SectionHead
            eyebrow="NitiSim™" title="What if…"
            subtitle="Stress-test any decision before you commit. Pick a scenario to see the impact."
            actionLabel="Open Simulator"
            actionTo="/simulator"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SIM_SCENARIOS.map((sc) => {
              const Icon = sc.icon;
              return (
                <Link key={sc.title} to="/simulator" className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">{sc.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sc.tagline}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FINANCIAL HEALTH SUMMARY */}
        <section className="mt-10">
          <SectionHead eyebrow="Snapshot" title="Financial health summary" subtitle="Compact signals only — the full breakdown lives in your Report." />
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <SnapCard
              icon={ArrowUpRight} tone="secondary"
              title="Biggest strength"
              value={topPillar(score.breakdown)?.pillar ?? "—"}
              hint={`${Math.round(topPillar(score.breakdown)?.pillarScore ?? 0)}/100 pillar score`}
            />
            <SnapCard
              icon={ArrowDownRight} tone="warning"
              title="Needs attention"
              value={weakPillar(score.breakdown)?.pillar ?? "—"}
              hint={`${Math.round(weakPillar(score.breakdown)?.pillarScore ?? 0)}/100 pillar score`}
            />
            <SnapCard
              icon={Layers} tone="primary"
              title="Upcoming milestones"
              value={`${goals.length} active goal${goals.length === 1 ? "" : "s"}`}
              hint={goals[0]?.name ?? "Add a goal in your profile"}
            />
            <SnapCard
              icon={ShieldCheck} tone="accent"
              title="Quick win"
              value={recs[0]?.title ?? "You're on track"}
              hint={recs[0]?.nextAction ?? "No critical actions right now"}
            />
          </div>
        </section>

        {/* MODULES */}
        <section className="mt-14">
          <SectionHead eyebrow="Modules" title="Manage every part of your money" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

/* -------------------- helpers -------------------- */

function topPillar(bd: { pillar: string; pillarScore: number }[]) {
  return bd.length ? bd.reduce((a, b) => (b.pillarScore > a.pillarScore ? b : a)) : null;
}
function weakPillar(bd: { pillar: string; pillarScore: number }[]) {
  return bd.length ? bd.reduce((a, b) => (b.pillarScore < a.pillarScore ? b : a)) : null;
}

function PrimaryTile({
  label, value, badge, sub, to, hero = false,
}: {
  label: string; value: React.ReactNode; badge: string; sub: string; to: string; hero?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
        hero ? "border-primary/40 bg-gradient-to-br from-primary-soft/60 to-card" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold text-secondary">{badge}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

function SectionHead({
  eyebrow, title, subtitle, actionLabel, actionTo,
}: {
  eyebrow: string; title: string; subtitle?: string;
  actionLabel?: string; actionTo?: "/recommendations" | "/ai-coach" | "/simulator";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl text-foreground md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="text-xs font-semibold text-primary hover:underline">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

function SnapCard({
  icon: Icon, tone, title, value, hint,
}: {
  icon: typeof ArrowUpRight; tone: "primary" | "secondary" | "warning" | "accent";
  title: string; value: string; hint: string;
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    secondary: "bg-secondary-soft text-secondary",
    warning: "bg-warning-soft text-warning",
    accent: "bg-accent/10 text-accent",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{hint}</p>
    </div>
  );
}

function NitiGuidePreview() {
  const fn = useServerFn(getNitiGuideExplanation);
  const { data, isLoading } = useQuery({
    queryKey: ["niti-guide", "overview"],
    queryFn: () => fn({ data: { focus: "overview" } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return (
    <div className="mt-5 rounded-2xl border border-border bg-gradient-to-br from-primary-soft/40 to-card p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">NitiGuide is reading your numbers…</p>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {data?.explanation ?? "NitiGuide is temporarily unavailable — your NitiCore metrics remain accurate above."}
            </p>
          )}
          {data?.source === "fallback" && (
            <p className="mt-3 text-[11px] italic text-muted-foreground">
              AI explanations resume when the service reconnects. Your numbers are always deterministic.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const SIM_SCENARIOS = [
  { title: "Home Purchase", tagline: "See the 20-year impact", icon: Home },
  { title: "Car Purchase", tagline: "EMI vs. lump sum", icon: Car },
  { title: "Salary Increase", tagline: "Where should it go?", icon: TrendingUp },
  { title: "SIP Increase", tagline: "Extra ₹5k / month", icon: Coins },
  { title: "Marriage", tagline: "Plan the cost", icon: Heart },
  { title: "Child Education", tagline: "Corpus needed", icon: Baby },
  { title: "Loan Prepayment", tagline: "Prepay vs. invest", icon: Wallet },
  { title: "Early Retirement", tagline: "Retire 5 years earlier", icon: Sun },
] as const;

const MODULES = [
  { to: "/net-worth", icon: TrendingUp, name: "Net Worth", hint: "Assets − liabilities" },
  { to: "/emergency-fund", icon: Wallet, name: "Emergency Fund", hint: "Months of runway" },
  { to: "/insurance", icon: Shield, name: "Insurance", hint: "Cover adequacy" },
  { to: "/retirement", icon: PiggyBank, name: "Retirement", hint: "Corpus gap" },
  { to: "/goals", icon: Target, name: "Goals", hint: "Track & fund" },
  { to: "/peer-benchmark", icon: Briefcase, name: "Peer Benchmark", hint: "Where you stand" },
  { to: "/recommendations", icon: Sparkles, name: "Recommendations", hint: "NitiPath details" },
  { to: "/simulator", icon: FlaskConical, name: "Simulator", hint: "What-if scenarios" },
  { to: "/ai-coach", icon: GraduationCap, name: "NitiGuide", hint: "Ask the coach" },
] as const;
