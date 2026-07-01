/**
 * NitiScore™ — 0–1000 composite score composed of weighted pillar scores.
 * The 6-pillar breakdown is deterministic and shown in every UI.
 */
import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult, NitiCoreInput } from "../types";
import { calculateSavingsRate } from "./savings-rate";
import { calculateEmergencyFund } from "./emergency-fund";
import { calculateDebtRatio } from "./debt-ratio";
import { calculateInsuranceAdequacy } from "./insurance";
import { calculateRetirement } from "./retirement";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export interface NitiScoreBreakdown {
  pillar: string;
  weight: number;
  pillarScore: number; // 0-100
  weighted: number;
  reason: string;
}

export function calculateNitiScore(input: NitiCoreInput): MetricResult<number> & {
  breakdown: NitiScoreBreakdown[];
  grade: string;
} {
  const w = NITI_CORE_CONFIG.scoreWeights;

  const sr = calculateSavingsRate(input);
  const ef = calculateEmergencyFund(input);
  const dr = calculateDebtRatio(input);
  const ins = calculateInsuranceAdequacy(input);
  const ret = calculateRetirement(input);

  const savingsPillar = clamp((Number(sr.value) / 30) * 100);
  const emergencyPillar = clamp((Number(ef.value) / 6) * 100);
  const debtPillar = clamp(100 - (Number(dr.value) / 40) * 100);
  const insurancePillar = clamp(Number(ins.value));
  const investPillar =
    input.monthlyIncome > 0 ? clamp((input.monthlyInvestments / (input.monthlyIncome * 0.2)) * 100) : 0;
  const retirementPillar =
    ret.status === "on_track" ? 100 : ret.status === "needs_attention" ? 60 : 25;
  const goalsPillar = 60; // Placeholder — recomputed once user has goals mapped.

  const breakdown: NitiScoreBreakdown[] = [
    { pillar: "Savings", weight: w.savings, pillarScore: savingsPillar, weighted: (savingsPillar * w.savings) / 100, reason: sr.calculationSummary },
    { pillar: "Emergency", weight: w.emergency, pillarScore: emergencyPillar, weighted: (emergencyPillar * w.emergency) / 100, reason: ef.calculationSummary },
    { pillar: "Debt", weight: w.debt, pillarScore: debtPillar, weighted: (debtPillar * w.debt) / 100, reason: dr.calculationSummary },
    { pillar: "Insurance", weight: w.insurance, pillarScore: insurancePillar, weighted: (insurancePillar * w.insurance) / 100, reason: ins.calculationSummary },
    { pillar: "Goals", weight: w.goals, pillarScore: goalsPillar, weighted: (goalsPillar * w.goals) / 100, reason: "Placeholder — implement per-goal scoring." },
    { pillar: "Retirement", weight: w.retirement, pillarScore: retirementPillar, weighted: (retirementPillar * w.retirement) / 100, reason: ret.calculationSummary },
    { pillar: "Investments", weight: w.investments, pillarScore: investPillar, weighted: (investPillar * w.investments) / 100, reason: "Monthly investments vs. 20% of income target." },
  ];

  const scoreOn100 = Math.round(breakdown.reduce((a, b) => a + b.weighted, 0));
  const scoreOn1000 = Math.round(scoreOn100 * 10);
  const grade = NITI_CORE_CONFIG.scoreGrades.find((g) => scoreOn1000 >= g.min)?.grade ?? "D";
  const status = scoreOn100 >= 70 ? "on_track" : scoreOn100 >= 50 ? "needs_attention" : "critical";

  return {
    metric: "niti_score",
    value: scoreOn1000,
    unit: "/1000",
    status,
    explanationKey: "score.composite",
    assumptions: { weights: w as unknown as Record<string, number> },
    calculationSummary: `Σ(pillar × weight) = ${scoreOn100}/100 → ${scoreOn1000}/1000 (${grade})`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep: "Fix the lowest-scoring pillar first — biggest lift per rupee.",
    aiPayload: { scoreOn100, breakdown },
    breakdown,
    grade,
  };
}
