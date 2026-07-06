import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Target, Shield, PiggyBank, Wallet, TrendingUp, FlaskConical, GraduationCap,
  Briefcase, Sparkles, ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw,
  Gauge, Hourglass,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
import type { NitiCoreInput, Recommendation } from "@/lib/niti-core";
import { formatINR } from "@/lib/finance/core";
import { getNitiGuideBriefing } from "@/lib/niti-guide.functions";

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

type MetricKind = "score" | "age" | "networth" | "emergency";

function Dashboard() {
  const { data, isLoading } = useDashboardData();
  const [openMetric, setOpenMetric] = useState<MetricKind | null>(null);
  const [openRec, setOpenRec] = useState<Recommendation | null>(null);

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

  const agePayload = nitiAge.aiPayload as { direction: "ahead" | "behind" | "on_track"; deltaYears: number; interpretation: string } | undefined;
  const ageDirection = agePayload?.direction ?? "on_track";
  const ageDeltaYears = agePayload?.deltaYears ?? 0;
  const ageDelta = Number(nitiAge.value) - input.ageYears;
  const ageBadge = ageDirection === "ahead"
    ? { label: `Ahead by ${ageDeltaYears}y`, cls: "bg-secondary-soft text-secondary" }
    : ageDirection === "behind"
      ? { label: `Behind by ${ageDeltaYears}y`, cls: "bg-warning-soft text-warning" }
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
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted md:text-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Update Analysis
            </Link>
            <Link
              to="/financial-health"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95 md:text-sm"
            >
              Financial Health <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {!hasData && (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm">
            <p className="font-semibold text-foreground">Add your finances to unlock your real NitiScore.</p>
            <p className="mt-1 text-muted-foreground">Head to your profile and add income, assets, and liabilities.</p>
            <Link
              to="/onboarding"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
            >
              Start your review →
            </Link>
          </div>
        )}

        {/* ── HERO: 2x2 left grid + full-height NitiPath right ─────── */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
            {/* NitiScore */}
            <MetricTile
              onClick={() => setOpenMetric("score")}
              accent="primary"
              eyebrow="NitiScore™"
              icon={Gauge}
              badge={{ label: `Grade ${score.grade}`, cls: "bg-primary text-primary-foreground" }}
              value={<span className="font-display text-5xl font-semibold leading-none text-foreground md:text-6xl">{score.value}</span>}
              unit="/ 1000"
              footer={
                <>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700" style={{ width: `${Math.min(100, (score.value / 1000) * 100)}%` }} />
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {score.value >= 750 ? "Excellent overall financial health." :
                      score.value >= 600 ? "Solid foundation — some pillars still need work." :
                      score.value >= 400 ? "Under strain — a few high-impact fixes will move you fast." :
                      "Fragile — focus on protection and buffer first."}
                  </p>
                </>
              }
            />

            {/* NitiAge */}
            <MetricTile
              onClick={() => setOpenMetric("age")}
              accent="secondary"
              eyebrow="NitiAge™"
              icon={Hourglass}
              badge={{
                label: ageBadge.label,
                cls: ageBadge.cls,
                icon: ageDelta < 0 ? ArrowDownRight : ageDelta > 0 ? ArrowUpRight : undefined,
              }}
              value={<span className="font-display text-5xl font-semibold leading-none text-foreground md:text-6xl">{nitiAge.value}</span>}
              unit="yrs"
              footer={
                <>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Actual age <span className="font-semibold text-foreground">{input.ageYears}</span> · your money habits behave like this age.
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {ageDelta < 0 ? "You are financially older than your years — a good sign." :
                     ageDelta > 0 ? "You are financially younger than your years — habits need catch-up." :
                     "Right on track with your years."}
                  </p>
                </>
              }
            />

            {/* Net Worth */}
            <MetricTile
              onClick={() => setOpenMetric("networth")}
              accent="muted"
              eyebrow="Net Worth"
              icon={TrendingUp}
              badge={{
                label: netWorth.value >= 0 ? "Positive" : "Negative",
                cls: netWorth.value >= 0 ? "bg-secondary-soft text-secondary" : "bg-warning-soft text-warning",
              }}
              value={<span className="font-display text-3xl leading-tight text-foreground">{formatINR(netWorth.value)}</span>}
              footer={
                <>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Assets {formatINR(totalAssets)}</span>
                    <span>Liab. {formatINR(totalLiabilities)}</span>
                  </div>
                  <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-secondary transition-[width] duration-700" style={{ width: `${nwAssetsPct}%` }} />
                    <div className="h-full bg-warning/70" style={{ width: `${100 - nwAssetsPct}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {netWorth.value >= 0 ? "You own more than you owe — keep compounding." : "Liabilities exceed assets — prioritise debt paydown."}
                  </p>
                </>
              }
            />

            {/* Emergency Fund */}
            <MetricTile
              onClick={() => setOpenMetric("emergency")}
              accent="muted"
              eyebrow="Emergency Fund"
              icon={Wallet}
              badge={{ label: emStatus.label, cls: emStatus.cls }}
              value={<span className="font-display text-3xl leading-tight text-foreground">{Number(emergency.value).toFixed(1)}</span>}
              unit="/ 6 months"
              footer={
                <>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-secondary transition-[width] duration-700" style={{ width: `${Math.min(100, (Number(emergency.value) / 6) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {Number(emergency.value) >= 6 ? "Buffer is full — you can invest with confidence."
                      : Number(emergency.value) >= 3 ? "Partial cover — keep topping up monthly."
                      : "Below safety line — prioritise the buffer above returns."}
                  </p>
                </>
              }
            />
          </div>

          {/* RIGHT: NitiPath full-height */}
          <aside className="flex flex-col rounded-2xl border border-primary/30 bg-gradient-to-b from-card to-primary-soft/20 p-5 shadow-soft lg:col-span-1 lg:h-full">
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
            <p className="mt-1 text-[11px] text-muted-foreground">Your top 3 priorities, ranked by overall financial impact.</p>

            {topRecs.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                You're clear of critical actions right now. Keep saving and revisit monthly.
              </div>
            ) : (
              <ol className="mt-4 flex flex-1 flex-col gap-3">
                {topRecs.map((r, i) => (
                  <li key={r.id} className="flex-1">
                    <button
                      type="button"
                      onClick={() => setOpenRec(r)}
                      className="group flex h-full w-full flex-col rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                          r.priority === "high" ? "bg-warning-soft text-warning" :
                          r.priority === "medium" ? "bg-primary-soft text-primary" :
                          "bg-secondary-soft text-secondary"
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                              r.priority === "high" ? "bg-warning/15 text-warning" :
                              r.priority === "medium" ? "bg-primary/10 text-primary" :
                              "bg-muted text-muted-foreground"
                            }`}>P{i + 1} · {r.priority}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{r.category}</span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold leading-tight text-foreground">{r.title}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                            <span className="font-medium text-foreground/80">Why:</span> {r.whyItMatters}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                            <span className="font-medium text-foreground/80">Impact:</span> {r.expectedImpact}
                          </p>
                          <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-primary">
                            → {r.nextAction}
                          </p>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>

        {/* ── NitiGuide briefing (2/3) + NitiSim launcher (1/3) ────── */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <NitiGuideCard />
          <NitiSimLauncher />
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

      <MetricDialog
        open={openMetric !== null}
        onClose={() => setOpenMetric(null)}
        kind={openMetric}
        score={score}
        nitiAge={nitiAge}
        emergency={emergency}
        netWorth={netWorth}
        input={input}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        topRecs={topRecs}
      />

      <RecommendationDialog
        rec={openRec}
        onClose={() => setOpenRec(null)}
      />
    </div>
  );
}

/* ─────────────── Metric tile ─────────────── */

function MetricTile({
  onClick, eyebrow, icon: Icon, badge, value, unit, footer, accent,
}: {
  onClick: () => void;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: { label: string; cls: string; icon?: React.ComponentType<{ className?: string }> };
  value: React.ReactNode;
  unit?: string;
  footer: React.ReactNode;
  accent: "primary" | "secondary" | "muted";
}) {
  const border = accent === "primary" ? "border-primary/40 bg-gradient-to-br from-primary-soft/70 to-card"
    : accent === "secondary" ? "border-secondary/30 bg-card"
    : "border-border bg-card";
  const eyebrowColor = accent === "primary" ? "text-primary" : accent === "secondary" ? "text-secondary" : "text-muted-foreground";
  const BadgeIcon = badge.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full min-h-[212px] flex-col rounded-2xl border p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated ${border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${eyebrowColor}`} />
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${eyebrowColor}`}>{eyebrow}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
          {BadgeIcon ? <BadgeIcon className="h-3 w-3" /> : null}
          {badge.label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {value}
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-auto">{footer}</div>
      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary">
        Details <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

/* ─────────────── NitiGuide briefing card ─────────────── */

function NitiGuideCard() {
  const fn = useServerFn(getNitiGuideBriefing);
  const { data, isLoading, error } = useQuery({
    queryKey: ["nitiguide-briefing"],
    queryFn: () => fn({ data: {} }),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft lg:col-span-2 lg:h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">NitiGuide™</p>
        </div>
        <Link to="/ai-coach" className="text-[11px] font-semibold text-primary hover:underline">Full briefing →</Link>
      </div>
      <p className="mt-3 font-display text-lg text-foreground">Your financial briefing.</p>
      <p className="mt-1 text-[11px] text-muted-foreground">A calm read on where you stand — from your NitiCore™ snapshot.</p>

      <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
        {isLoading && (
          <div className="space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <p className="pt-2 text-[11px] text-muted-foreground">NitiGuide is reading your numbers…</p>
          </div>
        )}
        {error && (
          <p className="text-xs text-warning">
            {error instanceof Error ? error.message : "Briefing unavailable right now."}
          </p>
        )}
        {data && (
          <div className="prose prose-sm max-w-none text-sm text-foreground/90 prose-p:my-2 prose-p:leading-relaxed prose-strong:text-foreground">
            <ReactMarkdown>{data.markdown}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── NitiSim launcher card ─────────────── */

function NitiSimLauncher() {
  const prompts = [
    "Increase my SIP by ₹5,000",
    "Can I retire by 50?",
    "Can I afford a ₹1 crore house?",
    "Prepay my personal loan?",
  ];
  return (
    <div className="flex flex-col rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-soft/40 via-card to-card p-5 shadow-soft lg:col-span-1 lg:h-full">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">NitiSim™</p>
      </div>
      <p className="mt-3 font-display text-lg text-foreground">Ask any "what if".</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        The only conversational surface in NitiVitt. Every answer is a NitiCore™ recalculation, explained by Gemini.
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {prompts.map((p) => (
          <li key={p}>
            <Link
              to="/simulator"
              className="block rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
            >
              "{p}"
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/simulator"
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-95"
      >
        Open NitiSim <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ─────────────── Metric detail dialog ─────────────── */

function MetricDialog({
  open, onClose, kind, score, nitiAge, emergency, netWorth, input, totalAssets, totalLiabilities, topRecs,
}: {
  open: boolean;
  onClose: () => void;
  kind: MetricKind | null;
  score: ReturnType<typeof calculateNitiScore>;
  nitiAge: ReturnType<typeof calculateNitiAge>;
  emergency: ReturnType<typeof calculateEmergencyFund>;
  netWorth: ReturnType<typeof calculateNetWorth>;
  input: NitiCoreInput;
  totalAssets: number;
  totalLiabilities: number;
  topRecs: Recommendation[];
}) {
  if (!kind) return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent />
    </Dialog>
  );

  const helping: string[] = [];
  const hurting: string[] = [];
  score.breakdown.forEach((b) => {
    if (b.pillarScore >= 75) helping.push(`${b.pillar}: ${Math.round(b.pillarScore)}/100`);
    else if (b.pillarScore < 50) hurting.push(`${b.pillar}: ${Math.round(b.pillarScore)}/100`);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {kind === "score" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">NitiScore™ — {score.value}/1000 · Grade {score.grade}</DialogTitle>
              <DialogDescription>Measure of overall financial health across six pillars.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score breakdown</p>
                <ul className="mt-2 space-y-2">
                  {score.breakdown.map((b) => (
                    <li key={b.pillar} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-foreground">{b.pillar} <span className="text-[10px] text-muted-foreground">· weight {Math.round(b.weight)}%</span></span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${b.pillarScore >= 75 ? "bg-secondary" : b.pillarScore >= 50 ? "bg-primary" : "bg-warning"}`} style={{ width: `${b.pillarScore}%` }} />
                        </div>
                        <span className="w-14 text-right text-xs font-semibold text-foreground">{Math.round(b.pillarScore)}/100</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {helping.length > 0 && (
                <p className="text-sm"><span className="font-semibold text-secondary">What's helping: </span><span className="text-muted-foreground">{helping.join(" · ")}</span></p>
              )}
              {hurting.length > 0 && (
                <p className="text-sm"><span className="font-semibold text-warning">What's hurting: </span><span className="text-muted-foreground">{hurting.join(" · ")}</span></p>
              )}
              {topRecs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions that will raise your score</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {topRecs.map((r) => <li key={r.id}>{r.title} — <span className="text-muted-foreground">{r.nextAction}</span></li>)}
                  </ul>
                </div>
              )}
              <Link to="/financial-health" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                See full Financial Health Report <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}

        {kind === "age" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">NitiAge™ — {nitiAge.value} yrs</DialogTitle>
              <DialogDescription>Your financial maturity translated into an age.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-foreground">Actual age:</span> {input.ageYears} yrs</p>
              <p><span className="font-semibold text-foreground">Financial age:</span> {nitiAge.value} yrs</p>
              <p><span className="font-semibold text-foreground">Delta:</span> {Number(nitiAge.value) - input.ageYears} yrs — {Number(nitiAge.value) - input.ageYears < 0 ? "ahead of your years." : Number(nitiAge.value) - input.ageYears > 0 ? "behind your years." : "on par."}</p>
              <p className="text-muted-foreground">{nitiAge.calculationSummary}</p>
              <p className="text-muted-foreground">{nitiAge.suggestedNextStep}</p>
            </div>
          </>
        )}

        {kind === "networth" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Net Worth — {formatINR(netWorth.value)}</DialogTitle>
              <DialogDescription>Everything you own minus everything you owe.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-foreground">Total assets:</span> {formatINR(totalAssets)}</p>
              <p><span className="font-semibold text-foreground">Total liabilities:</span> {formatINR(totalLiabilities)}</p>
              <p><span className="font-semibold text-foreground">Liquid assets:</span> {formatINR(input.liquidAssets)}</p>
              <p><span className="font-semibold text-foreground">Monthly EMI:</span> {formatINR(input.monthlyEmi)}</p>
              <p className="text-muted-foreground">{netWorth.calculationSummary}</p>
              <Link to="/net-worth" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Manage assets & liabilities <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}

        {kind === "emergency" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Emergency Fund — {Number(emergency.value).toFixed(1)} months</DialogTitle>
              <DialogDescription>How many months of essential expenses you can cover without income.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-foreground">Monthly essentials:</span> {formatINR(input.monthlyEssentialExpenses)}</p>
              <p><span className="font-semibold text-foreground">Liquid buffer:</span> {formatINR(input.liquidAssets)}</p>
              <p><span className="font-semibold text-foreground">Target:</span> 6 months</p>
              <p className="text-muted-foreground">{emergency.calculationSummary}</p>
              <p className="text-muted-foreground">{emergency.suggestedNextStep}</p>
              <Link to="/emergency-fund" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Open Emergency Fund module <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Recommendation detail dialog ─────────────── */

function RecommendationDialog({ rec, onClose }: { rec: Recommendation | null; onClose: () => void }) {
  return (
    <Dialog open={rec !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        {rec && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{rec.title}</DialogTitle>
              <DialogDescription>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    rec.priority === "high" ? "bg-warning/15 text-warning" :
                    rec.priority === "medium" ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>{rec.priority} priority</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rec.category}</span>
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendation</p>
                <p className="mt-1 text-foreground">{rec.explanation}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why this matters</p>
                <p className="mt-1 text-foreground">{rec.whyItMatters}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected impact</p>
                <p className="mt-1 text-foreground">{rec.expectedImpact}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next action</p>
                <p className="mt-1 text-primary">{rec.nextAction}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">The math</p>
                <p className="mt-1">{rec.formulaSummary}</p>
                <p className="mt-1">{rec.logic}</p>
              </div>
              <div className="flex justify-end">
                <Link to="/recommendations" search={{ rec: rec.id }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  Open in NitiPath <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  { to: "/simulator", icon: FlaskConical, name: "NitiSim", hint: "Ask any what-if" },
  { to: "/ai-coach", icon: GraduationCap, name: "NitiGuide", hint: "Your briefing" },
] as const;
