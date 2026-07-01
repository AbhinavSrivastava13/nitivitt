import type { MetricResult, NitiCoreInput } from "../types";

export function calculateNetWorth(input: NitiCoreInput): MetricResult {
  const value = input.totalAssets - input.totalLiabilities;
  const status = value >= 0 ? "on_track" : "critical";
  return {
    metric: "net_worth",
    value,
    unit: "INR",
    status,
    explanationKey: "netWorth.total",
    assumptions: {},
    calculationSummary: `${input.totalAssets} - ${input.totalLiabilities} = ${value}`,
    priority: value < 0 ? "high" : "low",
    suggestedNextStep:
      value < 0
        ? "Bring liabilities below assets — prepay costly debt first."
        : "Grow productive assets (equity/index) and track quarterly.",
    aiPayload: { value },
  };
}
