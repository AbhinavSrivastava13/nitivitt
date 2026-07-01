import type { MetricResult, NitiCoreInput } from "../types";

export function calculateAssetAllocation(input: NitiCoreInput): MetricResult {
  const baseEquity = Math.max(20, Math.min(90, 100 - input.ageYears));
  const adjust =
    input.riskProfile === "aggressive" ? 10 : input.riskProfile === "conservative" ? -10 : 0;
  const equityPct = Math.max(10, Math.min(95, baseEquity + adjust));
  return {
    metric: "asset_allocation",
    value: equityPct,
    unit: "% equity",
    status: "on_track",
    explanationKey: "allocation.equity_pct",
    assumptions: { risk: input.riskProfile ?? "moderate" },
    calculationSummary: `100 - ${input.ageYears} + risk_adjust(${adjust}) = ${equityPct}% equity`,
    priority: "low",
    suggestedNextStep: `Aim for ~${equityPct}% equity / ${100 - equityPct}% debt.`,
    aiPayload: { equityPct, debtPct: 100 - equityPct },
  };
}
