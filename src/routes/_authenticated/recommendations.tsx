import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft, ArrowRight, Wallet, Shield, PiggyBank, TrendingUp, Coins, AlertTriangle,
  Target as TargetIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfile, getFinancialProfile, listAssets, listLiabilities, listInsurance,
} from "@/lib/services/profile.service";
import {
  generateRecommendations,
  calculateEmergencyFund, calculateInsuranceAdequacy, calculateDebtRatio,
  calculateSavingsRate, calculateRetirement,
  type NitiCoreInput,
} from "@/lib/niti-core";
import type { Recommendation } from "@/lib/niti-core/types";

const searchSchema = z.object({ rec: z.string().optional() });

export const Route = createFileRoute("/_authenticated/recommendations")({
  head: () => ({
    meta: [
      { title: "NitiPath™ — Recommendations — NitiVitt" },
      { name: "description", content: "Your prioritized action plan, computed by NitiCore™. Every recommendation is transparent about the reason, math, and impact." },
    ],
  }),
  validateSearch: searchSchema,
  component: RecommendationsPage,
});

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function useUserInput() {
  return useQuery({
    queryKey: ["nitipath-input"],
    queryFn: async (): Promise<NitiCoreInput> => {
      const { data } = await supabase.auth.getUser();
      const user = data.user!;
      const [profile, fp, assets, liabs, insurance] = await Promise.all([
        getProfile(user.id), getFinancialProfile(user.id),
        listAssets(user.id), listLiabilities(user.id), listInsurance(user.id),
      ]);
      const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
      const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
      const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
      const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
      const termCover = insurance.filter((i) => i.insurance_type === "term")
        .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);
      return {
        ageYears: ageFromDob(profile?.date_of_birth ?? null),
        monthlyIncome: Number(fp?.monthly_income ?? 0),
        monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
        monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
        liquidAssets, totalAssets, totalLiabilities, monthlyEmi,
        monthlyInvestments: 0, totalInvestments: 0,
        hasTermInsurance: insurance.some((i) => i.insurance_type === "term"),
        hasHealthInsurance: insurance.some((i) => i.insurance_type === "health"),
        termCover,
        retirementCorpus: 0, retirementAge: Number(fp?.retirement_age ?? 60),
        riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
      };
    },
  });
}

const CATEGORY_META: Record<Recommendation["category"], { icon: typeof Wallet; module: { to: "/emergency-fund" | "/insurance" | "/net-worth" | "/retirement" | "/goals"; name: string } }> = {
  Emergency:   { icon: Wallet,     module: { to: "/emergency-fund", name: "Emergency Fund" } },
  Insurance:   { icon: Shield,     module: { to: "/insurance",       name: "Insurance" } },
  Debt:        { icon: AlertTriangle, module: { to: "/net-worth",     name: "Net Worth" } },
  Savings:     { icon: Coins,      module: { to: "/net-worth",       name: "Net Worth" } },
  Investments: { icon: TrendingUp, module: { to: "/net-worth",       name: "Net Worth" } },
  Goals:       { icon: TargetIcon, module: { to: "/goals",           name: "Goals" } },
  Retirement:  { icon: PiggyBank,  module: { to: "/retirement",      name: "Retirement" } },
};

const PRIORITY_STYLES = {
  high: "bg-warning-soft text-warning border-warning/30",
  medium: "bg-primary-soft text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
} as const;

function RecommendationsPage() {
  const { rec: activeId } = useSearch({ from: "/_authenticated/recommendations" });
  const { data: input, isLoading } = useUserInput();

  if (isLoading || !input) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteHeader />
        <main className="container-page py-16">
          <p className="text-sm text-muted-foreground">Computing your NitiPath…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const recs = generateRecommendations(input);
  const active = activeId ? recs.find((r) => r.id === activeId) : undefined;

  if (active) return <DetailView rec={active} input={input} />;

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-8 md:py-10">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">NitiPath™</p>
          <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">What should I do next?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your action plan, ranked by impact. Every recommendation was produced by the deterministic NitiCore™ engine — the reasoning is fully transparent.
          </p>
        </header>

        {recs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-display text-xl text-foreground">You're clear of critical actions.</p>
            <p className="mt-2 text-sm text-muted-foreground">Keep saving on autopilot and revisit monthly.</p>
          </div>
        ) : (
          <ol className="mt-8 grid gap-3">
            {recs.map((r, i) => {
              const meta = CATEGORY_META[r.category];
              const Icon = meta.icon;
              return (
                <li key={r.id}>
                  <Link
                    to="/recommendations"
                    search={{ rec: r.id }}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${PRIORITY_STYLES[r.priority]}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="hidden font-display text-2xl font-semibold text-muted-foreground/60 sm:inline">P{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_STYLES[r.priority]}`}>
                          {r.priority} priority
                        </span>
                        <span className="text-[11px] text-muted-foreground">{r.category}</span>
                      </div>
                      <p className="mt-1 truncate font-display text-lg text-foreground">{r.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{r.explanation}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function DetailView({ rec, input }: { rec: Recommendation; input: NitiCoreInput }) {
  const meta = CATEGORY_META[rec.category];
  const { currentText, recommendedText, timeline } = deriveCurrentVsRecommended(rec, input);

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-8 md:py-10">
        <Link
          to="/recommendations"
          search={{}}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to NitiPath
        </Link>

        <header className="mt-4 flex flex-wrap items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${PRIORITY_STYLES[rec.priority]}`}>
            <meta.icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_STYLES[rec.priority]}`}>
                {rec.priority} priority
              </span>
              <span className="text-[11px] text-muted-foreground">{rec.category}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl text-foreground md:text-3xl">{rec.title}</h1>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <DetailCard title="Why this matters">
            <p>{rec.explanation}</p>
            <p className="mt-2 text-muted-foreground">{rec.logic}</p>
          </DetailCard>
          <DetailCard title="Current vs recommended">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current</p>
                <p className="mt-1 font-semibold text-foreground">{currentText}</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Recommended</p>
                <p className="mt-1 font-semibold text-foreground">{recommendedText}</p>
              </div>
            </div>
          </DetailCard>
          <DetailCard title="Expected impact">
            <p>{rec.impact}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Estimated timeline · {timeline}</p>
          </DetailCard>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Suggested action plan</p>
          <p className="mt-2 text-base font-semibold text-foreground">{rec.nextAction}</p>
          <p className="mt-3 text-xs text-muted-foreground">Effort · {rec.effort}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={meta.module.to}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95"
            >
              Open {meta.module.name} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/ai-coach"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
            >
              Ask NitiGuide to explain
            </Link>
            <Link
              to="/simulator"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
            >
              Simulate this in NitiSim
            </Link>
          </div>
        </section>

        <details className="mt-4 rounded-2xl border border-border bg-card px-6 py-4 text-sm">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Math & assumptions used
          </summary>
          <p className="mt-3 font-mono text-[13px] text-foreground">{rec.formulaSummary}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-foreground">
            {Object.entries(rec.assumptions).map(([k, v]) => (
              <li key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            The full diagnostic explanation lives in the{" "}
            <Link to="/financial-health" className="font-semibold text-primary hover:underline">Financial Health Report</Link>.
          </p>
        </details>
      </main>
      <SiteFooter />
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Derive "current" and "recommended" text specific to each recommendation category,
 * using the same deterministic NitiCore inputs.
 */
function deriveCurrentVsRecommended(rec: Recommendation, input: NitiCoreInput): { currentText: string; recommendedText: string; timeline: string } {
  switch (rec.category) {
    case "Emergency": {
      const r = calculateEmergencyFund(input);
      return {
        currentText: `${Number(r.value).toFixed(1)} months of essentials`,
        recommendedText: `6 months of essentials`,
        timeline: "6–12 months",
      };
    }
    case "Insurance": {
      const r = calculateInsuranceAdequacy(input);
      return {
        currentText: `${Math.round(Number(r.value))}% of recommended cover`,
        recommendedText: `100% (Term ≥ 15× income, Health ≥ ₹10 L)`,
        timeline: "This month",
      };
    }
    case "Debt": {
      const r = calculateDebtRatio(input);
      return {
        currentText: `${Number(r.value).toFixed(1)}% EMI-to-income`,
        recommendedText: `< 20% (max 40%)`,
        timeline: "6–24 months",
      };
    }
    case "Savings": {
      const r = calculateSavingsRate(input);
      return {
        currentText: `${Number(r.value).toFixed(1)}% saved`,
        recommendedText: `≥ 30% of income`,
        timeline: "Next salary cycle",
      };
    }
    case "Retirement": {
      const r = calculateRetirement(input);
      return {
        currentText: r.calculationSummary,
        recommendedText: `On track for retirement at ${input.retirementAge}`,
        timeline: `${Math.max(1, input.retirementAge - input.ageYears)} years`,
      };
    }
    default:
      return { currentText: "—", recommendedText: "—", timeline: "—" };
  }
}
