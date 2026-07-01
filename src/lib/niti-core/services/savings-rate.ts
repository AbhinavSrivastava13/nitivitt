import type { MetricResult, NitiCoreInput } from "../types";

export function calculateSavingsRate(input: NitiCoreInput): MetricResult {
  const rate =
    input.monthlyIncome > 0
      ? (input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome
      : 0;
  const pct = rate * 100;
  const status =
    pct >= 30 ? "on_track" : pct >= 15 ? "needs_attention" : "critical";
  return {
    metric: "savings_rate",
    value: Number(pct.toFixed(2)),
    unit: "%",
    status,
    explanationKey: "savings.rate",
    assumptions: { targetPct: 30 },
    calculationSummary: `(${input.monthlyIncome} - ${input.monthlyExpenses}) / ${input.monthlyIncome} × 100 = ${pct.toFixed(1)}%`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep:
      pct < 30
        ? "Cut discretionary expenses or grow income to reach a 30% savings rate."
        : "Direct extra savings into goal-aligned investments.",
    aiPayload: { rate: pct },
  };
}
