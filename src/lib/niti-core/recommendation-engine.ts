/**
 * Centralized recommendation engine.
 *
 * Consumes deterministic MetricResult outputs from NitiCore™ services and
 * produces prioritized Recommendation objects. Adding a new rule is a pure
 * function — no UI or AI is involved.
 */
import type { MetricResult, NitiCoreInput, Recommendation } from "./types";
import {
  calculateEmergencyFund,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateInsuranceAdequacy,
  calculateRetirement,
} from "./services";

type Rule = (input: NitiCoreInput) => Recommendation | null;

const emergencyFundRule: Rule = (input) => {
  const r = calculateEmergencyFund(input);
  if (r.status === "on_track") return null;
  return {
    id: "rec_emergency_fund",
    title: "Build a 6-month emergency fund",
    category: "Emergency",
    priority: r.priority,
    severity: r.status === "critical" ? "critical" : "warning",
    explanation: "Emergencies cost cash. Without a buffer you'll borrow at 15–24% interest.",
    logic: "Aim for ≥ 6× monthly essential expenses in a liquid fund.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — protects every other financial goal.",
    effort: "low",
    nextAction: r.suggestedNextStep,
    displayOrder: 10,
  };
};

const insuranceRule: Rule = (input) => {
  const r = calculateInsuranceAdequacy(input);
  if (r.status === "on_track") return null;
  return {
    id: "rec_insurance",
    title: "Close your insurance gap",
    category: "Insurance",
    priority: r.priority,
    severity: r.status === "critical" ? "critical" : "warning",
    explanation: "One hospitalisation or income loss can undo a decade of planning.",
    logic: "Term cover ≥ 15× annual income; health cover ≥ ₹10 L family-floater.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — protects dependents and savings.",
    effort: "low",
    nextAction: r.suggestedNextStep,
    displayOrder: 20,
  };
};

const debtRule: Rule = (input) => {
  const r = calculateDebtRatio(input);
  if (r.status === "on_track") return null;
  return {
    id: "rec_debt",
    title: "Bring EMI ratio under 20%",
    category: "Debt",
    priority: r.priority,
    severity: r.status === "critical" ? "critical" : "warning",
    explanation: "High EMIs starve investments and destroy compounding.",
    logic: "EMI-to-income ratio should stay under 20% (healthy) / 40% (max).",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — frees monthly cash for investments.",
    effort: "medium",
    nextAction: r.suggestedNextStep,
    displayOrder: 30,
  };
};

const savingsRule: Rule = (input) => {
  const r = calculateSavingsRate(input);
  if (r.status === "on_track") return null;
  return {
    id: "rec_savings",
    title: "Raise savings rate to 30%",
    category: "Savings",
    priority: r.priority,
    severity: r.status === "critical" ? "critical" : "warning",
    explanation: "Savings rate is the single biggest lever for long-term wealth.",
    logic: "(Income − Expenses)/Income × 100 should be ≥ 30%.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "Very high — compounds for decades.",
    effort: "medium",
    nextAction: r.suggestedNextStep,
    displayOrder: 40,
  };
};

const retirementRule: Rule = (input) => {
  const r = calculateRetirement(input);
  if (r.status === "on_track") return null;
  return {
    id: "rec_retirement",
    title: "Close your retirement gap",
    category: "Retirement",
    priority: r.priority,
    severity: r.status === "critical" ? "critical" : "warning",
    explanation: "Retirement is a fixed date; the earlier you act, the smaller the SIP.",
    logic: "Corpus needed ≈ future annual expenses ÷ withdrawal rate.",
    assumptions: r.assumptions,
    formulaSummary: r.calculationSummary,
    impact: "High — quality of life for 25+ years.",
    effort: "medium",
    nextAction: r.suggestedNextStep,
    displayOrder: 50,
  };
};

const RULES: Rule[] = [emergencyFundRule, insuranceRule, debtRule, savingsRule, retirementRule];

export function generateRecommendations(input: NitiCoreInput): Recommendation[] {
  return RULES
    .map((r) => r(input))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 } as const;
      return p[a.priority] - p[b.priority] || a.displayOrder - b.displayOrder;
    });
}

export type { MetricResult, Recommendation };
