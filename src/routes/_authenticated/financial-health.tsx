import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfile, getFinancialProfile, listAssets, listLiabilities, listGoals, listInsurance,
} from "@/lib/services/profile.service";
import {
  calculateNitiScore, calculateNitiAge, calculateEmergencyFund, calculateNetWorth,
  calculateSavingsRate, calculateDebtRatio, calculateInsuranceAdequacy, calculateRetirement,
  NITI_CORE_CONFIG,
} from "@/lib/niti-core";
import type { NitiCoreInput } from "@/lib/niti-core";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/financial-health")({
  head: () => ({
    meta: [
      { title: "Financial Health Report — NitiVitt" },
      { name: "description", content: "The complete diagnostic. Every metric, formula and assumption behind your NitiScore™." },
    ],
  }),
  component: FinancialHealthReport,
});

const LAST_UPDATED_KEY = "nitivitt:health-report:last-updated";

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function useReportData() {
  return useQuery({
    queryKey: ["health-report"],
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

function FinancialHealthReport() {
  const { data, isLoading } = useReportData();
  const fpUpdated = (data?.fp as unknown as { updated_at?: string } | null)?.updated_at;


  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteHeader />
        <main className="container-page py-16">
          <p className="text-sm text-muted-foreground">Loading your report…</p>
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

  const score = calculateNitiScore(input);
  const age = calculateNitiAge(input);
  const emergency = calculateEmergencyFund(input);
  const netWorth = calculateNetWorth(input);
  const savings = calculateSavingsRate(input);
  const debt = calculateDebtRatio(input);
  const insAdequacy = calculateInsuranceAdequacy(input);
  const retirement = calculateRetirement(input);

  const updatedLabel = fpUpdated
    ? new Date(fpUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not yet refreshed";

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Financial Health Report</p>
            <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">The complete diagnostic.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every metric that powers your NitiScore™, with the formula, assumptions and next step attached. Update anything by reviewing your profile - it is the single source of truth.
            </p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">Last updated: {updatedLabel}</p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95"
          >
            <RefreshCw className="h-4 w-4" />
            Review Profile
          </Link>
        </div>


        {/* Overall summary */}
        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall financial summary</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-6xl text-foreground">{score.value}</span>
              <span className="text-sm text-muted-foreground">/1000</span>
              <span className="ml-2 rounded-full bg-secondary-soft px-2.5 py-1 text-xs font-semibold text-secondary">Grade {score.grade}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {score.calculationSummary}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">NitiAge™</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl">{age.value}</span>
              <span className="text-xs text-primary-foreground/70">yrs · real {input.ageYears}</span>
            </div>
            {(() => {
              const p = age.aiPayload as { direction: "ahead" | "behind" | "on_track"; deltaYears: number; interpretation: string } | undefined;
              const dir = p?.direction ?? "on_track";
              const dy = p?.deltaYears ?? 0;
              const label = dir === "ahead" ? `Ahead by ${dy} yr${dy === 1 ? "" : "s"}` : dir === "behind" ? `Behind by ${dy} yr${dy === 1 ? "" : "s"}` : "On par";
              return (
                <>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/90">{label}</p>
                  <p className="mt-1 text-xs text-primary-foreground/80">{p?.interpretation ?? age.calculationSummary}</p>
                </>
              );
            })()}
          </div>
        </section>

        {/* Score breakdown */}
        <section className="mt-10">
          <h2 className="font-display text-2xl text-foreground md:text-3xl">NitiScore™ breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every pillar, its weight, its score, and the exact reason behind the number.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {score.breakdown.map((p) => (
              <div key={p.pillar} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{p.pillar}</p>
                  <p className="text-xs text-muted-foreground">weight {p.weight}%</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.pillarScore}%`,
                      backgroundColor: p.pillarScore >= 75 ? "var(--color-secondary)" : p.pillarScore >= 50 ? "var(--color-primary)" : "var(--color-warning)",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Pillar score: {Math.round(p.pillarScore)}/100 · Weighted contribution: {p.weighted.toFixed(1)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{p.reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Metric explanations */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <MetricCard title="Net Worth" value={formatINR(netWorth.value)} status={netWorth.status}
            formula="Total assets − total liabilities"
            calc={netWorth.calculationSummary} action={netWorth.suggestedNextStep} />
          <MetricCard title="Savings rate" value={`${Number(savings.value).toFixed(1)}%`} status={savings.status}
            formula="(Income − expenses) / income × 100"
            calc={savings.calculationSummary} action={savings.suggestedNextStep} />
          <MetricCard title="Emergency fund" value={`${Number(emergency.value).toFixed(1)} months`} status={emergency.status}
            formula="Liquid assets / essential monthly expenses"
            calc={emergency.calculationSummary} action={emergency.suggestedNextStep} />
          <MetricCard title="Debt health" value={`${Number(debt.value).toFixed(1)}% EMI/income`} status={debt.status}
            formula="Total EMI / monthly income × 100"
            calc={debt.calculationSummary} action={debt.suggestedNextStep} />
          <MetricCard title="Insurance adequacy" value={`${Math.round(Number(insAdequacy.value))}%`} status={insAdequacy.status}
            formula={`Term cover / (annual income × ${NITI_CORE_CONFIG.termLifeMultiplier}) blended with health status`}
            calc={insAdequacy.calculationSummary} action={insAdequacy.suggestedNextStep} />
          <MetricCard title="Retirement readiness" value={retirement.status.replace("_", " ")} status={retirement.status}
            formula="Projected corpus at retirement vs. required corpus (4% rule, inflation-adjusted)"
            calc={retirement.calculationSummary} action={retirement.suggestedNextStep} />
        </section>

        {/* Assumptions */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl text-foreground">Assumptions used</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the deterministic constants inside the NitiCore™ engine. Every projection uses them — no exceptions.
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Assumption label="Inflation" value={`${(NITI_CORE_CONFIG.inflation * 100).toFixed(1)}% p.a.`} />
            <Assumption label="Equity return" value={`${(NITI_CORE_CONFIG.equityReturn * 100).toFixed(1)}% p.a.`} />
            <Assumption label="Debt return" value={`${(NITI_CORE_CONFIG.debtReturn * 100).toFixed(1)}% p.a.`} />
            <Assumption label="Hybrid return" value={`${(NITI_CORE_CONFIG.hybridReturn * 100).toFixed(1)}% p.a.`} />
            <Assumption label="Post-retirement return" value={`${(NITI_CORE_CONFIG.postRetirementReturn * 100).toFixed(1)}% p.a.`} />
            <Assumption label="Withdrawal rate" value={`${(NITI_CORE_CONFIG.retirementWithdrawalRate * 100).toFixed(1)}%`} />
            <Assumption label="Term life multiplier" value={`${NITI_CORE_CONFIG.termLifeMultiplier}× annual income`} />
            <Assumption label="Emergency target (salaried)" value={`${NITI_CORE_CONFIG.emergencyFundMonths.salaried} months`} />
            <Assumption label="Emergency target (self-employed)" value={`${NITI_CORE_CONFIG.emergencyFundMonths.selfEmployed} months`} />
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function MetricCard({
  title, value, status, formula, calc, action,
}: {
  title: string; value: string;
  status: "on_track" | "needs_attention" | "critical" | "not_available";
  formula: string; calc: string; action: string;
}) {
  const chip = {
    on_track: "bg-secondary-soft text-secondary",
    needs_attention: "bg-primary-soft text-primary",
    critical: "bg-warning-soft text-warning",
    not_available: "bg-muted text-muted-foreground",
  }[status];
  const label = {
    on_track: "On track", needs_attention: "Attention", critical: "Critical", not_available: "N/A",
  }[status];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${chip}`}>{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl text-foreground">{value}</p>
      <dl className="mt-4 space-y-2 text-xs">
        <div><dt className="font-semibold uppercase tracking-wider text-muted-foreground">Formula</dt><dd className="text-foreground/90">{formula}</dd></div>
        <div><dt className="font-semibold uppercase tracking-wider text-muted-foreground">Your calculation</dt><dd className="text-foreground/90">{calc}</dd></div>
        <div><dt className="font-semibold uppercase tracking-wider text-muted-foreground">Next step</dt><dd className="text-foreground/90">{action}</dd></div>
      </dl>
    </div>
  );
}

function Assumption({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
