/**
 * Insurance Analyzer — deterministic analysis engine (V1).
 *
 * Given the extracted policy + the user's NitiCore FinancialContext, compute
 * strengths, gaps, observations and CFP-style recommendations. Zero AI. No
 * randomness. Same input → same output.
 *
 * Gemini's only job downstream is to narrate these findings in plain English.
 */
import { NITI_CORE_CONFIG } from "@/lib/niti-core";
import type { FinancialContext, NitiCoreInput } from "@/lib/niti-core";
import type {
  AnalysisReport,
  ExtractedPolicy,
  Finding,
  InsuranceRecommendation,
  PolicyType,
} from "./types";
import { POLICY_TYPE_LABEL } from "./types";

interface EngineInput {
  policy: ExtractedPolicy;
  policyType: PolicyType;
  input: NitiCoreInput;
  context: FinancialContext;
  existingPortfolio: {
    hasTerm: boolean;
    hasHealth: boolean;
    hasPersonalAccident: boolean;
    hasCriticalIllness: boolean;
    totalTermCover: number;
    totalHealthCover: number;
  };
}

function inr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Well-protected";
  if (score >= 70) return "Adequate with minor gaps";
  if (score >= 50) return "Partial protection";
  if (score >= 30) return "Significant gaps";
  return "Critical exposure";
}

/**
 * Route to a policy-specific analyser. Each returns the same report shape so
 * downstream code and Gemini narration stay uniform.
 */
export function analyzePolicy(args: EngineInput): AnalysisReport {
  switch (args.policyType) {
    case "term":
    case "life":
      return analyzeTerm(args);
    case "health":
    case "family_floater":
      return analyzeHealth(args);
    case "personal_accident":
      return analyzePersonalAccident(args);
    case "critical_illness":
      return analyzeCriticalIllness(args);
    default:
      return analyzeGeneric(args);
  }
}

// ─────────────────────────── TERM / LIFE ────────────────────────────

function analyzeTerm({ policy, policyType, input, context, existingPortfolio }: EngineInput): AnalysisReport {
  const annualIncome = input.monthlyIncome * 12;
  const recommendedCover = Math.max(
    NITI_CORE_CONFIG.termLifeMultiplier * annualIncome,
    input.totalLiabilities,
  );
  const currentCover = Number(policy.sumInsured ?? 0);
  const totalTerm = existingPortfolio.totalTermCover;
  const coverageRatio = recommendedCover > 0 ? Math.min(1.2, totalTerm / recommendedCover) : 0;

  const strengths: Finding[] = [];
  const gaps: Finding[] = [];
  const observations: Finding[] = [];
  const recs: InsuranceRecommendation[] = [];

  if (policyType === "life") {
    observations.push({
      id: "life-vs-term",
      severity: "observation",
      title: "Life / endowment policy detected",
      detail:
        "Endowment, money-back and ULIP policies mix insurance with investment. Cover is usually much smaller than needed, and long-term returns tend to trail simple term + mutual-fund combinations. NitiCore treats the cover portion as term for adequacy math.",
    });
  }

  if (currentCover > 0) {
    strengths.push({
      id: "policy-in-force",
      severity: "strength",
      title: `${inr(currentCover)} sum insured is in place`,
      detail: `This policy contributes ${inr(currentCover)} toward your family's protection.`,
    });
  }

  if (!context.hasDependents) {
    observations.push({
      id: "no-dependents",
      severity: "observation",
      title: "No financial dependents recorded",
      detail:
        "Term insurance protects income for people who depend on you. With no declared dependents, the priority shifts to health and personal accident cover rather than raising term.",
    });
  }

  if (context.hasDependents) {
    if (totalTerm < recommendedCover * 0.7) {
      const gap = recommendedCover - totalTerm;
      gaps.push({
        id: "term-underinsured",
        severity: "gap",
        title: "Term cover appears low for your income and liabilities",
        detail: `Recommended cover ≈ ${inr(recommendedCover)} (15× annual income, plus outstanding loans). You currently hold ${inr(totalTerm)} across all term policies.`,
      });
      recs.push({
        id: "increase-term",
        title: `Increase term cover by approximately ${inr(gap)}`,
        priority: "high",
        reason: `Your dependents need income replacement of roughly ${inr(recommendedCover)}. Present cover is ${inr(totalTerm)}.`,
        expectedBenefit: `Closes the ${inr(gap)} protection gap so a single event does not force lifestyle downgrades or debt on your family.`,
        tradeOffs: [
          "Additional annual premium (typically 0.1–0.2% of the added cover in your 30s).",
          "Underwriting requires medicals if the new sum insured is high.",
        ],
        financialImpact: `Adds ~${inr(gap)} of income-replacement capacity.`,
      });
    } else if (totalTerm < recommendedCover) {
      const gap = recommendedCover - totalTerm;
      observations.push({
        id: "term-slight-gap",
        severity: "observation",
        title: "Term cover is close to target",
        detail: `A top-up of about ${inr(gap)} would bring cover to the recommended ${inr(recommendedCover)}. Not urgent, but plan for it at the next salary review.`,
      });
      recs.push({
        id: "topup-term",
        title: `Top up term cover by about ${inr(gap)} when convenient`,
        priority: "medium",
        reason: "Cover is close to the recommended level but not yet at 15× annual income + liabilities.",
        expectedBenefit: "Aligns protection with income growth so cover does not lag your responsibilities.",
        tradeOffs: ["Small incremental premium."],
        financialImpact: `Adds ~${inr(gap)} of protection.`,
      });
    } else {
      strengths.push({
        id: "term-adequate",
        severity: "strength",
        title: "Term protection meets NitiCore's guideline",
        detail: `Total term cover of ${inr(totalTerm)} meets the recommended ${inr(recommendedCover)}.`,
      });
    }
  }

  // Riders
  if (policy.riders.length === 0) {
    observations.push({
      id: "no-riders",
      severity: "observation",
      title: "No riders detected",
      detail:
        "A waiver-of-premium rider (in case of disability) and a critical-illness rider are usually low-cost additions worth reviewing. Accidental-death riders duplicate personal-accident cover and are optional.",
    });
  } else {
    strengths.push({
      id: "riders-present",
      severity: "strength",
      title: `${policy.riders.length} rider(s) attached`,
      detail: policy.riders.join(", "),
    });
  }

  // Nominee
  if (!policy.nominee) {
    gaps.push({
      id: "nominee-missing",
      severity: "gap",
      title: "Nominee details not confirmed",
      detail:
        "A missing or outdated nominee is one of the commonest reasons claims get delayed. Confirm the nominee on record and refresh it after any major life event.",
    });
    recs.push({
      id: "update-nominee",
      title: "Confirm and update nominee details",
      priority: "medium",
      reason: "The nominee is who receives the claim without dispute.",
      expectedBenefit: "Faster, uncontested claim settlement for your family.",
      tradeOffs: [],
      financialImpact: "No premium cost. Purely administrative.",
    });
  }

  // Cross-portfolio
  if (context.hasDependents && !existingPortfolio.hasHealth) {
    gaps.push({
      id: "health-missing-with-term",
      severity: "gap",
      title: "Health cover missing alongside term",
      detail:
        "Term protects your family from loss of income; health cover protects the wealth you have already built. Both are needed together.",
    });
  }

  const protectionScore = Math.round(
    (context.hasDependents ? coverageRatio * 70 : 60) +
      (policy.nominee ? 10 : 0) +
      (policy.riders.length > 0 ? 10 : 5) +
      (existingPortfolio.hasHealth ? 10 : 0),
  );

  return {
    policyType,
    protectionScore: clamp(protectionScore),
    scoreLabel: scoreLabel(protectionScore),
    coverageSummary: coverageSummary(policy),
    strengths,
    gaps,
    observations,
    recommendations: recs,
    contextSummary: describeContextShort(context),
  };
}

// ─────────────────────────── HEALTH / FLOATER ───────────────────────

function analyzeHealth({ policy, policyType, input, context, existingPortfolio }: EngineInput): AnalysisReport {
  const strengths: Finding[] = [];
  const gaps: Finding[] = [];
  const observations: Finding[] = [];
  const recs: InsuranceRecommendation[] = [];

  const sum = Number(policy.sumInsured ?? 0);
  const dependents = input.dependentsCount ?? (context.hasDependents ? 3 : 0);
  const familySize = 1 + Math.max(0, dependents);

  // A pragmatic metro baseline: ₹5 L per adult member, minimum ₹10 L, plus ₹25 L top-up recommended.
  const baseRecommended = Math.max(10_00_000, familySize * 5_00_000);
  const topUpRecommended = 25_00_000;

  if (sum >= baseRecommended) {
    strengths.push({
      id: "base-adequate",
      severity: "strength",
      title: "Base health cover meets the benchmark",
      detail: `${inr(sum)} for a household of ${familySize} meets NitiCore's baseline of ${inr(baseRecommended)}.`,
    });
  } else if (sum > 0) {
    gaps.push({
      id: "base-thin",
      severity: "gap",
      title: "Base health cover looks thin",
      detail: `${inr(sum)} may not fully absorb a metro hospitalisation for a household of ${familySize}. A base of at least ${inr(baseRecommended)} is prudent, with a super top-up for larger claims.`,
    });
    recs.push({
      id: "raise-base",
      title: `Raise base cover to at least ${inr(baseRecommended)}`,
      priority: "high",
      reason: `Modern hospitalisation costs regularly exceed ${inr(sum)}, especially in metros and Tier-1 cities.`,
      expectedBenefit: "Protects your emergency fund and investments from being liquidated for medical bills.",
      tradeOffs: ["Modest premium increase; often small compared to a ₹25 L super top-up added on top."],
      financialImpact: `Increases usable cover to ${inr(baseRecommended)} at the base layer.`,
    });
  }

  if (sum > 0 && sum < baseRecommended + topUpRecommended) {
    recs.push({
      id: "add-topup",
      title: `Add a super top-up of ${inr(topUpRecommended)} with a matching deductible`,
      priority: sum < baseRecommended ? "high" : "medium",
      reason: "Base premiums scale steeply. A super top-up gives high total cover at a fraction of the premium.",
      expectedBenefit: `Total protection of roughly ${inr(baseRecommended + topUpRecommended)} for a critical-care event.`,
      tradeOffs: [
        "Top-ups pay only above the deductible each year.",
        "Underwriting for the top-up is separate from the base policy.",
      ],
      financialImpact: `Adds ${inr(topUpRecommended)} of catastrophic-event cover.`,
    });
  }

  // Room rent limits
  if (policy.roomRentLimit && /1%|single|shared|capped/i.test(policy.roomRentLimit)) {
    gaps.push({
      id: "room-rent-cap",
      severity: "gap",
      title: "Room-rent capping detected",
      detail: `Detected limit: "${policy.roomRentLimit}". Room-rent caps proportionately reduce every other claim line item — a known reason for shortfalls at claim time.`,
    });
    recs.push({
      id: "remove-room-cap",
      title: "Prefer a policy without room-rent capping",
      priority: "medium",
      reason: "Capping proportionately shrinks doctor fees, ICU and consumables — the entire hospital bill.",
      expectedBenefit: "Full claim settlement without co-payment surprises.",
      tradeOffs: ["Uncapped variants carry a slightly higher premium."],
      financialImpact: "Prevents 20–40% claim shortfalls in a large hospitalisation.",
    });
  }

  // Co-pay
  if ((policy.copayPct ?? 0) > 0) {
    observations.push({
      id: "copay",
      severity: "observation",
      title: `Policy carries a ${policy.copayPct}% co-payment`,
      detail:
        "Co-payments trade lower premium for higher out-of-pocket at claim time. Review whether the saving is worth the exposure.",
    });
  }

  // Waiting periods
  if (policy.waitingPeriods.length > 0) {
    observations.push({
      id: "waiting",
      severity: "observation",
      title: "Waiting periods apply",
      detail: policy.waitingPeriods.join("; "),
    });
  }

  // Overlap detection
  if (policyType === "family_floater" && existingPortfolio.totalHealthCover > sum * 2) {
    observations.push({
      id: "possible-overlap",
      severity: "observation",
      title: "Multiple health policies detected",
      detail:
        "Holding multiple base health policies for the same members rarely doubles protection — insurers coordinate claims. Consider consolidating into one base + a super top-up.",
    });
  }

  // Complementary covers
  if (!existingPortfolio.hasPersonalAccident) {
    gaps.push({
      id: "pa-missing",
      severity: "gap",
      title: "Personal accident cover missing",
      detail:
        "Health insurance pays hospital bills but does not replace lost income after a disabling accident. A standalone personal-accident policy is inexpensive and fills this gap.",
    });
    recs.push({
      id: "add-pa",
      title: "Add a standalone personal-accident cover",
      priority: "medium",
      reason: "Health insurance and term insurance don't cover income loss due to disability from an accident.",
      expectedBenefit: "Replaces income during recovery and pays for permanent-disability scenarios.",
      tradeOffs: ["A separate small annual premium."],
      financialImpact: `Cover of 10× annual income is typical (≈ ${inr(input.monthlyIncome * 12 * 10)}).`,
    });
  }

  const totalHealth = existingPortfolio.totalHealthCover;
  const coverageRatio = totalHealth > 0
    ? Math.min(1.2, totalHealth / (baseRecommended + topUpRecommended))
    : 0;
  const protectionScore = Math.round(
    coverageRatio * 70 +
      (policy.roomRentLimit && /1%|single|capped/i.test(policy.roomRentLimit) ? 0 : 10) +
      ((policy.copayPct ?? 0) === 0 ? 10 : 5) +
      (existingPortfolio.hasPersonalAccident ? 10 : 0),
  );

  return {
    policyType,
    protectionScore: clamp(protectionScore),
    scoreLabel: scoreLabel(protectionScore),
    coverageSummary: coverageSummary(policy),
    strengths,
    gaps,
    observations,
    recommendations: recs,
    contextSummary: describeContextShort(context),
  };
}

// ─────────────────────────── PERSONAL ACCIDENT ──────────────────────

function analyzePersonalAccident({ policy, policyType, input, context, existingPortfolio }: EngineInput): AnalysisReport {
  const strengths: Finding[] = [];
  const gaps: Finding[] = [];
  const observations: Finding[] = [];
  const recs: InsuranceRecommendation[] = [];
  const sum = Number(policy.sumInsured ?? 0);
  const recommended = input.monthlyIncome * 12 * 10;

  if (sum >= recommended) {
    strengths.push({
      id: "pa-adequate",
      severity: "strength",
      title: "Personal-accident cover meets the 10× income benchmark",
      detail: `${inr(sum)} vs. recommended ${inr(recommended)}.`,
    });
  } else if (sum > 0) {
    gaps.push({
      id: "pa-thin",
      severity: "gap",
      title: "Personal-accident cover is below the 10× income benchmark",
      detail: `Recommended cover ≈ ${inr(recommended)}; current cover is ${inr(sum)}.`,
    });
    recs.push({
      id: "raise-pa",
      title: `Increase personal-accident cover to about ${inr(recommended)}`,
      priority: "medium",
      reason: "PA cover replaces income after disability and pays lump-sums for permanent injury.",
      expectedBenefit: "Adequate income-loss protection during recovery.",
      tradeOffs: ["Small incremental premium."],
      financialImpact: `Adds ${inr(Math.max(0, recommended - sum))} of PA protection.`,
    });
  }

  if (!existingPortfolio.hasTerm && context.hasDependents) {
    gaps.push({
      id: "term-missing",
      severity: "gap",
      title: "Term insurance missing",
      detail: "PA cover complements — but does not replace — term insurance for your dependents.",
    });
  }

  const coverageRatio = recommended > 0 ? Math.min(1.2, sum / recommended) : 0;
  const protectionScore = Math.round(coverageRatio * 80 + (existingPortfolio.hasTerm ? 20 : 0));

  return {
    policyType,
    protectionScore: clamp(protectionScore),
    scoreLabel: scoreLabel(protectionScore),
    coverageSummary: coverageSummary(policy),
    strengths,
    gaps,
    observations,
    recommendations: recs,
    contextSummary: describeContextShort(context),
  };
}

// ─────────────────────────── CRITICAL ILLNESS ───────────────────────

function analyzeCriticalIllness({ policy, policyType, input, context, existingPortfolio }: EngineInput): AnalysisReport {
  const strengths: Finding[] = [];
  const gaps: Finding[] = [];
  const observations: Finding[] = [];
  const recs: InsuranceRecommendation[] = [];
  const sum = Number(policy.sumInsured ?? 0);
  const recommended = Math.max(25_00_000, input.monthlyIncome * 24); // 2 years of income floor.

  if (sum >= recommended) {
    strengths.push({
      id: "ci-adequate",
      severity: "strength",
      title: "Critical-illness cover meets the benchmark",
      detail: `${inr(sum)} vs. recommended ${inr(recommended)}.`,
    });
  } else if (sum > 0) {
    observations.push({
      id: "ci-thin",
      severity: "observation",
      title: "Critical-illness cover is below the benchmark",
      detail: `A lump-sum of at least ${inr(recommended)} typically covers treatment plus income loss during recovery.`,
    });
    recs.push({
      id: "raise-ci",
      title: `Consider raising critical-illness cover to about ${inr(recommended)}`,
      priority: "low",
      reason: "CI pays a lump sum on diagnosis of listed conditions — useful for income loss during recovery.",
      expectedBenefit: "Covers non-medical expenses (household, EMIs) during a long recovery.",
      tradeOffs: ["Premium rises steeply with age; buy while young if the family history warrants it."],
      financialImpact: `Adds ${inr(Math.max(0, recommended - sum))} of CI cover.`,
    });
  }

  if (!existingPortfolio.hasHealth) {
    gaps.push({
      id: "no-health-with-ci",
      severity: "gap",
      title: "Base health cover missing",
      detail: "Critical-illness is a supplement — it does not replace hospitalisation cover.",
    });
  }

  const coverageRatio = recommended > 0 ? Math.min(1.2, sum / recommended) : 0;
  const protectionScore = Math.round(coverageRatio * 70 + (existingPortfolio.hasHealth ? 30 : 10));

  return {
    policyType,
    protectionScore: clamp(protectionScore),
    scoreLabel: scoreLabel(protectionScore),
    coverageSummary: coverageSummary(policy),
    strengths,
    gaps,
    observations,
    recommendations: recs,
    contextSummary: describeContextShort(context),
  };
}

// ─────────────────────────── GENERIC ────────────────────────────────

function analyzeGeneric({ policy, policyType, context }: EngineInput): AnalysisReport {
  return {
    policyType,
    protectionScore: 50,
    scoreLabel: "Not yet categorised",
    coverageSummary: coverageSummary(policy),
    strengths: [],
    gaps: [],
    observations: [
      {
        id: "unknown-policy",
        severity: "observation",
        title: `${POLICY_TYPE_LABEL[policyType]} — limited automated analysis`,
        detail: "This policy type is captured for your records. Deeper analysis will arrive in future versions.",
      },
    ],
    recommendations: [],
    contextSummary: describeContextShort(context),
  };
}

// ─────────────────────────── HELPERS ────────────────────────────────

function coverageSummary(policy: ExtractedPolicy): string[] {
  const rows: string[] = [];
  if (policy.insurer) rows.push(`Insurer — ${policy.insurer}`);
  if (policy.policyNumber) rows.push(`Policy number — ${policy.policyNumber}`);
  if (policy.sumInsured) rows.push(`Sum insured — ${inr(policy.sumInsured)}`);
  if (policy.premiumAnnual) rows.push(`Annual premium — ${inr(policy.premiumAnnual)}`);
  if (policy.policyTermYears) rows.push(`Policy term — ${policy.policyTermYears} years`);
  if (policy.coverageStart || policy.coverageEnd)
    rows.push(`Coverage — ${policy.coverageStart ?? "—"} to ${policy.coverageEnd ?? "—"}`);
  if (policy.nominee) rows.push(`Nominee — ${policy.nominee}`);
  if (policy.roomRentLimit) rows.push(`Room rent — ${policy.roomRentLimit}`);
  if (policy.copayPct != null) rows.push(`Co-payment — ${policy.copayPct}%`);
  if (policy.deductible != null) rows.push(`Deductible — ${inr(policy.deductible)}`);
  if (policy.riders.length) rows.push(`Riders — ${policy.riders.join(", ")}`);
  if (policy.addOns.length) rows.push(`Add-ons — ${policy.addOns.join(", ")}`);
  return rows;
}

function describeContextShort(ctx: FinancialContext): string {
  const stage = ctx.lifeStage.replace(/_/g, "-");
  const dep = ctx.hasDependents ? "with dependents" : "no declared dependents";
  return `${stage} stage, ${dep}, ${ctx.protectionPosture} protection posture.`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
