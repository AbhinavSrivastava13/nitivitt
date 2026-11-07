/** NitiScore™ - the canonical 0-1000 weighted NitiCore score. */
import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult, NitiCoreGoal, NitiCoreInput } from "../types";
import { calculateSavingsRate } from "./savings-rate";
import { calculateEmergencyFund } from "./emergency-fund";
import { calculateDebtRatio } from "./debt-ratio";
import { calculateInsuranceAdequacy } from "./insurance";
import { calculateRetirement } from "./retirement";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface NitiScoreBreakdown {
  pillar: string;
  weight: number;
  pillarScore: number | null;
  weighted: number;
  reason: string;
}

function priorityWeight(priority: string): number {
  if (priority.toLowerCase() === "high") return 3;
  if (priority.toLowerCase() === "low") return 1;
  return 2;
}

export function scoreGoal(goal: NitiCoreGoal, now = Date.now()): number | null {
  const createdAt = new Date(goal.createdAt).getTime();
  const targetDate = goal.targetDate ? new Date(goal.targetDate).getTime() : Number.NaN;
  if (!Number.isFinite(createdAt) || !Number.isFinite(targetDate) || targetDate <= createdAt || goal.targetAmount <= 0) return null;

  const elapsedFraction = clamp(((now - createdAt) / (targetDate - createdAt)) * 100) / 100;
  const expectedProgress = goal.targetAmount * elapsedFraction;
  if (expectedProgress <= 0) return goal.currentProgress >= 0 ? 100 : 0;
  return clamp((goal.currentProgress / expectedProgress) * 100);
}

export function scoreGoals(goals: NitiCoreGoal[], now = Date.now()): { score: number | null; reason: string } {
  if (goals.length === 0) return { score: null, reason: "Not scored - no goals added." };
  const scored = goals.flatMap((goal) => {
    const score = scoreGoal(goal, now);
    return score === null ? [] : [{ score, weight: priorityWeight(goal.priority) }];
  });
  if (scored.length === 0) return { score: null, reason: "Not scored - add a target date and target amount to your goals." };
  const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
  const average = scored.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  return {
    score: average,
    reason: `${scored.length} goal${scored.length === 1 ? "" : "s"} compared with expected progress by date, weighted by priority.`,
  };
}

export function calculateNitiScore(input: NitiCoreInput): MetricResult<number> & {
  breakdown: NitiScoreBreakdown[];
  grade: string;
} {
  const weights = NITI_CORE_CONFIG.scoreWeights;
  const savings = calculateSavingsRate(input);
  const emergency = calculateEmergencyFund(input);
  const debt = calculateDebtRatio(input);
  const insurance = calculateInsuranceAdequacy(input);
  const retirement = calculateRetirement(input);
  const goalResult = scoreGoals(input.goals ?? []);

  const pillarScores: Array<{ pillar: string; key: keyof typeof weights; score: number | null; reason: string }> = [
    { pillar: "Savings", key: "savings", score: clamp((Number(savings.value) / 30) * 100), reason: savings.calculationSummary },
    { pillar: "Emergency", key: "emergency", score: clamp((Number(emergency.value) / 6) * 100), reason: emergency.calculationSummary },
    { pillar: "Debt", key: "debt", score: clamp(100 - (Number(debt.value) / 40) * 100), reason: debt.calculationSummary },
    { pillar: "Insurance", key: "insurance", score: clamp(Number(insurance.value)), reason: insurance.calculationSummary },
    { pillar: "Goals", key: "goals", score: goalResult.score, reason: goalResult.reason },
    { pillar: "Retirement", key: "retirement", score: retirement.status === "on_track" ? 100 : retirement.status === "needs_attention" ? 60 : 25, reason: retirement.calculationSummary },
    { pillar: "Investments", key: "investments", score: input.monthlyIncome > 0 ? clamp((input.monthlyInvestments / (input.monthlyIncome * 0.2)) * 100) : 0, reason: "Monthly investments vs. 20% of income target." },
  ];

  const availableWeight = Object.entries(weights).reduce((sum, [key, weight]) => sum + (key === "goals" ? 0 : weight), 0);
  const scoreWeightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const breakdown: NitiScoreBreakdown[] = pillarScores.map(({ pillar, key, score, reason }) => {
    const configuredWeight = weights[key];
    const effectiveWeight = score === null
      ? 0
      : goalResult.score === null
        ? key === "goals" ? 0 : (configuredWeight / availableWeight) * scoreWeightTotal
        : configuredWeight;
    return {
      pillar,
      weight: effectiveWeight,
      pillarScore: score,
      weighted: score === null ? 0 : (score * effectiveWeight) / scoreWeightTotal,
      reason,
    };
  });

  const scoreOn100 = Math.round(breakdown.reduce((sum, item) => sum + item.weighted, 0));
  const scoreOn1000 = Math.round(scoreOn100 * 10);
  const grade = NITI_CORE_CONFIG.scoreGrades.find((item) => scoreOn1000 >= item.min)?.grade ?? "D";
  const status = scoreOn100 >= 70 ? "on_track" : scoreOn100 >= 50 ? "needs_attention" : "critical";
  const appliedWeights = Object.fromEntries(breakdown.map((item) => [item.pillar, item.weight]));

  return {
    metric: "niti_score",
    value: scoreOn1000,
    unit: "/1000",
    status,
    explanationKey: "score.composite",
    assumptions: { weightsJson: JSON.stringify(appliedWeights) },
    calculationSummary: `Σ(pillar × weight) = ${scoreOn100}/100 → ${scoreOn1000}/1000 (${grade})`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep: "Fix the lowest-scoring pillar first - biggest lift per rupee.",
    aiPayload: { scoreOn100, breakdown },
    breakdown,
    grade,
  };
}