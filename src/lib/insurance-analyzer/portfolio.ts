/**
 * Insurance Analyzer V2 — portfolio-level deterministic analysis.
 *
 * Consumes a set of saved policies + the user's NitiCore financial context
 * and produces an overall Protection Summary: totals per coverage line,
 * gaps, overlaps, priority actions. Zero AI. Same input → same output.
 */
import { NITI_CORE_CONFIG } from "@/lib/niti-core";
import type { FinancialContext, NitiCoreInput } from "@/lib/niti-core";
import type {
  ExtractedPolicy,
  Finding,
  InsuranceRecommendation,
  PolicyType,
} from "./types";

export interface PortfolioPolicy {
  id: string;
  policyType: PolicyType;
  insurer: string | null;
  sumInsured: number;
  premiumAnnual: number;
  fileName: string | null;
  lastReviewedAt: string;
  createdAt: string;
  protectionScore: number;
  extracted: ExtractedPolicy;
}

export interface PortfolioSummary {
  protectionScore: number; // 0–100
  scoreLabel: string;
  totalLifeCover: number;
  totalHealthCover: number;
  totalPersonalAccidentCover: number;
  totalCriticalIllnessCover: number;
  totalAnnualPremium: number;
  policyCount: number;
  perTypeCount: Record<PolicyType, number>;
  coverage: {
    hasTerm: boolean;
    hasHealth: boolean;
    hasPersonalAccident: boolean;
    hasCriticalIllness: boolean;
  };
  strengths: Finding[];
  gaps: Finding[];
  observations: Finding[];
  recommendations: InsuranceRecommendation[];
  contextSummary: string;
}

function inr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Portfolio well-protected";
  if (score >= 70) return "Adequate with minor gaps";
  if (score >= 50) return "Partial protection";
  if (score >= 30) return "Significant gaps";
  return "Critical exposure";
}

export function analyzePortfolio(
  policies: PortfolioPolicy[],
  input: NitiCoreInput,
  ctx: FinancialContext,
): PortfolioSummary {
  const perTypeCount = {
    term: 0, health: 0, family_floater: 0, personal_accident: 0,
    critical_illness: 0, life: 0, other: 0,
  } as Record<PolicyType, number>;

  let totalLifeCover = 0;
  let totalHealthCover = 0;
  let totalPA = 0;
  let totalCI = 0;
  let totalPremium = 0;

  for (const p of policies) {
    perTypeCount[p.policyType] = (perTypeCount[p.policyType] ?? 0) + 1;
    totalPremium += Number(p.premiumAnnual || 0);
    const sum = Number(p.sumInsured || 0);
    if (p.policyType === "term" || p.policyType === "life") totalLifeCover += sum;
    else if (p.policyType === "health" || p.policyType === "family_floater") totalHealthCover += sum;
    else if (p.policyType === "personal_accident") totalPA += sum;
    else if (p.policyType === "critical_illness") totalCI += sum;
  }

  const coverage = {
    hasTerm: perTypeCount.term > 0 || perTypeCount.life > 0,
    hasHealth: perTypeCount.health > 0 || perTypeCount.family_floater > 0,
    hasPersonalAccident: perTypeCount.personal_accident > 0,
    hasCriticalIllness: perTypeCount.critical_illness > 0,
  };

  const annualIncome = input.monthlyIncome * 12;
  const dependents = input.dependentsCount ?? (ctx.hasDependents ? 3 : 0);
  const familySize = 1 + Math.max(0, dependents);
  const recommendedTerm = Math.max(
    NITI_CORE_CONFIG.termLifeMultiplier * annualIncome,
    input.totalLiabilities,
  );
  const recommendedHealthBase = Math.max(10_00_000, familySize * 5_00_000);
  const recommendedHealthTotal = recommendedHealthBase + 25_00_000;
  const recommendedPA = annualIncome * 10;
  const recommendedCI = Math.max(25_00_000, input.monthlyIncome * 24);

  const strengths: Finding[] = [];
  const gaps: Finding[] = [];
  const observations: Finding[] = [];
  const recs: InsuranceRecommendation[] = [];

  // ── Term / Life ──────────────────────────────────────────────────
  if (ctx.hasDependents) {
    if (!coverage.hasTerm) {
      gaps.push({
        id: "portfolio-no-term",
        severity: "gap",
        title: "No life cover in the portfolio",
        detail: `With dependents, term insurance is the foundation. Recommended cover ≈ ${inr(recommendedTerm)} (15× annual income plus liabilities).`,
      });
      recs.push({
        id: "add-term",
        title: `Add a pure term policy of about ${inr(recommendedTerm)}`,
        priority: "high",
        reason: "Term insurance is the single largest protection lever for a household with dependents.",
        expectedBenefit: `Replaces ${inr(recommendedTerm)} of income for your family if you are not around.`,
        tradeOffs: ["Annual premium (typically 0.1–0.2% of cover in your 30s)."],
        financialImpact: `Adds ${inr(recommendedTerm)} of income-replacement capacity.`,
      });
    } else if (totalLifeCover < recommendedTerm * 0.7) {
      const gap = recommendedTerm - totalLifeCover;
      gaps.push({
        id: "portfolio-term-short",
        severity: "gap",
        title: "Combined life cover is materially short",
        detail: `Total life cover across policies is ${inr(totalLifeCover)} vs. recommended ${inr(recommendedTerm)}.`,
      });
      recs.push({
        id: "topup-term-portfolio",
        title: `Top up term cover by about ${inr(gap)}`,
        priority: "high",
        reason: "Closes the household protection gap deterministically.",
        expectedBenefit: `Brings total life cover to ${inr(recommendedTerm)}.`,
        tradeOffs: ["Modest additional annual premium."],
        financialImpact: `Adds ~${inr(gap)} of income-replacement capacity.`,
      });
    } else if (totalLifeCover >= recommendedTerm) {
      strengths.push({
        id: "portfolio-term-ok",
        severity: "strength",
        title: "Combined life cover meets the benchmark",
        detail: `Total ${inr(totalLifeCover)} across ${perTypeCount.term + perTypeCount.life} policies meets ${inr(recommendedTerm)}.`,
      });
    }

    if (perTypeCount.life > 0 && perTypeCount.term === 0) {
      observations.push({
        id: "endowment-only",
        severity: "observation",
        title: "Only endowment / ULIP life cover detected",
        detail:
          "Endowment and ULIP policies mix insurance with investment — the cover component is usually much smaller than the term-insurance benchmark. Adding a pure term policy is typically the most cost-effective step.",
      });
    }
  } else if (!coverage.hasTerm) {
    observations.push({
      id: "no-term-no-dep",
      severity: "observation",
      title: "No life cover — acceptable with no dependents",
      detail: "Priority sits with health and personal-accident cover. Revisit term when your responsibilities change.",
    });
  }

  // ── Health ───────────────────────────────────────────────────────
  if (!coverage.hasHealth) {
    gaps.push({
      id: "portfolio-no-health",
      severity: "gap",
      title: "No health insurance in the portfolio",
      detail: `A ${inr(recommendedHealthBase)} base cover for a household of ${familySize} is the minimum; a super top-up of ${inr(25_00_000)} completes the layer.`,
    });
    recs.push({
      id: "add-health",
      title: `Add health cover of at least ${inr(recommendedHealthBase)} plus a super top-up`,
      priority: "high",
      reason: "One serious hospitalisation without cover can undo years of investing.",
      expectedBenefit: `Protects your savings from a ${inr(recommendedHealthTotal)}-class medical event.`,
      tradeOffs: ["Annual premium; usually the highest-leverage rupee in the portfolio."],
      financialImpact: `Adds ${inr(recommendedHealthTotal)} of medical cover capacity.`,
    });
  } else if (totalHealthCover < recommendedHealthTotal) {
    const gap = recommendedHealthTotal - totalHealthCover;
    observations.push({
      id: "portfolio-health-thin",
      severity: "observation",
      title: "Combined health cover is below the metro benchmark",
      detail: `Total ${inr(totalHealthCover)} vs. recommended ${inr(recommendedHealthTotal)} (base + super top-up).`,
    });
    recs.push({
      id: "topup-health-portfolio",
      title: `Add a super top-up to close the ${inr(gap)} health gap`,
      priority: totalHealthCover < recommendedHealthBase ? "high" : "medium",
      reason: "Super top-ups add high total cover at a fraction of a base-policy premium.",
      expectedBenefit: `Brings health protection to ${inr(recommendedHealthTotal)}.`,
      tradeOffs: ["Deductible applies before top-up pays."],
      financialImpact: `Adds ~${inr(gap)} of catastrophic-event medical cover.`,
    });
  } else {
    strengths.push({
      id: "portfolio-health-ok",
      severity: "strength",
      title: "Combined health cover meets the benchmark",
      detail: `Total ${inr(totalHealthCover)} across ${perTypeCount.health + perTypeCount.family_floater} policies meets ${inr(recommendedHealthTotal)}.`,
    });
  }

  // Overlap detection: multiple base health policies (excluding super top-ups) for same family.
  if (perTypeCount.health + perTypeCount.family_floater > 2) {
    observations.push({
      id: "portfolio-health-overlap",
      severity: "observation",
      title: "Multiple base health policies detected",
      detail:
        "Holding several base health policies for the same members rarely doubles protection — insurers coordinate claims. Consider consolidating into one strong base + a super top-up.",
    });
  }

  // ── Personal Accident ────────────────────────────────────────────
  if (!coverage.hasPersonalAccident) {
    gaps.push({
      id: "portfolio-no-pa",
      severity: "gap",
      title: "Personal-accident cover missing",
      detail: `Health pays hospital bills; PA replaces income after a disabling accident. Recommended cover ≈ ${inr(recommendedPA)} (10× annual income).`,
    });
    recs.push({
      id: "add-pa-portfolio",
      title: `Add a standalone personal-accident cover of about ${inr(recommendedPA)}`,
      priority: "medium",
      reason: "Neither term nor health insurance protect income loss from a disabling accident.",
      expectedBenefit: "Income continuity during recovery and a lump-sum for permanent disability.",
      tradeOffs: ["Small annual premium."],
      financialImpact: `Adds ${inr(recommendedPA)} of PA protection.`,
    });
  } else if (totalPA < recommendedPA) {
    observations.push({
      id: "portfolio-pa-thin",
      severity: "observation",
      title: "Personal-accident cover below the 10× income benchmark",
      detail: `Current ${inr(totalPA)} vs. recommended ${inr(recommendedPA)}.`,
    });
  } else {
    strengths.push({
      id: "portfolio-pa-ok",
      severity: "strength",
      title: "Personal-accident cover meets the benchmark",
      detail: `Total ${inr(totalPA)} meets the 10× income guideline (${inr(recommendedPA)}).`,
    });
  }

  // ── Critical Illness ─────────────────────────────────────────────
  if (!coverage.hasCriticalIllness) {
    observations.push({
      id: "portfolio-no-ci",
      severity: "observation",
      title: "Critical-illness cover missing",
      detail: `A lump-sum ${inr(recommendedCI)} CI policy funds non-medical costs during a long recovery. Priority is low if base health cover is already strong.`,
    });
    recs.push({
      id: "add-ci-portfolio",
      title: `Consider a critical-illness cover of about ${inr(recommendedCI)}`,
      priority: "low",
      reason: "CI pays a lump sum on diagnosis of listed conditions, covering household expenses and EMIs during recovery.",
      expectedBenefit: "Preserves your emergency fund and investment SIPs during a prolonged illness.",
      tradeOffs: ["Premium rises steeply with age; family history matters."],
      financialImpact: `Adds ${inr(recommendedCI)} of lump-sum CI protection.`,
    });
  }

  // ── Premium load observation ─────────────────────────────────────
  if (annualIncome > 0 && totalPremium > annualIncome * 0.1) {
    observations.push({
      id: "premium-load-heavy",
      severity: "observation",
      title: "Annual insurance premium is high relative to income",
      detail: `Combined premium of ${inr(totalPremium)} is ${((totalPremium / annualIncome) * 100).toFixed(1)}% of annual income. Above 6–8% typically signals endowment / ULIP-heavy portfolios worth reviewing.`,
    });
  }

  // ── Scoring ──────────────────────────────────────────────────────
  const termScore = ctx.hasDependents
    ? Math.min(1, totalLifeCover / Math.max(1, recommendedTerm)) * 35
    : 25;
  const healthScore = Math.min(1, totalHealthCover / Math.max(1, recommendedHealthTotal)) * 35;
  const paScore = Math.min(1, totalPA / Math.max(1, recommendedPA)) * 15;
  const ciScore = coverage.hasCriticalIllness ? 15 : 5;
  const protectionScore = Math.max(0, Math.min(100, Math.round(termScore + healthScore + paScore + ciScore)));

  return {
    protectionScore,
    scoreLabel: scoreLabel(protectionScore),
    totalLifeCover,
    totalHealthCover,
    totalPersonalAccidentCover: totalPA,
    totalCriticalIllnessCover: totalCI,
    totalAnnualPremium: totalPremium,
    policyCount: policies.length,
    perTypeCount,
    coverage,
    strengths,
    gaps,
    observations,
    recommendations: recs,
    contextSummary: `${ctx.lifeStage.replace(/_/g, "-")} stage, household of ${familySize}, ${ctx.protectionPosture} protection posture.`,
  };
}
