import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult, NitiCoreInput } from "../types";

/** Retirement corpus using the 25× / 4% rule, inflation-adjusted. */
export function calculateRetirement(input: NitiCoreInput): MetricResult {
  const yearsToRetirement = Math.max(0, input.retirementAge - input.ageYears);
  const futureMonthlyExp =
    input.monthlyExpenses * Math.pow(1 + NITI_CORE_CONFIG.inflation, yearsToRetirement);
  const futureAnnualExp = futureMonthlyExp * 12;
  const requiredCorpus = futureAnnualExp / NITI_CORE_CONFIG.retirementWithdrawalRate;
  const projected =
    input.retirementCorpus *
    Math.pow(1 + NITI_CORE_CONFIG.equityReturn * 0.6 + NITI_CORE_CONFIG.debtReturn * 0.4, yearsToRetirement);
  const gap = Math.max(0, requiredCorpus - projected);
  const status =
    projected >= requiredCorpus
      ? "on_track"
      : projected >= requiredCorpus * 0.5
        ? "needs_attention"
        : "critical";
  return {
    metric: "retirement",
    value: Math.round(gap),
    unit: "INR",
    status,
    explanationKey: "retirement.gap",
    assumptions: {
      inflation: NITI_CORE_CONFIG.inflation,
      withdrawalRate: NITI_CORE_CONFIG.retirementWithdrawalRate,
      yearsToRetirement,
    },
    calculationSummary: `Required ${Math.round(requiredCorpus)} − Projected ${Math.round(projected)} = ${Math.round(gap)}`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep:
      gap > 0
        ? "Increase monthly retirement contribution (SIP/NPS/EPF) to close the gap."
        : "Stay the course - rebalance yearly.",
    aiPayload: { requiredCorpus, projected, gap },
  };
}
