/**
 * NitiCore™ Recommendation Engine — v3 (CFP-style holistic reasoning).
 *
 * Evolution over v2:
 *   • v1: each pillar generated its own recommendation.
 *   • v2: introduced a global impactScore and cross-pillar dampening.
 *   • v3: introduces an explicit FinancialContext (life stage, protection
 *     posture, liquidity health, monthly surplus, wealth stage, flags) that
 *     the engine consults BEFORE ranking anything. Every recommendation now
 *     carries the deterministic reasoning a Certified Financial Planner would
 *     articulate: financial objective, short-term impact, long-term impact,
 *     explicit trade-offs, dependencies, and opportunity cost.
 *
 * All existing consumers keep working — new fields are optional. The engine
 * remains fully deterministic. AI never enters this file.
 */
import type { MetricResult, NitiCoreInput, Recommendation, Priority } from "./types";
import {
  calculateEmergencyFund,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateInsuranceAdequacy,
  calculateRetirement,
} from "./services";
import { evaluateContext, type FinancialContext } from "./financial-context";

type Rule = (input: NitiCoreInput, ctx: FinancialContext) => Recommendation | null;

/**
 * Global impact heuristic. Higher = act sooner.
 *
 * Inputs are all deterministic signals:
 *   priority     ∈ {high, medium, low}
 *   severity     ∈ {critical, warning, info, success}
 *   effort       ∈ {low, medium, high}
 *   pillarWeight (0..1) — how much the pillar affects the composite NitiScore
 *   contextBoost — situational adjustment reflecting life stage + flags
 */
function computeImpactScore(args: {
  priority: Priority;
  severity: Recommendation["severity"];
  effort: Recommendation["effort"];
  pillarWeight: number;
  contextBoost?: number;
}): number {
  const priorityScore = { high: 100, medium: 60, low: 30 }[args.priority];
  const severityMul = { critical: 1.4, warning: 1.1, info: 0.9, success: 0.5 }[args.severity];
  const effortMul = { low: 1.2, medium: 1.0, high: 0.85 }[args.effort];
  const base = priorityScore * severityMul * effortMul * (0.5 + args.pillarWeight);
  return Math.round(base * (1 + (args.contextBoost ?? 0)));
}

// ────────────────────────────────────────────────────────────────
// Rules
// Each rule now reads context and produces the full CFP-style
// deterministic reasoning payload.
// ────────────────────────────────────────────────────────────────

const emergencyFundRule: Rule = (input, ctx) => {
  const r = calculateEmergencyFund(input);
  if (r.status === "on_track") return null;

  const priority: Priority = ctx.flags.includes("emergency_critical") ? "high" : r.priority;
  const severity: Recommendation["severity"] =
    r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "low";

  // Life-stage-tuned boost: buffer is disproportionately valuable for
  // early-career and family-building users.
  const contextBoost =
    ctx.lifeStage === "early_career" || ctx.lifeStage === "family_building" ? 0.1 : 0;

  return {
    id: "rec_emergency_fund",
    title: "Build a 6-month emergency fund",
    category: "Emergency",
    priority,
    severity,
    explanation: "Emergencies cost cash. Without a buffer you'll borrow at 15-24% interest.",
    whyItMatters:
      "A buffer means one hospital bill or job change doesn't force you to break long-term investments or take costly loans. It's the foundation every other goal sits on.",
    expectedImpact:
      "Lifts the Emergency pillar towards 100/100 and stabilises your NitiScore. Also lowers stress-driven debt risk.",
    logic: "Aim for >= 6x monthly essential expenses in a liquid fund.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High - protects every other financial goal.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 10,
    impactScore: computeImpactScore({
      priority,
      severity,
      effort,
      pillarWeight: 0.15,
      contextBoost,
    }),
    financialObjective: "Establish a resilient cash buffer that absorbs income shocks.",
    shortTermImpact:
      "Redirects part of the monthly surplus into a liquid fund; investing pace slows briefly.",
    longTermImpact:
      "Protects long-term SIPs from forced redemption during job loss, medical or family emergencies.",
    tradeOffs: [
      "Slightly slower investment growth for 6-12 months while the buffer is filled.",
      "Money sits in a liquid fund earning ~6-7% instead of equity's ~11-13%.",
    ],
    dependencies: [],
    opportunityCost:
      "A few months of foregone equity returns in exchange for eliminating the biggest single point of failure in your plan.",
    confidenceLevel: "deterministic",
    contextTag: `${ctx.lifeStage} · liquidity=${ctx.liquidityHealth}`,
  };
};

const insuranceRule: Rule = (input, ctx) => {
  const r = calculateInsuranceAdequacy(input);
  if (r.status === "on_track") return null;

  // With dependents, insurance is always high priority regardless of raw score.
  const priority: Priority =
    ctx.hasDependents && ctx.protectionPosture !== "protected" ? "high" : r.priority;
  const severity: Recommendation["severity"] =
    r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "low";

  const contextBoost = ctx.hasDependents ? 0.15 : 0;

  return {
    id: "rec_insurance",
    title: "Close your insurance gap",
    category: "Insurance",
    priority,
    severity,
    explanation: "One hospitalisation or income loss can undo a decade of planning.",
    whyItMatters:
      "In India, a single ICU stay routinely runs into lakhs. Term cover protects the people who depend on your income; health cover protects the wealth you've already built.",
    expectedImpact:
      "Removes the largest downside risk in your plan and lifts the Insurance pillar of your NitiScore.",
    logic: "Term cover >= 15x annual income; health cover >= 10 L family-floater.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High - protects dependents and savings.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 20,
    impactScore: computeImpactScore({
      priority,
      severity,
      effort,
      pillarWeight: 0.15,
      contextBoost,
    }),
    financialObjective:
      "Transfer catastrophic risk to insurers so a single event cannot derail the plan.",
    shortTermImpact:
      "Adds a modest monthly premium; disposable income drops by roughly 0.5-2% of monthly income.",
    longTermImpact:
      "Preserves accumulated wealth and dependents' lifestyle through unpredictable shocks over decades.",
    tradeOffs: [
      "Slightly lower monthly investable surplus.",
      "Premium is a sunk cost each year; it does not compound like investments.",
    ],
    dependencies: [],
    opportunityCost:
      "The cheapest possible protection: giving up ~1% of monthly income to eliminate a ~lakhs-scale downside.",
    confidenceLevel: "deterministic",
    contextTag: `dependents=${ctx.hasDependents} · protection=${ctx.protectionPosture}`,
  };
};

const debtRule: Rule = (input, ctx) => {
  const r = calculateDebtRatio(input);
  if (r.status === "on_track") return null;

  const priority: Priority = ctx.flags.includes("debt_overload") ? "high" : r.priority;
  const severity: Recommendation["severity"] =
    r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";

  const contextBoost = ctx.flags.includes("debt_overload") ? 0.1 : 0;

  return {
    id: "rec_debt",
    title: "Bring EMI ratio under 20%",
    category: "Debt",
    priority,
    severity,
    explanation: "High EMIs starve investments and destroy compounding.",
    whyItMatters:
      "Every rupee going to EMIs at 9-14% can't compound in equity at 11-13%. Reducing EMIs frees monthly cash for SIPs and cuts the risk of a cash-flow crunch.",
    expectedImpact:
      "Lowers debt ratio, improves the Debt pillar, and unlocks more room for investments - a compounding double-benefit over 10+ years.",
    logic: "EMI-to-income ratio should stay under 20% (healthy) / 40% (max).",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High - frees monthly cash for investments.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 30,
    impactScore: computeImpactScore({
      priority,
      severity,
      effort,
      pillarWeight: 0.15,
      contextBoost,
    }),
    financialObjective:
      "Lower the fixed monthly obligation so cash flow can fund goals and investments.",
    shortTermImpact:
      "Requires directing a lump sum or higher EMI into prepayment; short-term liquidity dips.",
    longTermImpact:
      "Every rupee of prepaid high-interest debt permanently frees future cash flow for SIPs.",
    tradeOffs: [
      "Prepayment reduces liquidity in the short term.",
      "Do not prepay at the cost of your emergency fund - that reintroduces the very risk you are trying to remove.",
    ],
    dependencies: ["rec_emergency_fund"],
    opportunityCost:
      "Money used for prepayment cannot be invested this month - but avoiding 9-14% guaranteed interest usually beats uncertain equity returns.",
    confidenceLevel: "deterministic",
    contextTag: `debtRatio=${ctx.debtRatioPct}% · surplus=${ctx.surplusPct}%`,
  };
};

const savingsRule: Rule = (input, ctx) => {
  const r = calculateSavingsRate(input);
  if (r.status === "on_track") return null;

  const priority = r.priority;
  const severity: Recommendation["severity"] =
    r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";

  // For early-career users, raising savings rate compounds for the longest.
  const contextBoost = ctx.lifeStage === "early_career" ? 0.1 : 0;

  return {
    id: "rec_savings",
    title: "Raise savings rate to 30%",
    category: "Savings",
    priority,
    severity,
    explanation: "Savings rate is the single biggest lever for long-term wealth.",
    whyItMatters:
      "Over 20-30 years, savings rate matters more than return rate. A steady 30% put into an index SIP outperforms clever picks with a 15% rate.",
    expectedImpact:
      "Directly increases the Savings pillar of your NitiScore and materially improves retirement readiness and goal timelines.",
    logic: "(Income - Expenses)/Income x 100 should be >= 30%.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "Very high - compounds for decades.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 40,
    impactScore: computeImpactScore({
      priority,
      severity,
      effort,
      pillarWeight: 0.2,
      contextBoost,
    }),
    financialObjective:
      "Increase the monthly cash gap between income and expenses so more can be invested.",
    shortTermImpact:
      "Requires trimming discretionary expenses or increasing income; lifestyle feels tighter for 1-3 months.",
    longTermImpact:
      "A durable savings-rate lift is the single most powerful multiplier of net worth over 10-20 years.",
    tradeOffs: [
      "Short-term lifestyle adjustments (dining, subscriptions, upgrades).",
      "Only meaningful if the extra savings are actually invested, not left in the account.",
    ],
    dependencies: [],
    opportunityCost:
      "Trading a small amount of current consumption for meaningfully larger future wealth.",
    confidenceLevel: "deterministic",
    contextTag: `savings=${ctx.savingsRatePct}% · stage=${ctx.lifeStage}`,
  };
};

const retirementRule: Rule = (input, ctx) => {
  const r = calculateRetirement(input);
  if (r.status === "on_track") return null;

  const priority: Priority = ctx.flags.includes("retirement_late_start") ? "high" : r.priority;
  const severity: Recommendation["severity"] =
    r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";

  const contextBoost = ctx.flags.includes("retirement_late_start") ? 0.1 : 0;

  return {
    id: "rec_retirement",
    title: "Close your retirement gap",
    category: "Retirement",
    priority,
    severity,
    explanation: "Retirement is a fixed date; the earlier you act, the smaller the SIP.",
    whyItMatters:
      "A 5,000 monthly gap at 30 becomes a 20,000 gap at 45 for the same corpus. Starting early is the single cheapest way to buy a comfortable retirement.",
    expectedImpact:
      "Improves the Retirement pillar of your NitiScore and pulls the retirement gap closer to zero year on year.",
    logic: "Corpus needed ~ future annual expenses / withdrawal rate.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High - quality of life for 25+ years.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 50,
    impactScore: computeImpactScore({
      priority,
      severity,
      effort,
      pillarWeight: 0.15,
      contextBoost,
    }),
    financialObjective:
      "Build a corpus that funds essential expenses for 25+ years without a paycheck.",
    shortTermImpact:
      "Raises monthly SIP / NPS / EPF contribution; reduces disposable income now.",
    longTermImpact:
      "Materially raises the probability of a self-funded retirement and avoids dependence on children.",
    tradeOffs: [
      "Higher current SIP reduces short-term liquidity.",
      "Do not raise retirement SIPs while the emergency buffer or insurance is missing.",
    ],
    dependencies: ["rec_emergency_fund", "rec_insurance"],
    opportunityCost:
      "Money committed to retirement is locked away from short-term goals; that is precisely why it compounds.",
    confidenceLevel: "deterministic",
    contextTag: `stage=${ctx.wealthStage} · yearsLeft=${Math.max(0, input.retirementAge - input.ageYears)}`,
  };
};

const portfolioConcentrationRule: Rule = (input, ctx) => {
  const cs = input.crossService;
  if (!cs || !ctx.flags.includes("portfolio_concentrated")) return null;
  const priority: Priority = "medium";
  const severity: Recommendation["severity"] = "warning";
  const effort: Recommendation["effort"] = "medium";
  const conc = cs.portfolioConcentrationScore ?? 0;
  return {
    id: "rec_portfolio_concentration",
    title: "Reduce portfolio concentration",
    category: "Investments",
    priority,
    severity,
    explanation: "NitiInvest™ flagged that a few holdings dominate your portfolio.",
    whyItMatters:
      "When a small number of holdings drive most of your returns, one bad quarter can wipe out years of compounding. Diversification is the cheapest risk reduction available to an investor.",
    expectedImpact:
      "Improves diversification and lifts your NitiInvest™ score, without needing more capital.",
    logic: "Concentration score >= 60 flags a portfolio that leans heavily on 1-3 holdings.",
    assumptions: { concentrationScore: conc },
    formulaSummary: `NitiInvest concentration score = ${conc}/100.`,
    impact: "Medium - protects the portfolio without changing SIP amount.",
    effort,
    nextAction: "Open NitiInvest™ and rebalance the top holdings towards your target allocation.",
    displayOrder: 60,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.15, contextBoost: 0.05 }),
    financialObjective: "Lower single-holding risk while keeping expected returns intact.",
    shortTermImpact: "May trigger some capital-gains tax on trims; requires one rebalance.",
    longTermImpact: "Smoother compounding and less exposure to any single company or sector shock.",
    tradeOffs: [
      "Trimming winners can feel counter-intuitive but protects gains.",
      "Small STCG/LTCG impact depending on holding period.",
    ],
    dependencies: [],
    opportunityCost: "Slightly lower upside if the concentrated holding keeps outperforming — in exchange for materially lower downside.",
    confidenceLevel: "deterministic",
    contextTag: `concentration=${conc}/100`,
  };
};

const crossServiceImbalanceRule: Rule = (input, ctx) => {
  if (!ctx.flags.includes("cross_service_imbalance")) return null;
  return {
    id: "rec_cross_service_balance",
    title: "Balance protection before scaling investments",
    category: "Insurance",
    priority: "high",
    severity: "warning",
    explanation: "Your investments look strong but your protection layer is thin.",
    whyItMatters:
      "A well-built portfolio can still be undone by a single uncovered medical event or income loss. Protection is the moat that keeps compounding intact.",
    expectedImpact: "Restores the Emergency > Insurance > Investments hierarchy NitiCore is built on.",
    logic: "Cross-service check: strong NitiInvest™ score paired with weak NitiSure™ / core cover.",
    assumptions: {},
    formulaSummary: "Cross-service imbalance detected between NitiInvest™ and NitiSure™.",
    impact: "High - protects the portfolio you have already built.",
    effort: "low",
    nextAction: "Open Insurance Analyzer and close the term / health gap before adding new SIPs.",
    displayOrder: 15,
    impactScore: computeImpactScore({ priority: "high", severity: "warning", effort: "low", pillarWeight: 0.15, contextBoost: 0.15 }),
    financialObjective: "Ensure protection matches the wealth you are actively building.",
    shortTermImpact: "Redirects a small monthly amount to premiums.",
    longTermImpact: "Prevents a single uncovered event from erasing years of investing.",
    tradeOffs: ["Marginally lower monthly investable surplus."],
    dependencies: [],
    opportunityCost: "The cheapest possible insurance against portfolio drawdowns triggered by non-market events.",
    confidenceLevel: "deterministic",
    contextTag: "cross_service_imbalance",
  };
};

const RULES: Rule[] = [emergencyFundRule, insuranceRule, debtRule, savingsRule, retirementRule, portfolioConcentrationRule, crossServiceImbalanceRule];

/**
 * Cross-pillar prioritisation with context.
 *
 * Tier 0 (most urgent, "safety net"): protection gap for a user with
 *   dependents, OR critically thin buffer (< 2 months).
 * Tier 1: debt overload (EMI ratio > 40%).
 * Tier 2: everything else, ranked by impactScore.
 *
 * This mirrors how an experienced CFP sequences advice: protect first,
 * stabilise cash flow next, then optimise for growth.
 */
function prioritiseCrossPillar(
  recs: Recommendation[],
  ctx: FinancialContext,
): Recommendation[] {
  const protectionUrgent =
    ctx.flags.includes("protection_gap") || ctx.flags.includes("emergency_critical");
  const debtUrgent = ctx.flags.includes("debt_overload");
  const bufferThin =
    ctx.liquidityHealth === "thin" || ctx.liquidityHealth === "critical";

  function tier(r: Recommendation): number {
    if (protectionUrgent && (r.category === "Emergency" || r.category === "Insurance")) return 0;
    if (debtUrgent && r.category === "Debt") return 1;
    return 2;
  }

  // Contextual cross-pillar note — how this action interacts with the others.
  function noteFor(r: Recommendation): string | undefined {
    if (r.category === "Emergency" && bufferThin) {
      return "Fund the buffer before increasing SIPs - otherwise a small shock forces you to redeem investments at the wrong time.";
    }
    if (r.category === "Insurance") {
      return "Term & health cover slightly reduce monthly cash flow but drastically improve resilience - the single highest ROI move when either is missing.";
    }
    if (r.category === "Debt" && debtUrgent) {
      return "Reducing high-EMI debt frees monthly cash for SIPs - a compounding double benefit. Prioritise this over new investment recommendations.";
    }
    if (r.category === "Retirement" && bufferThin) {
      return "Retirement contributions matter, but not at the cost of your 6-month buffer. Build the buffer first, then raise the SIP.";
    }
    if (r.category === "Savings" && ctx.savingsRatePct < 30) {
      return "A steady 30% savings rate matters more than picking better funds. This lever compounds across every other pillar.";
    }
    if (r.category === "Investments" && protectionUrgent) {
      return "Hold new investments until protection (emergency fund + insurance) is in place - otherwise you'll be forced to sell during a crisis.";
    }
    return undefined;
  }

  // Dampen redundancy: keep only the highest-impact rec per category.
  const bestPerCategory = new Map<Recommendation["category"], Recommendation>();
  for (const r of recs) {
    const cur = bestPerCategory.get(r.category);
    if (!cur || r.impactScore > cur.impactScore) bestPerCategory.set(r.category, r);
  }
  const deduped = Array.from(bestPerCategory.values()).map((r) => {
    const note = noteFor(r);
    return note ? { ...r, crossPillarNote: note } : r;
  });

  return deduped.sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    return a.displayOrder - b.displayOrder;
  });
}

export function generateRecommendations(input: NitiCoreInput): Recommendation[] {
  const ctx = evaluateContext(input);
  const raw = RULES
    .map((r) => r(input, ctx))
    .filter((r): r is Recommendation => r !== null);
  return prioritiseCrossPillar(raw, ctx);
}

/**
 * Debug / NitiGuide helper: expose the full deterministic reasoning bundle
 * (context + prioritised recommendations) for downstream layers to consume.
 * Consumed by NitiGuide™ so its explanations always match the engine.
 */
export function generateRecommendationsWithContext(input: NitiCoreInput): {
  context: FinancialContext;
  recommendations: Recommendation[];
} {
  const context = evaluateContext(input);
  const raw = RULES
    .map((r) => r(input, context))
    .filter((r): r is Recommendation => r !== null);
  return { context, recommendations: prioritiseCrossPillar(raw, context) };
}

export type { MetricResult, Recommendation };
