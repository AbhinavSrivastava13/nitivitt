/**
 * Financial Advisor — server functions.
 *
 * Contract:
 *   client → auth-gated server fn → NitiCore™ briefing built from the user's
 *   own rows (RLS) → persisted with the request → ops notification.
 *
 * Payment is deliberately behind a thin seam (`resolvePayment`) so a provider
 * can be wired in later without touching the request flow.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  calculateNitiScore,
  calculateNitiAge,
  calculateEmergencyFund,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateRetirement,
  calculateInsuranceAdequacy,
  calculateNetWorth,
  generateRecommendationsWithContext,
  describeContext,
  type NitiCoreInput,
} from "@/lib/niti-core";
import { derivePortfolioRating } from "@/lib/ratings";
import { ADVISOR_TOPICS, packageById, slotLabel } from "./types";
import type {
  AdvisorBriefing,
  AdvisorPaymentStatus,
  AdvisorPreferredSlot,
  AdvisorRequestListItem,
  AdvisorRequestStatus,
  AdvisorTopicId,
} from "./types";

const TOPIC_IDS = ADVISOR_TOPICS.map((t) => t.id) as [AdvisorTopicId, ...AdvisorTopicId[]];

const SlotShape = z.object({
  date: z.string().min(8).max(10),
  window: z.enum(["morning", "afternoon", "evening", "late_evening"]),
});

const DocShape = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  size: z.number().min(0).max(25 * 1024 * 1024),
  type: z.string().max(120),
});

const SubmitInput = z.object({
  topics: z.array(z.enum(TOPIC_IDS)).min(1).max(6),
  summary: z.string().trim().min(20).max(3000),
  documents: z.array(DocShape).max(10).default([]),
  preferredSlots: z.array(SlotShape).min(1).max(3),
  timezone: z.string().max(60).default("Asia/Kolkata"),
  contactPhone: z.string().trim().max(20).optional(),
  packageId: z.enum(["quick", "tax_filing", "comprehensive"]),
});

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function makeReference(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 6; i += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const y = new Date().getFullYear().toString().slice(-2);
  return `NV-${y}-${tail}`;
}

/**
 * Payment seam. V1 has no provider connected, so every request is created
 * with `pending` and the confirmation screen tells the user what happens next.
 * When a provider is enabled this is the only function that changes.
 */
function resolvePayment(): { status: AdvisorPaymentStatus; provider: string | null; reference: string | null } {
  return { status: "pending", provider: null, reference: null };
}

type BriefingSources = Awaited<ReturnType<typeof loadSources>>;

async function loadSources(supabase: ReturnType<typeof Object> extends never ? never : any, userId: string) {
  const [profileRes, fpRes, assetsRes, liabsRes, insRes, goalsRes, insA, portA, loanA, taxA] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("assets").select("*").eq("user_id", userId),
    supabase.from("liabilities").select("*").eq("user_id", userId),
    supabase.from("insurance").select("*").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("insurance_analyses").select("protection_score").eq("user_id", userId),
    supabase.from("portfolio_analyses").select("portfolio_score, total_value").eq("user_id", userId),
    supabase.from("loan_analyses").select("outstanding").eq("user_id", userId),
    supabase
      .from("tax_analyses")
      .select("recommended_regime, total_tax, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  return {
    profile: profileRes.data,
    fp: fpRes.data,
    assets: assetsRes.data ?? [],
    liabs: liabsRes.data ?? [],
    insurance: insRes.data ?? [],
    goals: goalsRes.data ?? [],
    insAnalyses: (insA.data ?? []) as { protection_score: number }[],
    portAnalyses: (portA.data ?? []) as { portfolio_score: number; total_value: number | string | null }[],
    loanAnalyses: (loanA.data ?? []) as { outstanding: number | string | null }[],
    taxAnalysis: ((taxA.data ?? [])[0] ?? null) as { recommended_regime: string; total_tax: number | string } | null,
  };
}

function buildBriefing(src: BriefingSources): AdvisorBriefing {
  const { profile, fp, assets, liabs, insurance, goals } = src;

  const totalAssets = assets.reduce((a: number, b: any) => a + Number(b.current_value ?? 0), 0);
  const liquidAssets = assets
    .filter((a: any) => a.is_liquid)
    .reduce((a: number, b: any) => a + Number(b.current_value ?? 0), 0);
  const totalLiabilities = liabs.reduce((a: number, b: any) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a: number, b: any) => a + Number(b.monthly_emi ?? 0), 0);
  const termCover = insurance
    .filter((i: any) => i.insurance_type === "term")
    .reduce((a: number, b: any) => a + Number(b.cover_amount ?? 0), 0);

  const avgProtection = src.insAnalyses.length
    ? Math.round(src.insAnalyses.reduce((a, b) => a + Number(b.protection_score ?? 0), 0) / src.insAnalyses.length)
    : null;
  const avgPortfolio = src.portAnalyses.length
    ? Math.round(src.portAnalyses.reduce((a, b) => a + Number(b.portfolio_score ?? 0), 0) / src.portAnalyses.length)
    : null;
  const portfolioValue = src.portAnalyses.reduce((a, b) => a + Number(b.total_value ?? 0), 0);
  const loanOutstanding = src.loanAnalyses.reduce((a, b) => a + Number(b.outstanding ?? 0), 0);

  const input: NitiCoreInput = {
    ageYears: ageFromDob(profile?.date_of_birth ?? null),
    monthlyIncome: Number(fp?.monthly_income ?? 0),
    monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
    monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
    liquidAssets,
    totalAssets,
    totalLiabilities,
    monthlyEmi,
    monthlyInvestments: Number(fp?.monthly_sip ?? 0),
    totalInvestments: Number(fp?.existing_portfolio ?? 0) || portfolioValue,
    hasTermInsurance: insurance.some((i: any) => i.insurance_type === "term"),
    hasHealthInsurance: insurance.some((i: any) => i.insurance_type === "health"),
    termCover,
    retirementCorpus: 0,
    retirementAge: Number(fp?.retirement_age ?? 60),
    riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
    crossService: {
      insurancePolicyCount: src.insAnalyses.length,
      insuranceProtectionScore: avgProtection ?? undefined,
      portfolioHoldingCount: src.portAnalyses.length,
      portfolioScore: avgPortfolio ?? undefined,
      portfolioTotalValue: portfolioValue,
    },
  };

  const score = calculateNitiScore(input);
  const age = calculateNitiAge(input);
  const emergency = calculateEmergencyFund(input);
  const savings = calculateSavingsRate(input);
  const debt = calculateDebtRatio(input);
  const retirement = calculateRetirement(input);
  const insAdequacy = calculateInsuranceAdequacy(input);
  const netWorth = calculateNetWorth(input);
  const { context: ctx, recommendations } = generateRecommendationsWithContext(input);

  const agePayload = (age.aiPayload ?? {}) as { direction?: string };

  return {
    generatedAt: new Date().toISOString(),
    client: {
      firstName: profile?.full_name?.split(" ")[0] ?? "Client",
      ageYears: input.ageYears,
      city: profile?.city ?? null,
      occupation: profile?.occupation ?? null,
      maritalStatus: profile?.marital_status ?? null,
      dependents: Number(profile?.dependents ?? 0),
    },
    metrics: {
      nitiScore: Math.round(Number(score.value)),
      nitiScoreGrade: String(score.grade ?? ""),
      nitiAge: Math.round(Number(age.value)),
      nitiAgeDirection: agePayload.direction ?? "on_track",
      netWorth: Math.round(Number(netWorth.value)),
      monthlyIncome: input.monthlyIncome,
      monthlyExpenses: input.monthlyExpenses,
      savingsRatePct: Math.round(Number(savings.value)),
      emergencyMonths: Math.round(Number(emergency.value) * 10) / 10,
      debtRatioPct: Math.round(Number(debt.value)),
      insuranceAdequacyPct: Math.round(Number(insAdequacy.value)),
      retirementStatus: String(retirement.status),
    },
    analyzers: {
      nitiSurePolicies: src.insAnalyses.length,
      nitiSureAvgScore: avgProtection,
      nitiInvestPortfolios: src.portAnalyses.length,
      nitiInvestValue: Math.round(portfolioValue),
      nitiInvestRating: avgPortfolio === null ? null : derivePortfolioRating(avgPortfolio).label,
      nitiLoanCount: src.loanAnalyses.length,
      nitiLoanOutstanding: Math.round(loanOutstanding),
      nitiTaxRegime: src.taxAnalysis?.recommended_regime ?? null,
      nitiTaxTotal: src.taxAnalysis ? Math.round(Number(src.taxAnalysis.total_tax ?? 0)) : null,
    },
    context: {
      lifeStage: ctx.lifeStage,
      wealthStage: ctx.wealthStage,
      protectionPosture: ctx.protectionPosture,
      liquidityHealth: ctx.liquidityHealth,
      summary: describeContext(ctx),
    },
    topActions: recommendations.slice(0, 5).map((r) => ({
      title: r.title,
      priority: String(r.priority),
      nextAction: r.nextAction ?? "",
    })),
    goals: goals.slice(0, 6).map((g: any) => ({
      name: g.name,
      target: Number(g.target_amount ?? 0),
      progress: Number(g.current_progress ?? 0),
      targetDate: g.target_date ?? null,
    })),
  };
}

interface DbRow {
  id: string;
  reference_id: string;
  topics: string[];
  summary: string;
  documents: unknown;
  preferred_slots: unknown;
  package_id: string;
  package_name: string;
  amount_inr: number | string;
  payment_status: string;
  status: string;
  briefing: unknown;
  created_at: string;
}

function toListItem(row: DbRow): AdvisorRequestListItem {
  return {
    id: row.id,
    referenceId: row.reference_id,
    topics: (row.topics ?? []) as AdvisorTopicId[],
    packageId: row.package_id,
    packageName: row.package_name,
    amountInr: Number(row.amount_inr ?? 0),
    paymentStatus: row.payment_status as AdvisorPaymentStatus,
    status: row.status as AdvisorRequestStatus,
    preferredSlots: (row.preferred_slots ?? []) as AdvisorPreferredSlot[],
    createdAt: row.created_at,
  };
}

export const submitAdvisorRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const pkg = packageById(data.packageId);
    if (!pkg) throw new Error("Unknown package");

    const sources = await loadSources(supabase, userId);
    const briefing = buildBriefing(sources);
    const payment = resolvePayment();

    let referenceId = makeReference();
    let inserted: DbRow | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      const { data: row, error } = await supabase
        .from("advisor_requests")
        .insert({
          user_id: userId,
          reference_id: referenceId,
          topics: data.topics,
          summary: data.summary,
          documents: data.documents,
          preferred_slots: data.preferredSlots,
          timezone: data.timezone,
          contact_phone: data.contactPhone ?? null,
          package_id: pkg.id,
          package_name: pkg.name,
          amount_inr: pkg.priceInr,
          payment_status: payment.status,
          payment_provider: payment.provider,
          payment_reference: payment.reference,
          briefing: briefing as unknown as Record<string, unknown>,
          status: "submitted",
        })
        .select("*")
        .single();
      if (error) {
        lastError = error;
        referenceId = makeReference();
        continue;
      }
      inserted = row as DbRow;
    }

    if (!inserted) {
      const message = (lastError as { message?: string } | null)?.message ?? "unknown error";
      throw new Error(`Advisor request could not be saved: ${message}`);
    }

    // Ops notification — never blocks the user's confirmation.
    try {
      const { deliverAdvisorNotification } = await import("./notify.server");
      const delivered = await deliverAdvisorNotification({
        referenceId: inserted.reference_id,
        packageName: pkg.name,
        amountInr: pkg.priceInr,
        topics: data.topics.map((t) => ADVISOR_TOPICS.find((x) => x.id === t)?.label ?? t),
        summary: data.summary,
        preferredSlots: data.preferredSlots.map((s) => slotLabel(s)),
        contactPhone: data.contactPhone ?? null,
        documentCount: data.documents.length,
        briefing,
      });
      if (delivered) {
        await supabase
          .from("advisor_requests")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", inserted.id);
      }
    } catch (err) {
      console.error("Advisor notification failed", err);
    }

    return {
      id: inserted.id,
      referenceId: inserted.reference_id,
      packageName: pkg.name,
      amountInr: pkg.priceInr,
      paymentStatus: payment.status,
      preferredSlots: data.preferredSlots,
      briefing,
    };
  });

export const listAdvisorRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("advisor_requests")
      .select("id, reference_id, topics, summary, documents, preferred_slots, package_id, package_name, amount_inr, payment_status, status, briefing, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as DbRow[]).map(toListItem);
  });
