/**
 * NitiLoan™ — server functions.
 *
 * Deterministic analysis (via engine) + persistence. Optional NitiGuide
 * narration is layered on top; the numbers themselves are always
 * engine-produced.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAiChat } from "@/lib/ai-gateway";
import { evaluateContext, type NitiCoreInput } from "@/lib/niti-core";
import { analyzeLoan } from "./engine";
import type { LoanInput, LoanReport, LoanCategory } from "./types";

const LOAN_CATEGORIES: LoanCategory[] = [
  "home", "vehicle", "education", "personal", "credit_card",
  "business", "gold", "consumer_finance", "other",
];

const LoanShape = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(LOAN_CATEGORIES as [LoanCategory, ...LoanCategory[]]),
  lender: z.string().max(120).nullish(),
  principal: z.number().min(0),
  outstanding: z.number().min(0),
  interestRate: z.number().min(0).max(60),
  tenureMonths: z.number().min(0).max(600),
  remainingMonths: z.number().min(0).max(600).nullish(),
  monthlyEmi: z.number().min(0),
  annualPrepayment: z.number().min(0).optional().default(0),
  taxDeductible: z.boolean().optional().default(false),
});

const AnalyzeInput = z.object({
  loan: LoanShape,
  narrate: z.boolean().default(true),
  replaceId: z.string().uuid().optional(),
});

interface DbRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  lender: string | null;
  principal: string | number | null;
  outstanding: string | number | null;
  interest_rate: string | number | null;
  tenure_months: number | null;
  remaining_months: number | null;
  monthly_emi: string | number | null;
  annual_prepayment: string | number | null;
  tax_deductible: boolean | null;
  loan_health_score: number;
  report: unknown;
  last_reviewed_at: string;
  created_at: string;
  updated_at: string;
}

type DbClient = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: DbRow | null; error: { message?: string } | null }> } };
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (c: string) => { single: () => Promise<{ data: DbRow | null; error: { message?: string } | null }> } } } };
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq?: (c: string, v: string) => { maybeSingle: () => Promise<{ data: DbRow | null; error: { message: string } | null }> };
        order?: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: DbRow[] | null; error: { message: string } | null }> };
      };
    };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
  };
};

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

async function buildNitiInput(context: { supabase: unknown; userId: string }): Promise<NitiCoreInput> {
  type SB = {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          maybeSingle?: () => Promise<{ data: Record<string, unknown> | null }>;
        } & Promise<{ data: Record<string, unknown>[] | null }>;
      };
    };
  };
  const sb = context.supabase as SB;
  const [profileRes, fpRes, assetsRes, liabsRes, insRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", context.userId).maybeSingle!(),
    sb.from("financial_profiles").select("*").eq("user_id", context.userId).maybeSingle!(),
    sb.from("assets").select("*").eq("user_id", context.userId),
    sb.from("liabilities").select("*").eq("user_id", context.userId),
    sb.from("insurance").select("*").eq("user_id", context.userId),
  ]);
  const profile = profileRes.data as Record<string, unknown> | null;
  const fp = fpRes.data as Record<string, unknown> | null;
  const assets = (assetsRes.data ?? []) as Record<string, unknown>[];
  const liabs = (liabsRes.data ?? []) as Record<string, unknown>[];
  const insurance = (insRes.data ?? []) as Record<string, unknown>[];

  const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
  const termCover = insurance.filter((i) => i.insurance_type === "term").reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

  return {
    ageYears: ageFromDob((profile?.date_of_birth as string | undefined) ?? null),
    monthlyIncome: Number(fp?.monthly_income ?? 0),
    monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
    monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? fp?.monthly_expenses ?? 0),
    liquidAssets, totalAssets, totalLiabilities, monthlyEmi,
    monthlyInvestments: Number(fp?.monthly_sip ?? 0),
    totalInvestments: Number(fp?.existing_portfolio ?? 0),
    hasTermInsurance: termCover > 0,
    hasHealthInsurance: insurance.some((i) => ["health", "family_floater"].includes(String(i.insurance_type))),
    termCover,
    retirementCorpus: 0,
    retirementAge: Number(fp?.retirement_age ?? 60),
    employmentType: (fp?.employment_type as "salaried" | "self_employed" | null) ?? undefined,
    riskProfile: (fp?.risk_profile as "conservative" | "moderate" | "aggressive" | null) ?? undefined,
    dependentsCount: (profile?.dependents as number | undefined) ?? undefined,
  };
}

export const analyzeLoanServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ report: LoanReport; analysisId: string | null }> => {
    const { supabase, userId } = context;
    const nitiInput = await buildNitiInput({ supabase, userId });
    const ctx = evaluateContext(nitiInput);
    const loan: LoanInput = {
      ...data.loan,
      lender: data.loan.lender ?? null,
      remainingMonths: data.loan.remainingMonths ?? null,
      annualPrepayment: data.loan.annualPrepayment ?? 0,
      taxDeductible: data.loan.taxDeductible ?? false,
    };
    const report = analyzeLoan({ loan, input: nitiInput, context: ctx });

    if (data.narrate) {
      const mentor = await narrateLoan(report, loan);
      if (mentor) report.mentorSummary = mentor;
    }

    const row = {
      user_id: userId,
      name: loan.name,
      category: loan.category,
      lender: loan.lender,
      principal: loan.principal,
      outstanding: loan.outstanding,
      interest_rate: loan.interestRate,
      tenure_months: loan.tenureMonths,
      remaining_months: loan.remainingMonths,
      monthly_emi: loan.monthlyEmi,
      annual_prepayment: loan.annualPrepayment ?? 0,
      tax_deductible: loan.taxDeductible ?? false,
      loan_health_score: report.loanHealthScore,
      report,
      last_reviewed_at: new Date().toISOString(),
    };
    const client = supabase as unknown as DbClient;
    let analysisId: string | null = null;
    if (data.replaceId) {
      const { data: updated, error } = await client.from("loan_analyses").update(row)
        .eq("id", data.replaceId).eq("user_id", userId).select("id").single();
      if (error) throw new Error(`Loan analysis could not be saved: ${String(error.message ?? "update failed")}`);
      analysisId = updated?.id ?? null;
    } else {
      const { data: inserted, error } = await client.from("loan_analyses").insert(row).select("id").single();
      if (error) throw new Error(`Loan analysis could not be saved: ${String(error.message ?? "insert failed")}`);
      analysisId = inserted?.id ?? null;
    }
    if (!analysisId) throw new Error("Loan analysis could not be saved: no id returned.");
    return { report, analysisId };
  });

async function narrateLoan(report: LoanReport, loan: LoanInput): Promise<string | null> {
  const payload = {
    loanName: loan.name,
    category: loan.category,
    healthScore: report.loanHealthScore,
    scoreLabel: report.scoreLabel,
    debtQuality: report.debtQuality,
    prepaymentVerdict: report.prepayment.verdict,
    prepaymentHeadline: report.prepayment.headline,
    debtFreedomAgeToday: report.debtFreedomAgeToday,
    strategies: report.strategies.map((s) => ({ name: s.name, monthsSaved: s.monthsSavedVsCurrent, interestSaved: s.interestSavedVsCurrent, recommended: s.isRecommended })),
    risks: report.risks.map((r) => r.title),
    strengths: report.strengths.map((r) => r.title),
    context: report.contextSummary,
  };
  const system = `You are NitiGuide — an experienced Indian CFP sitting across from a real client discussing ONE of their loans.

Do NOT restate percentages, EMI values or interest savings already shown on the report. Do NOT recommend specific banks or refinance offers. Do NOT predict returns. No bullets, headings, em dashes, or AI-summariser tone.

Write 4 short paragraphs, 2-3 sentences each, in this order:
1. Frame what kind of debt this is — healthy, neutral or poor — and what that means for their long-term wealth. Educational tone.
2. Explain the concept behind the prepay-vs-invest verdict in plain language (opportunity cost, risk-adjusted returns) — teach, do not compute.
3. The single most important behavioural point for this loan: buffer first, EMI discipline, avoiding refinance traps, or not being emotionally attached to being "debt-free" too early.
4. What order the recommended actions should happen in, and what can safely wait.

Warm mentor, never a machine. This should read like a premium wealth-review conversation.`;

  const res = await callAiChat({
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Loan findings JSON:\n${JSON.stringify(payload, null, 2)}` },
    ],
  });
  return res?.text ?? null;
}

// ─────────────────────────── LIST / GET / DELETE / SUMMARY ──────────

export interface LoanListItem {
  id: string;
  name: string;
  category: LoanCategory;
  lender: string | null;
  outstanding: number;
  monthlyEmi: number;
  interestRate: number;
  loanHealthScore: number;
  lastReviewedAt: string;
  createdAt: string;
}

export const listLoanAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ analyses: LoanListItem[] }> => {
    const client = context.supabase as unknown as DbClient;
    const { data, error } = await client.from("loan_analyses")
      .select("id, name, category, lender, outstanding, monthly_emi, interest_rate, loan_health_score, last_reviewed_at, created_at")
      .eq("user_id", context.userId).order!("last_reviewed_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return {
      analyses: (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category as LoanCategory,
        lender: r.lender,
        outstanding: Number(r.outstanding ?? 0),
        monthlyEmi: Number(r.monthly_emi ?? 0),
        interestRate: Number(r.interest_rate ?? 0),
        loanHealthScore: r.loan_health_score,
        lastReviewedAt: r.last_reviewed_at,
        createdAt: r.created_at,
      })),
    };
  });

const IdInput = z.object({ id: z.string().uuid() });

export interface LoanDetail {
  id: string;
  name: string;
  category: LoanCategory;
  lender: string | null;
  loan: LoanInput;
  report: LoanReport;
  loanHealthScore: number;
  lastReviewedAt: string;
}

export const getLoanAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }): Promise<{ analysis: LoanDetail | null }> => {
    const client = context.supabase as unknown as DbClient;
    const { data: row, error } = await client.from("loan_analyses")
      .select("*").eq("id", data.id).eq!("user_id", context.userId).maybeSingle!();
    if (error) throw new Error(error.message);
    if (!row) return { analysis: null };
    const loan: LoanInput = {
      id: row.id,
      name: row.name,
      category: row.category as LoanCategory,
      lender: row.lender,
      principal: Number(row.principal ?? 0),
      outstanding: Number(row.outstanding ?? 0),
      interestRate: Number(row.interest_rate ?? 0),
      tenureMonths: row.tenure_months ?? 0,
      remainingMonths: row.remaining_months ?? null,
      monthlyEmi: Number(row.monthly_emi ?? 0),
      annualPrepayment: Number(row.annual_prepayment ?? 0),
      taxDeductible: Boolean(row.tax_deductible),
    };
    return {
      analysis: {
        id: row.id,
        name: row.name,
        category: row.category as LoanCategory,
        lender: row.lender,
        loan,
        report: row.report as LoanReport,
        loanHealthScore: row.loan_health_score,
        lastReviewedAt: row.last_reviewed_at,
      },
    };
  });

export const deleteLoanAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const client = context.supabase as unknown as DbClient;
    const { error } = await client.from("loan_analyses").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface LoanPortfolioSummary {
  loanCount: number;
  totalOutstanding: number;
  totalMonthlyEmi: number;
  averageHealthScore: number;
  weightedInterestRate: number;
  latestReviewedAt: string | null;
  poorDebtCount: number;
}

export const getLoanPortfolioSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ summary: LoanPortfolioSummary }> => {
    const client = context.supabase as unknown as DbClient;
    const { data } = await client.from("loan_analyses")
      .select("outstanding, monthly_emi, interest_rate, loan_health_score, category, last_reviewed_at")
      .eq("user_id", context.userId).order!("last_reviewed_at", { ascending: false }).limit(100);
    const rows = data ?? [];
    const totalOutstanding = rows.reduce((a, r) => a + Number(r.outstanding ?? 0), 0);
    const totalMonthlyEmi = rows.reduce((a, r) => a + Number(r.monthly_emi ?? 0), 0);
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.loan_health_score, 0) / rows.length) : 0;
    const weightedRate = totalOutstanding > 0
      ? Math.round((rows.reduce((a, r) => a + Number(r.interest_rate ?? 0) * Number(r.outstanding ?? 0), 0) / totalOutstanding) * 100) / 100
      : 0;
    const poorDebtCount = rows.filter((r) =>
      r.category === "credit_card" || r.category === "personal" || r.category === "consumer_finance",
    ).length;
    return {
      summary: {
        loanCount: rows.length,
        totalOutstanding,
        totalMonthlyEmi,
        averageHealthScore: avg,
        weightedInterestRate: weightedRate,
        latestReviewedAt: rows[0]?.last_reviewed_at ?? null,
        poorDebtCount,
      },
    };
  });
