/**
 * NitiTax™ - server functions.
 *
 * Deterministic analysis (engine.ts) + persistence + ecosystem prefill.
 * Gemini is used only to explain the numbers; it never calculates tax.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAiChat } from "@/lib/ai-gateway";
import { analyzeTax } from "./engine";
import {
  emptyTaxInput, type EmploymentType, type TaxInput, type TaxRegime, type TaxReport,
} from "./types";

// ─────────────────────────── SCHEMA ───────────────────────────

const num = z.number().min(0).max(1e11);

const TaxInputShape = z.object({
  ageYears: z.number().min(18).max(100),
  employmentType: z.enum(["salaried", "self_employed", "business", "freelancer", "other"]),
  regimePreference: z.enum(["old", "new"]).nullish(),
  salary: z.object({
    basic: num, hra: num, specialAllowance: num, lta: num, bonus: num,
    professionalTax: num, employerNps: num, employerPf: num,
  }),
  otherIncome: z.object({
    interest: num, rental: num, dividend: num, business: num, other: num,
  }),
  capitalGains: z.object({
    ltcgEquity: num, stcgEquity: num, ltcgDebt: num, stcgDebt: num,
    ltcgProperty: num, otherGains: num,
  }),
  hra: z.object({
    cityType: z.enum(["metro", "non_metro"]),
    monthlyRentPaid: num,
    landlordPan: z.string().max(20).nullish(),
  }),
  d80c: z.object({
    epfEmployee: num, ppf: num, elss: num, lifeInsurancePremium: num,
    childTuition: num, homeLoanPrincipal: num, nsc: num, other80c: num,
  }),
  d80ccd: z.object({ employeeNps: num, additionalNps: num, employerNps: num }),
  d80d: z.object({
    selfFamilyPremium: num, parentsPremium: num,
    parentsSenior: z.boolean(), preventiveHealthCheck: num,
  }),
  otherDeductions: z.object({
    homeLoanInterestSelf: num, educationLoanInterest: num, charity80G: num,
    savingsInterest80TTA: num, seniorInterest80TTB: num, disability80U: num,
  }),
  cityMetro: z.boolean(),
});

const AnalyzeInput = z.object({
  name: z.string().min(1).max(120).default("Tax Review"),
  input: TaxInputShape,
  narrate: z.boolean().default(true),
  replaceId: z.string().uuid().optional(),
});

// ─────────────────────────── DB SHAPES ───────────────────────────

interface DbRow {
  id: string;
  name: string;
  tax_year: string;
  age_years: number;
  employment_type: string;
  recommended_regime: string;
  gross_income: string | number | null;
  total_tax: string | number | null;
  estimated_tax_saved: string | number | null;
  effective_rate_pct: string | number | null;
  input: unknown;
  report: unknown;
  last_reviewed_at: string;
  created_at: string;
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

type SB = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        maybeSingle?: () => Promise<{ data: Record<string, unknown> | null }>;
      } & Promise<{ data: Record<string, unknown>[] | null }>;
    };
  };
};

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

// ─────────────────────────── ECOSYSTEM PREFILL ───────────────────────────

export interface TaxPrefill {
  input: TaxInput;
  sources: string[];
  missing: string[];
}

export const getTaxPrefill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaxPrefill> => {
    const sb = context.supabase as unknown as SB;
    const [profileRes, fpRes, insRes, liabRes, invRes] = await Promise.all([
      sb.from("profiles").select("*").eq("id", context.userId).maybeSingle!(),
      sb.from("financial_profiles").select("*").eq("user_id", context.userId).maybeSingle!(),
      sb.from("insurance").select("*").eq("user_id", context.userId),
      sb.from("liabilities").select("*").eq("user_id", context.userId),
      sb.from("investments").select("*").eq("user_id", context.userId),
    ]);

    const profile = profileRes.data as Record<string, unknown> | null;
    const fp = fpRes.data as Record<string, unknown> | null;
    const insurance = (insRes.data ?? []) as Record<string, unknown>[];
    const liabs = (liabRes.data ?? []) as Record<string, unknown>[];
    const investments = (invRes.data ?? []) as Record<string, unknown>[];

    const input = emptyTaxInput();
    const sources: string[] = [];
    const missing: string[] = [];

    input.ageYears = ageFromDob((profile?.date_of_birth as string | undefined) ?? null);
    if (profile?.date_of_birth) sources.push("Age from your profile");

    const empType = String(fp?.employment_type ?? "salaried");
    input.employmentType = (["salaried", "self_employed", "business", "freelancer", "other"].includes(empType)
      ? empType
      : "salaried") as EmploymentType;

    const annual = Number(fp?.annual_income ?? 0) || Number(fp?.monthly_income ?? 0) * 12;
    if (annual > 0) {
      // Conventional Indian CTC split - user can override every field.
      input.salary.basic = Math.round(annual * 0.40);
      input.salary.hra = Math.round(annual * 0.20);
      input.salary.specialAllowance = Math.round(annual * 0.35);
      input.salary.lta = Math.round(annual * 0.05);
      sources.push("Salary structure estimated from your annual income");
    } else {
      missing.push("Annual salary structure");
    }

    // EPF employee share ≈ 12% of basic (statutory).
    if (input.salary.basic > 0) {
      input.d80c.epfEmployee = Math.round(input.salary.basic * 0.12);
      sources.push("EPF contribution estimated at 12% of basic");
    }

    // Health + life premiums from the insurance module.
    const healthPremium = insurance
      .filter((i) => ["health", "family_floater"].includes(String(i.insurance_type)))
      .reduce((a, b) => a + Number(b.annual_premium ?? 0), 0);
    const lifePremium = insurance
      .filter((i) => ["term", "life", "endowment", "ulip"].includes(String(i.insurance_type)))
      .reduce((a, b) => a + Number(b.annual_premium ?? 0), 0);
    if (healthPremium > 0) {
      input.d80d.selfFamilyPremium = Math.round(healthPremium);
      sources.push("Health premium from your Insurance module");
    } else {
      missing.push("Health insurance premium");
    }
    if (lifePremium > 0) {
      input.d80c.lifeInsurancePremium = Math.round(lifePremium);
      sources.push("Life premium from your Insurance module");
    }

    // Home loan → principal (80C) and interest (24b), from the liabilities module.
    const homeLoans = liabs.filter((l) => String(l.category) === "home");
    if (homeLoans.length > 0) {
      const outstanding = homeLoans.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
      const annualEmi = homeLoans.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0) * 12;
      const rate = Number(homeLoans[0].interest_rate ?? 8.5) / 100;
      const interest = Math.min(Math.round(outstanding * rate), annualEmi);
      input.otherDeductions.homeLoanInterestSelf = Math.max(0, interest);
      input.d80c.homeLoanPrincipal = Math.max(0, Math.round(annualEmi - interest));
      sources.push("Home-loan interest and principal from your Liabilities module");
    }

    // Education loan interest (80E).
    const eduLoans = liabs.filter((l) => String(l.category) === "education");
    if (eduLoans.length > 0) {
      const outstanding = eduLoans.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
      const rate = Number(eduLoans[0].interest_rate ?? 10) / 100;
      input.otherDeductions.educationLoanInterest = Math.round(outstanding * rate);
      sources.push("Education-loan interest from your Liabilities module");
    }

    // ELSS / NPS from the investments module.
    const elss = investments
      .filter((i) => String(i.investment_type).toLowerCase().includes("elss"))
      .reduce((a, b) => a + Number(b.monthly_contribution ?? 0) * 12, 0);
    if (elss > 0) {
      input.d80c.elss = Math.round(elss);
      sources.push("ELSS contribution from your Investments module");
    }
    const nps = investments
      .filter((i) => String(i.investment_type).toLowerCase().includes("nps"))
      .reduce((a, b) => a + Number(b.monthly_contribution ?? 0) * 12, 0);
    if (nps > 0) {
      input.d80ccd.additionalNps = Math.min(50000, Math.round(nps));
      sources.push("NPS contribution from your Investments module");
    }

    missing.push("Rent paid, capital gains and interest income");

    return { input, sources, missing };
  });

// ─────────────────────────── ANALYZE ───────────────────────────

export const analyzeTaxServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AnalyzeInput.parse(v))
  .handler(async ({ data, context }): Promise<{ report: TaxReport; analysisId: string | null }> => {
    const { supabase, userId } = context;
    const input: TaxInput = {
      ...data.input,
      regimePreference: (data.input.regimePreference ?? null) as TaxRegime | null,
      hra: { ...data.input.hra, landlordPan: data.input.hra.landlordPan ?? null },
    };
    const report = analyzeTax(input);

    if (data.narrate) {
      const narrative = await narrateTax(report, input);
      if (narrative) report.narrative = narrative;
    }

    const row = {
      user_id: userId,
      name: data.name,
      tax_year: report.taxYear,
      age_years: report.ageYears,
      employment_type: report.employmentType,
      recommended_regime: report.recommendedRegime,
      gross_income: report.grossIncome,
      total_tax: report.totalTaxPayable,
      estimated_tax_saved: report.estimatedTaxSaved,
      effective_rate_pct: report.effectiveRatePct,
      input,
      report,
      last_reviewed_at: new Date().toISOString(),
    };

    const client = supabase as unknown as DbClient;
    let analysisId: string | null = null;
    if (data.replaceId) {
      const { data: updated, error } = await client.from("tax_analyses").update(row)
        .eq("id", data.replaceId).eq("user_id", userId).select("id").single();
      if (error) throw new Error(`Tax analysis could not be saved: ${String(error.message ?? "update failed")}`);
      analysisId = updated?.id ?? null;
    } else {
      const { data: inserted, error } = await client.from("tax_analyses").insert(row).select("id").single();
      if (error) throw new Error(`Tax analysis could not be saved: ${String(error.message ?? "insert failed")}`);
      analysisId = inserted?.id ?? null;
    }
    if (!analysisId) throw new Error("Tax analysis could not be saved: no id returned.");
    return { report, analysisId };
  });

async function narrateTax(report: TaxReport, input: TaxInput): Promise<string | null> {
  const payload = {
    taxYear: report.taxYear,
    age: report.ageYears,
    employment: report.employmentType,
    recommendedRegime: report.recommendedRegime,
    regimeDelta: report.regimeDeltaTax,
    effectiveRate: report.effectiveRatePct,
    marginalRate: report.marginalRatePct,
    remainingCapacity: report.remainingDeductionCapacity,
    deductions: report.deductions.map((d) => ({ section: d.section, used: d.used, remaining: d.remaining })),
    opportunities: report.opportunities.map((o) => ({ section: o.section, title: o.title, saving: o.estimatedTaxSaving })),
    strategies: report.strategies.map((s) => ({ name: s.name, saving: s.estimatedAnnualSaving, recommended: s.isRecommended })),
    findings: report.findings.map((f) => f.title),
    hasCapitalGains: input.capitalGains.ltcgEquity + input.capitalGains.stcgEquity > 0,
    paysRent: input.hra.monthlyRentPaid > 0,
    context: report.contextSummary,
  };

  const system = `You are NitiGuide - an experienced Indian tax-aware CFP sitting across from a real client, reviewing their tax position for the year.

Rules:
- NEVER calculate or restate rupee figures, percentages or slab rates. Every number is already on screen.
- Never recommend a specific insurer, fund house, broker or bank.
- No bullets, no headings, no em dashes, no AI-summariser tone.
- Speak plainly. Explain the reasoning, not the arithmetic.

Write five short paragraphs, two to three sentences each, in this order:
1. Why the recommended regime wins for this person's specific situation, in concept terms - what kind of taxpayer that regime suits and what would have to change for the answer to flip.
2. The trade-off they are actually accepting by choosing it, and what to re-check next year.
3. The single most valuable deduction opportunity still open to them, explained as a financial decision rather than a tax trick, including the lock-in or behaviour it demands.
4. What to understand about capital gains and investment timing in their case, or if they have none, about how salary structuring and income mix affect tax over a career.
5. How to plan tax through the year instead of in March, and what order to do things in.

Warm, senior, unhurried. This should read like a private tax consultation, not a calculator printout.`;

  const res = await callAiChat({
    temperature: 0.45,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Deterministic tax findings JSON:\n${JSON.stringify(payload, null, 2)}` },
    ],
  });
  return res?.text ?? null;
}

// ─────────────────────────── QUESTIONS ───────────────────────────

const AskInput = z.object({
  question: z.string().min(3).max(600),
  report: z.custom<TaxReport>(),
});

export const askTaxQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AskInput.parse(v))
  .handler(async ({ data }): Promise<{ answer: string | null }> => {
    const r = data.report;
    const facts = {
      taxYear: r.taxYear,
      recommendedRegime: r.recommendedRegime,
      totalTaxPayable: r.totalTaxPayable,
      effectiveRate: r.effectiveRatePct,
      marginalRate: r.marginalRatePct,
      oldRegimeTax: r.old?.totalTax,
      newRegimeTax: r.new?.totalTax,
      deductions: r.deductions,
      opportunities: r.opportunities,
    };
    const res = await callAiChat({
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `You are NitiGuide, an Indian tax-aware CFP. Answer the client's "what if" question in three short paragraphs at most.

You may reason about consequences, sequencing and trade-offs. You may NOT invent new tax computations beyond the deterministic facts supplied - if a precise number is needed, say what it depends on and tell them to re-run the analysis with the changed inputs. No bullets, no headings, no em dashes. Never recommend specific products or providers.`,
        },
        {
          role: "user",
          content: `Deterministic tax facts:\n${JSON.stringify(facts, null, 2)}\n\nClient question: ${data.question}`,
        },
      ],
    });
    return { answer: res?.text ?? null };
  });

// ─────────────────────────── LIST / GET / DELETE ───────────────────────────

export interface TaxListItem {
  id: string;
  name: string;
  taxYear: string;
  recommendedRegime: TaxRegime;
  grossIncome: number;
  totalTax: number;
  estimatedTaxSaved: number;
  effectiveRatePct: number;
  lastReviewedAt: string;
  createdAt: string;
}

export const listTaxAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ analyses: TaxListItem[] }> => {
    const client = context.supabase as unknown as DbClient;
    const { data, error } = await client.from("tax_analyses")
      .select("id, name, tax_year, recommended_regime, gross_income, total_tax, estimated_tax_saved, effective_rate_pct, last_reviewed_at, created_at")
      .eq("user_id", context.userId).order!("last_reviewed_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return {
      analyses: (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        taxYear: r.tax_year,
        recommendedRegime: (r.recommended_regime as TaxRegime) ?? "new",
        grossIncome: Number(r.gross_income ?? 0),
        totalTax: Number(r.total_tax ?? 0),
        estimatedTaxSaved: Number(r.estimated_tax_saved ?? 0),
        effectiveRatePct: Number(r.effective_rate_pct ?? 0),
        lastReviewedAt: r.last_reviewed_at,
        createdAt: r.created_at,
      })),
    };
  });

const IdInput = z.object({ id: z.string().uuid() });

export interface TaxDetail {
  id: string;
  name: string;
  input: TaxInput;
  report: TaxReport;
  lastReviewedAt: string;
}

export const getTaxAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }): Promise<{ analysis: TaxDetail | null }> => {
    const client = context.supabase as unknown as DbClient;
    const { data: row, error } = await client.from("tax_analyses")
      .select("*").eq("id", data.id).eq!("user_id", context.userId).maybeSingle!();
    if (error) throw new Error(error.message);
    if (!row) return { analysis: null };
    return {
      analysis: {
        id: row.id,
        name: row.name,
        input: row.input as TaxInput,
        report: row.report as TaxReport,
        lastReviewedAt: row.last_reviewed_at,
      },
    };
  });

export const deleteTaxAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const client = context.supabase as unknown as DbClient;
    const { error } = await client.from("tax_analyses").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface TaxSummary {
  analysisCount: number;
  latestTaxPayable: number;
  latestRegime: TaxRegime | null;
  latestEffectiveRate: number;
  latestReviewedAt: string | null;
  unusedCapacity: number;
}

export const getTaxSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ summary: TaxSummary }> => {
    const client = context.supabase as unknown as DbClient;
    const { data } = await client.from("tax_analyses")
      .select("recommended_regime, total_tax, effective_rate_pct, report, last_reviewed_at")
      .eq("user_id", context.userId).order!("last_reviewed_at", { ascending: false }).limit(20);
    const rows = data ?? [];
    const latest = rows[0];
    const report = latest?.report as TaxReport | undefined;
    return {
      summary: {
        analysisCount: rows.length,
        latestTaxPayable: Number(latest?.total_tax ?? 0),
        latestRegime: (latest?.recommended_regime as TaxRegime | undefined) ?? null,
        latestEffectiveRate: Number(latest?.effective_rate_pct ?? 0),
        latestReviewedAt: latest?.last_reviewed_at ?? null,
        unusedCapacity: report?.remainingDeductionCapacity ?? 0,
      },
    };
  });
