import type { MetricResult, NitiCoreInput } from "../types";

export function calculateDebtRatio(input: NitiCoreInput): MetricResult {
  const ratio =
    input.monthlyIncome > 0 ? (input.monthlyEmi / input.monthlyIncome) * 100 : 0;
  const status = ratio <= 20 ? "on_track" : ratio <= 40 ? "needs_attention" : "critical";
  return {
    metric: "debt_ratio",
    value: Number(ratio.toFixed(2)),
    unit: "%",
    status,
    explanationKey: "debt.emi_ratio",
    assumptions: { healthyMax: 20, criticalAbove: 40 },
    calculationSummary: `${input.monthlyEmi} / ${input.monthlyIncome} × 100 = ${ratio.toFixed(1)}%`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep:
      ratio > 40
        ? "Consolidate or prepay high-interest debt; avoid new EMIs."
        : ratio > 20
          ? "Keep new EMIs off-limits and prepay costliest loan first."
          : "Debt is under control.",
    aiPayload: { ratio },
  };
}
