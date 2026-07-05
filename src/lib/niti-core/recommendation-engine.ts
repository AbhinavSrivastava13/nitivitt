/**
 * Centralized recommendation engine.
 *
 * Consumes deterministic MetricResult outputs from NitiCore™ services and
 * produces prioritized Recommendation objects. Adding a new rule is a pure
 * function — no UI or AI is involved.
 *
 * v2: recommendations are ranked GLOBALLY by a deterministic `impactScore`
 * that combines pillar weight, severity of the shortfall, and effort.
 * Individual scoring formulas in each pillar service are UNTOUCHED — only
 * the ranking + presentation layer here changes.
 */
import type { MetricResult, NitiCoreInput, Recommendation, Priority } from "./types";
import {
  calculateEmergencyFund,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateInsuranceAdequacy,
  calculateRetirement,
} from "./services";

type Rule = (input: NitiCoreInput) => Recommendation | null;

/**
 * Global impact heuristic. Uses ONLY existing deterministic signals:
 *   priority ∈ {high, medium, low}
 *   severity ∈ {critical, warning, info, success}
 *   effort   ∈ {low, medium, high}
 *   pillarWeight (0..1) — how much the pillar affects the composite NitiScore.
 * Higher = act sooner.
 */
function computeImpactScore(args: {
  priority: Priority;
  severity: Recommendation["severity"];
  effort: Recommendation["effort"];
  pillarWeight: number;
}): number {
  const priorityScore = { high: 100, medium: 60, low: 30 }[args.priority];
  const severityMul = { critical: 1.4, warning: 1.1, info: 0.9, success: 0.5 }[args.severity];
  const effortMul = { low: 1.2, medium: 1.0, high: 0.85 }[args.effort];
  return Math.round(priorityScore * severityMul * effortMul * (0.5 + args.pillarWeight));
}

const emergencyFundRule: Rule = (input) => {
  const r = calculateEmergencyFund(input);
  if (r.status === "on_track") return null;
  const priority = r.priority;
  const severity = r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "low";
  return {
    id: "rec_emergency_fund",
    title: "Build a 6-month emergency fund",
    category: "Emergency",
    priority,
    severity,
    explanation: "Emergencies cost cash. Without a buffer you'll borrow at 15–24% interest.",
    whyItMatters:
      "A buffer means one hospital bill or job change doesn't force you to break long-term investments or take costly loans. It's the foundation every other goal sits on.",
    expectedImpact:
      "Lifts the Emergency pillar towards 100/100 and stabilises your NitiScore. Also lowers stress-driven debt risk.",
    logic: "Aim for ≥ 6× monthly essential expenses in a liquid fund.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — protects every other financial goal.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 10,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.15 }),
  };
};

const insuranceRule: Rule = (input) => {
  const r = calculateInsuranceAdequacy(input);
  if (r.status === "on_track") return null;
  const priority = r.priority;
  const severity = r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "low";
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
    logic: "Term cover ≥ 15× annual income; health cover ≥ ₹10 L family-floater.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — protects dependents and savings.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 20,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.15 }),
  };
};

const debtRule: Rule = (input) => {
  const r = calculateDebtRatio(input);
  if (r.status === "on_track") return null;
  const priority = r.priority;
  const severity = r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";
  return {
    id: "rec_debt",
    title: "Bring EMI ratio under 20%",
    category: "Debt",
    priority,
    severity,
    explanation: "High EMIs starve investments and destroy compounding.",
    whyItMatters:
      "Every rupee going to EMIs at 9–14% can't compound in equity at 11–13%. Reducing EMIs frees monthly cash for SIPs and cuts the risk of a cash-flow crunch.",
    expectedImpact:
      "Lowers debt ratio, improves the Debt pillar, and unlocks more room for investments — a compounding double-benefit over 10+ years.",
    logic: "EMI-to-income ratio should stay under 20% (healthy) / 40% (max).",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — frees monthly cash for investments.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 30,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.15 }),
  };
};

const savingsRule: Rule = (input) => {
  const r = calculateSavingsRate(input);
  if (r.status === "on_track") return null;
  const priority = r.priority;
  const severity = r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";
  return {
    id: "rec_savings",
    title: "Raise savings rate to 30%",
    category: "Savings",
    priority,
    severity,
    explanation: "Savings rate is the single biggest lever for long-term wealth.",
    whyItMatters:
      "Over 20–30 years, savings rate matters more than return rate. A steady 30% put into an index SIP outperforms clever picks with a 15% rate.",
    expectedImpact:
      "Directly increases the Savings pillar of your NitiScore and materially improves retirement readiness and goal timelines.",
    logic: "(Income − Expenses)/Income × 100 should be ≥ 30%.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "Very high — compounds for decades.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 40,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.2 }),
  };
};

const retirementRule: Rule = (input) => {
  const r = calculateRetirement(input);
  if (r.status === "on_track") return null;
  const priority = r.priority;
  const severity = r.status === "critical" ? "critical" : "warning";
  const effort: Recommendation["effort"] = "medium";
  return {
    id: "rec_retirement",
    title: "Close your retirement gap",
    category: "Retirement",
    priority,
    severity,
    explanation: "Retirement is a fixed date; the earlier you act, the smaller the SIP.",
    whyItMatters:
      "A ₹5,000 monthly gap at 30 becomes a ₹20,000 gap at 45 for the same corpus. Starting early is the single cheapest way to buy a comfortable retirement.",
    expectedImpact:
      "Improves the Retirement pillar of your NitiScore and pulls the retirement gap closer to zero year on year.",
    logic: "Corpus needed ≈ future annual expenses ÷ withdrawal rate.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — quality of life for 25+ years.",
    effort,
    nextAction: r.suggestedNextStep,
    displayOrder: 50,
    impactScore: computeImpactScore({ priority, severity, effort, pillarWeight: 0.15 }),
  };
};

const RULES: Rule[] = [emergencyFundRule, insuranceRule, debtRule, savingsRule, retirementRule];

export function generateRecommendations(input: NitiCoreInput): Recommendation[] {
  return RULES
    .map((r) => r(input))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.impactScore - a.impactScore || a.displayOrder - b.displayOrder);
}

export type { MetricResult, Recommendation };
