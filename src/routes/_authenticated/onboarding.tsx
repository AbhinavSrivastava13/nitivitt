import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { AnalysisSequence } from "@/components/analysis-sequence";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertProfile,
  upsertFinancialProfile,
  markOnboardingComplete,
  insertGoal,
  insertInsurance,
  insertAsset,
  insertLiability,
  getProfile,
  getFinancialProfile,
  listAssets,
  listLiabilities,
  listGoals,
  listInsurance,
} from "@/lib/services/profile.service";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — NitiVitt" },
      { name: "description", content: "Set up your NitiVitt financial profile in six focused steps." },
    ],
  }),
  component: OnboardingWizard,
});

const STEPS = [
  "About You",
  "Income & Expenses",
  "Assets, Investments & Liabilities",
  "Protection & Retirement",
  "Financial Goals",
  "Review",
] as const;

interface IncomeMap { salary: number; business: number; freelance: number; rental: number; other: number }
interface ExpenseMap {
  rent_emi: number; groceries: number; utilities: number; transport: number;
  lifestyle: number; healthcare: number; insurance_prem: number; education: number;
  entertainment: number; other: number;
}
interface AssetMap {
  bank: number; fd: number; epf: number; ppf: number; nps: number; mutual_funds: number;
  stocks: number; gold: number; crypto: number; real_estate: number; other: number;
}
interface LiabilityMap {
  home_loan: number; car_loan: number; personal_loan: number; education_loan: number;
  credit_card: number;
}

interface GoalDraft {
  goal_type: string;
  name: string;
  target_amount: number;
  target_year: number;
  current_progress: number;
  monthly_contribution: number;
  priority: "high" | "medium" | "low";
}

interface State {
  // Step 1
  full_name: string;
  date_of_birth: string;
  gender: string;
  occupation: string;
  city: string;
  marital_status: string;
  dependents: number;
  earning_members: number;
  // Step 2
  income: IncomeMap;
  expenses: ExpenseMap;
  // Step 3
  assets: AssetMap;
  liabilities: LiabilityMap;
  monthly_emi_total: number;
  loan_tenure_months: number;
  monthly_sip: number;
  annual_investment: number;
  existing_portfolio: number;
  // Step 4
  has_health: boolean; health_cover: number;
  has_term: boolean; term_cover: number;
  has_employer: boolean; employer_cover: number;
  has_critical: boolean; critical_cover: number;
  has_pa: boolean; pa_cover: number;
  retirement_age: number;
  retirement_corpus: number;
  retirement_lifestyle: "modest" | "comfortable" | "premium";
  risk_profile: "conservative" | "moderate" | "aggressive";
  // Step 5
  goals: GoalDraft[];
}

const ZERO_INCOME: IncomeMap = { salary: 0, business: 0, freelance: 0, rental: 0, other: 0 };
const ZERO_EXPENSES: ExpenseMap = {
  rent_emi: 0, groceries: 0, utilities: 0, transport: 0,
  lifestyle: 0, healthcare: 0, insurance_prem: 0, education: 0,
  entertainment: 0, other: 0,
};
const ZERO_ASSETS: AssetMap = {
  bank: 0, fd: 0, epf: 0, ppf: 0, nps: 0, mutual_funds: 0,
  stocks: 0, gold: 0, crypto: 0, real_estate: 0, other: 0,
};
const ZERO_LIAB: LiabilityMap = {
  home_loan: 0, car_loan: 0, personal_loan: 0, education_loan: 0, credit_card: 0,
};

const LIQUID_ASSET_KEYS = new Set<keyof AssetMap>(["bank", "fd", "mutual_funds", "stocks", "gold", "crypto"]);

function sum(o: object): number {
  return Object.values(o as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
}



function OnboardingWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [s, setS] = useState<State>({
    full_name: "", date_of_birth: "", gender: "", occupation: "", city: "",
    marital_status: "single", dependents: 0, earning_members: 1,
    income: { ...ZERO_INCOME }, expenses: { ...ZERO_EXPENSES },
    assets: { ...ZERO_ASSETS }, liabilities: { ...ZERO_LIAB },
    monthly_emi_total: 0, loan_tenure_months: 0,
    monthly_sip: 0, annual_investment: 0, existing_portfolio: 0,
    has_health: false, health_cover: 0,
    has_term: false, term_cover: 0,
    has_employer: false, employer_cover: 0,
    has_critical: false, critical_cover: 0,
    has_pa: false, pa_cover: 0,
    retirement_age: 60, retirement_corpus: 0, retirement_lifestyle: "comfortable",
    risk_profile: "moderate",
    goals: [],
  });

  // Prefill from Supabase when the user has an existing profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      const [profile, fp, assets, liabs, goals, insurance] = await Promise.all([
        getProfile(user.id),
        getFinancialProfile(user.id),
        listAssets(user.id),
        listLiabilities(user.id),
        listGoals(user.id),
        listInsurance(user.id),
      ]);
      if (cancelled) return;

      const nextAssets: AssetMap = { ...ZERO_ASSETS };
      for (const a of assets) {
        const key = a.category as keyof AssetMap;
        if (key in nextAssets) nextAssets[key] = (nextAssets[key] ?? 0) + Number(a.current_value ?? 0);
        else nextAssets.other = (nextAssets.other ?? 0) + Number(a.current_value ?? 0);
      }
      const nextLiab: LiabilityMap = { ...ZERO_LIAB };
      let emiSum = 0;
      let tenure = 0;
      for (const l of liabs) {
        const key = l.category as keyof LiabilityMap;
        if (key in nextLiab) nextLiab[key] = (nextLiab[key] ?? 0) + Number(l.outstanding_amount ?? 0);
        emiSum += Number(l.monthly_emi ?? 0);
        if (l.tenure_months) tenure = Math.max(tenure, Number(l.tenure_months));
      }
      const insByType = (t: string) =>
        insurance.filter((i) => i.insurance_type === t).reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);
      const nextGoals: GoalDraft[] = goals.map((g) => ({
        goal_type: g.goal_type ?? "other",
        name: g.name ?? "",
        target_amount: Number(g.target_amount ?? 0),
        target_year: g.target_date ? new Date(g.target_date).getFullYear() : new Date().getFullYear() + 5,
        current_progress: 0,
        monthly_contribution: 0,
        priority: (g.priority as GoalDraft["priority"]) ?? "medium",
      }));

      const hasAnyProfile = !!(profile?.full_name || fp?.monthly_income);
      if (hasAnyProfile) setIsReturning(true);

      setS((prev) => ({
        ...prev,
        full_name: profile?.full_name ?? prev.full_name,
        date_of_birth: profile?.date_of_birth ?? prev.date_of_birth,
        gender: profile?.gender ?? prev.gender,
        occupation: profile?.occupation ?? prev.occupation,
        city: profile?.city ?? prev.city,
        marital_status: profile?.marital_status ?? prev.marital_status,
        dependents: profile?.dependents ?? prev.dependents,
        // Income/expenses: only totals are persisted → put into a single line so numbers survive round-trip
        income: fp?.monthly_income
          ? { ...ZERO_INCOME, salary: Number(fp.monthly_income) }
          : prev.income,
        expenses: fp?.monthly_expenses
          ? {
              ...ZERO_EXPENSES,
              rent_emi: Number(fp.monthly_essential_expenses ?? 0),
              lifestyle: Math.max(0, Number(fp.monthly_expenses ?? 0) - Number(fp.monthly_essential_expenses ?? 0)),
            }
          : prev.expenses,
        risk_profile: (fp?.risk_profile as State["risk_profile"]) ?? prev.risk_profile,
        retirement_age: fp?.retirement_age ?? prev.retirement_age,
        assets: nextAssets,
        liabilities: nextLiab,
        monthly_emi_total: emiSum || prev.monthly_emi_total,
        loan_tenure_months: tenure || prev.loan_tenure_months,
        has_health: insByType("health") > 0, health_cover: insByType("health"),
        has_term: insByType("term") > 0, term_cover: insByType("term"),
        has_employer: insByType("employer") > 0, employer_cover: insByType("employer"),
        has_critical: insByType("critical_illness") > 0, critical_cover: insByType("critical_illness"),
        has_pa: insByType("personal_accident") > 0, pa_cover: insByType("personal_accident"),
        goals: nextGoals,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalIncome = sum(s.income);
  const totalExpenses = sum(s.expenses);
  const monthlySavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0;

  function set<K extends keyof State>(k: K, v: State[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function updateIncome(k: keyof IncomeMap, v: number) {
    setS((p) => ({ ...p, income: { ...p.income, [k]: v } }));
  }
  function updateExpense(k: keyof ExpenseMap, v: number) {
    setS((p) => ({ ...p, expenses: { ...p.expenses, [k]: v } }));
  }
  function updateAsset(k: keyof AssetMap, v: number) {
    setS((p) => ({ ...p, assets: { ...p.assets, [k]: v } }));
  }
  function updateLiability(k: keyof LiabilityMap, v: number) {
    setS((p) => ({ ...p, liabilities: { ...p.liabilities, [k]: v } }));
  }
  function addGoal() {
    setS((p) => ({
      ...p,
      goals: [
        ...p.goals,
        {
          goal_type: "retirement", name: "", target_amount: 0,
          target_year: new Date().getFullYear() + 10,
          current_progress: 0, monthly_contribution: 0, priority: "medium",
        },
      ],
    }));
  }
  function updateGoal(i: number, patch: Partial<GoalDraft>) {
    setS((p) => ({
      ...p,
      goals: p.goals.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    }));
  }
  function removeGoal(i: number) {
    setS((p) => ({ ...p, goals: p.goals.filter((_, idx) => idx !== i) }));
  }

  async function persist() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const nameSchema = z.string().trim().min(1, "Enter your name").max(100);
    const parsedName = nameSchema.parse(s.full_name);

    await upsertProfile({
      id: user.id, full_name: parsedName,
      date_of_birth: s.date_of_birth || null,
      gender: s.gender || null,
      city: s.city || null,
      occupation: s.occupation || null,
      marital_status: s.marital_status,
      dependents: s.dependents,
    });

    const essentials = s.expenses.rent_emi + s.expenses.groceries + s.expenses.utilities + s.expenses.transport + s.expenses.healthcare;
    await upsertFinancialProfile({
      user_id: user.id,
      monthly_income: totalIncome,
      annual_income: totalIncome * 12,
      monthly_expenses: totalExpenses,
      monthly_essential_expenses: essentials,
      risk_profile: s.risk_profile,
      retirement_age: s.retirement_age,
    });

    // Wipe existing child rows so a review-and-save produces one clean snapshot
    // (idempotent regardless of whether the user is onboarding or reviewing).
    await Promise.all([
      supabase.from("assets").delete().eq("user_id", user.id),
      supabase.from("liabilities").delete().eq("user_id", user.id),
      supabase.from("insurance").delete().eq("user_id", user.id),
      supabase.from("goals").delete().eq("user_id", user.id),
    ]);

    // Assets
    for (const key of Object.keys(s.assets) as (keyof AssetMap)[]) {
      const val = s.assets[key];
      if (val > 0) {
        await insertAsset({
          user_id: user.id,
          category: key,
          name: key.replace(/_/g, " "),
          current_value: val,
          is_liquid: LIQUID_ASSET_KEYS.has(key),
        });
      }
    }
    // Liabilities
    const liabKeys = Object.keys(s.liabilities) as (keyof LiabilityMap)[];
    const totalOutstanding = sum(s.liabilities);
    for (const key of liabKeys) {
      const val = s.liabilities[key];
      if (val > 0) {
        // Distribute EMI proportionally across liabilities (approximate)
        const share = totalOutstanding > 0 ? val / totalOutstanding : 0;
        await insertLiability({
          user_id: user.id,
          category: key,
          name: key.replace(/_/g, " "),
          outstanding_amount: val,
          monthly_emi: Math.round(s.monthly_emi_total * share),
          tenure_months: s.loan_tenure_months || null,
        });
      }
    }
    // Insurance
    const insRows: { type: string; cover: number; enabled: boolean }[] = [
      { type: "health", cover: s.health_cover, enabled: s.has_health },
      { type: "term", cover: s.term_cover, enabled: s.has_term },
      { type: "employer", cover: s.employer_cover, enabled: s.has_employer },
      { type: "critical_illness", cover: s.critical_cover, enabled: s.has_critical },
      { type: "personal_accident", cover: s.pa_cover, enabled: s.has_pa },
    ];
    for (const r of insRows) {
      if (r.enabled && r.cover > 0) {
        await insertInsurance({ user_id: user.id, insurance_type: r.type, cover_amount: r.cover });
      }
    }
    // Goals
    for (const g of s.goals) {
      if (g.name.trim() && g.target_amount > 0) {
        await insertGoal({
          user_id: user.id,
          goal_type: g.goal_type,
          name: g.name.trim(),
          target_amount: g.target_amount,
          target_date: `${g.target_year}-01-01`,
          priority: g.priority,
        });
      }
    }

    await markOnboardingComplete(user.id);
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await persist();
      await qc.invalidateQueries();
      setAnalyzing(true); // full-screen sequence — navigates on complete
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      {analyzing && <AnalysisSequence onComplete={() => navigate({ to: "/dashboard" })} />}
      <main className="container-page py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            {isReturning ? "Review Profile" : "Onboarding"} · Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">{STEPS[step]}</h1>
          {isReturning && step === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Your details are already filled in. Update anything that has changed and save - NitiVitt will refresh every metric automatically.
            </p>
          )}

          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft md:p-8">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldText label="Full name" value={s.full_name} onChange={(v) => set("full_name", v)} />
                <FieldDate label="Date of birth" value={s.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
                <FieldSelect label="Gender" value={s.gender} onChange={(v) => set("gender", v)}
                  options={["", "male", "female", "other", "prefer_not_to_say"]} />
                <FieldText label="Occupation" value={s.occupation} onChange={(v) => set("occupation", v)} />
                <FieldText label="City" value={s.city} onChange={(v) => set("city", v)} />
                <FieldSelect label="Marital status" value={s.marital_status} onChange={(v) => set("marital_status", v)}
                  options={["single", "married", "divorced", "widowed"]} />
                <FieldNumber label="Dependents" value={s.dependents} onChange={(v) => set("dependents", v)} />
                <FieldNumber label="Earning members" value={s.earning_members} onChange={(v) => set("earning_members", v)} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <Section title="Monthly income (₹)">
                  <FieldNumber label="Salary" value={s.income.salary} onChange={(v) => updateIncome("salary", v)} />
                  <FieldNumber label="Business" value={s.income.business} onChange={(v) => updateIncome("business", v)} />
                  <FieldNumber label="Freelance" value={s.income.freelance} onChange={(v) => updateIncome("freelance", v)} />
                  <FieldNumber label="Rental" value={s.income.rental} onChange={(v) => updateIncome("rental", v)} />
                  <FieldNumber label="Other" value={s.income.other} onChange={(v) => updateIncome("other", v)} />
                </Section>
                <Section title="Monthly expenses (₹)">
                  <FieldNumber label="Rent / EMI" value={s.expenses.rent_emi} onChange={(v) => updateExpense("rent_emi", v)} />
                  <FieldNumber label="Groceries" value={s.expenses.groceries} onChange={(v) => updateExpense("groceries", v)} />
                  <FieldNumber label="Utilities" value={s.expenses.utilities} onChange={(v) => updateExpense("utilities", v)} />
                  <FieldNumber label="Transportation" value={s.expenses.transport} onChange={(v) => updateExpense("transport", v)} />
                  <FieldNumber label="Lifestyle" value={s.expenses.lifestyle} onChange={(v) => updateExpense("lifestyle", v)} />
                  <FieldNumber label="Healthcare" value={s.expenses.healthcare} onChange={(v) => updateExpense("healthcare", v)} />
                  <FieldNumber label="Insurance premiums" value={s.expenses.insurance_prem} onChange={(v) => updateExpense("insurance_prem", v)} />
                  <FieldNumber label="Education" value={s.expenses.education} onChange={(v) => updateExpense("education", v)} />
                  <FieldNumber label="Entertainment" value={s.expenses.entertainment} onChange={(v) => updateExpense("entertainment", v)} />
                  <FieldNumber label="Other" value={s.expenses.other} onChange={(v) => updateExpense("other", v)} />
                </Section>
                <div className="grid gap-2 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4">
                  <Metric label="Total income" value={`₹${totalIncome.toLocaleString("en-IN")}`} />
                  <Metric label="Total expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} />
                  <Metric label="Monthly savings" value={`₹${monthlySavings.toLocaleString("en-IN")}`} />
                  <Metric label="Savings rate" value={`${savingsRate.toFixed(1)}%`} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Section title="Assets (₹)">
                  <FieldNumber label="Bank balance" value={s.assets.bank} onChange={(v) => updateAsset("bank", v)} />
                  <FieldNumber label="Fixed deposits" value={s.assets.fd} onChange={(v) => updateAsset("fd", v)} />
                  <FieldNumber label="EPF" value={s.assets.epf} onChange={(v) => updateAsset("epf", v)} />
                  <FieldNumber label="PPF" value={s.assets.ppf} onChange={(v) => updateAsset("ppf", v)} />
                  <FieldNumber label="NPS" value={s.assets.nps} onChange={(v) => updateAsset("nps", v)} />
                  <FieldNumber label="Mutual funds" value={s.assets.mutual_funds} onChange={(v) => updateAsset("mutual_funds", v)} />
                  <FieldNumber label="Stocks" value={s.assets.stocks} onChange={(v) => updateAsset("stocks", v)} />
                  <FieldNumber label="Gold" value={s.assets.gold} onChange={(v) => updateAsset("gold", v)} />
                  <FieldNumber label="Crypto" value={s.assets.crypto} onChange={(v) => updateAsset("crypto", v)} />
                  <FieldNumber label="Real estate" value={s.assets.real_estate} onChange={(v) => updateAsset("real_estate", v)} />
                  <FieldNumber label="Other assets" value={s.assets.other} onChange={(v) => updateAsset("other", v)} />
                </Section>
                <Section title="Liabilities — outstanding (₹)">
                  <FieldNumber label="Home loan" value={s.liabilities.home_loan} onChange={(v) => updateLiability("home_loan", v)} />
                  <FieldNumber label="Car loan" value={s.liabilities.car_loan} onChange={(v) => updateLiability("car_loan", v)} />
                  <FieldNumber label="Personal loan" value={s.liabilities.personal_loan} onChange={(v) => updateLiability("personal_loan", v)} />
                  <FieldNumber label="Education loan" value={s.liabilities.education_loan} onChange={(v) => updateLiability("education_loan", v)} />
                  <FieldNumber label="Credit card outstanding" value={s.liabilities.credit_card} onChange={(v) => updateLiability("credit_card", v)} />
                  <FieldNumber label="Total monthly EMI" value={s.monthly_emi_total} onChange={(v) => set("monthly_emi_total", v)} />
                  <FieldNumber label="Remaining tenure (months)" value={s.loan_tenure_months} onChange={(v) => set("loan_tenure_months", v)} />
                </Section>
                <Section title="Investments (₹)">
                  <FieldNumber label="Monthly SIP" value={s.monthly_sip} onChange={(v) => set("monthly_sip", v)} />
                  <FieldNumber label="Annual investment" value={s.annual_investment} onChange={(v) => set("annual_investment", v)} />
                  <FieldNumber label="Existing portfolio" value={s.existing_portfolio} onChange={(v) => set("existing_portfolio", v)} />
                </Section>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <Section title="Insurance">
                  <InsuranceRow label="Health" enabled={s.has_health} onEnabled={(v) => set("has_health", v)} cover={s.health_cover} onCover={(v) => set("health_cover", v)} />
                  <InsuranceRow label="Term life" enabled={s.has_term} onEnabled={(v) => set("has_term", v)} cover={s.term_cover} onCover={(v) => set("term_cover", v)} />
                  <InsuranceRow label="Employer cover" enabled={s.has_employer} onEnabled={(v) => set("has_employer", v)} cover={s.employer_cover} onCover={(v) => set("employer_cover", v)} />
                  <InsuranceRow label="Critical illness" enabled={s.has_critical} onEnabled={(v) => set("has_critical", v)} cover={s.critical_cover} onCover={(v) => set("critical_cover", v)} />
                  <InsuranceRow label="Personal accident" enabled={s.has_pa} onEnabled={(v) => set("has_pa", v)} cover={s.pa_cover} onCover={(v) => set("pa_cover", v)} />
                </Section>
                <Section title="Retirement">
                  <FieldNumber label="Desired retirement age" value={s.retirement_age} onChange={(v) => set("retirement_age", v)} />
                  <FieldNumber label="Existing retirement corpus (₹)" value={s.retirement_corpus} onChange={(v) => set("retirement_corpus", v)} />
                  <FieldSelect label="Retirement lifestyle" value={s.retirement_lifestyle}
                    onChange={(v) => set("retirement_lifestyle", v as State["retirement_lifestyle"])}
                    options={["modest", "comfortable", "premium"]} />
                  <FieldSelect label="Risk profile" value={s.risk_profile}
                    onChange={(v) => set("risk_profile", v as State["risk_profile"])}
                    options={["conservative", "moderate", "aggressive"]} />
                </Section>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add every meaningful goal. Goals guide NitiPath™ and NitiSim™ — they do not affect your NitiScore™.
                </p>
                {s.goals.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                    No goals yet. Add your first one below.
                  </div>
                )}
                {s.goals.map((g, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal {i + 1}</p>
                      <button type="button" onClick={() => removeGoal(i)} className="text-muted-foreground hover:text-foreground">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FieldSelect label="Goal type" value={g.goal_type} onChange={(v) => updateGoal(i, { goal_type: v })}
                        options={["retirement", "house", "car", "education", "vacation", "wedding", "emergency", "other"]} />
                      <FieldText label="Goal name" value={g.name} onChange={(v) => updateGoal(i, { name: v })} />
                      <FieldNumber label="Target amount (₹)" value={g.target_amount} onChange={(v) => updateGoal(i, { target_amount: v })} />
                      <FieldNumber label="Target year" value={g.target_year} onChange={(v) => updateGoal(i, { target_year: v })} />
                      <FieldNumber label="Current savings (₹)" value={g.current_progress} onChange={(v) => updateGoal(i, { current_progress: v })} />
                      <FieldNumber label="Monthly contribution (₹)" value={g.monthly_contribution} onChange={(v) => updateGoal(i, { monthly_contribution: v })} />
                      <FieldSelect label="Priority" value={g.priority} onChange={(v) => updateGoal(i, { priority: v as GoalDraft["priority"] })}
                        options={["high", "medium", "low"]} />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addGoal}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <Plus className="h-4 w-4" /> Add goal
                </button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Review the summary below. Clicking <b>Finish</b> runs the NitiCore™ engine across your entire profile and takes you to your Dashboard.
                </p>
                <ReviewGrid>
                  <Metric label="Full name" value={s.full_name || "—"} />
                  <Metric label="City" value={s.city || "—"} />
                  <Metric label="Monthly income" value={`₹${totalIncome.toLocaleString("en-IN")}`} />
                  <Metric label="Monthly expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} />
                  <Metric label="Savings rate" value={`${savingsRate.toFixed(1)}%`} />
                  <Metric label="Total assets" value={`₹${sum(s.assets).toLocaleString("en-IN")}`} />
                  <Metric label="Total liabilities" value={`₹${sum(s.liabilities).toLocaleString("en-IN")}`} />
                  <Metric label="Monthly EMI" value={`₹${s.monthly_emi_total.toLocaleString("en-IN")}`} />
                  <Metric label="Monthly SIP" value={`₹${s.monthly_sip.toLocaleString("en-IN")}`} />
                  <Metric label="Term cover" value={s.has_term ? `₹${s.term_cover.toLocaleString("en-IN")}` : "None"} />
                  <Metric label="Health cover" value={s.has_health ? `₹${s.health_cover.toLocaleString("en-IN")}` : "None"} />
                  <Metric label="Goals" value={`${s.goals.length}`} />
                </ReviewGrid>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((v) => v + 1)}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Saving…" : isReturning ? "Save Changes" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* --------------------------- Field primitives --------------------------- */

function baseInput() {
  return "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function ReviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FieldNumber({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input type="number" min={0} className={baseInput()} value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}
function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input type="date" className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <select className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{o ? o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ") : "—"}</option>
        ))}
      </select>
    </label>
  );
}
function InsuranceRow({
  label, enabled, onEnabled, cover, onCover,
}: {
  label: string; enabled: boolean; onEnabled: (v: boolean) => void; cover: number; onCover: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />
        <span className="font-semibold text-foreground">{label}</span>
      </label>
      {enabled && (
        <input
          type="number" min={0} placeholder="Cover amount (₹)"
          className={`${baseInput()} mt-2`}
          value={cover || ""} onChange={(e) => onCover(Number(e.target.value) || 0)}
        />
      )}
    </div>
  );
}
