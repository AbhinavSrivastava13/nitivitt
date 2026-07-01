import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult, NitiCoreInput } from "../types";

export function calculateEmergencyFund(input: NitiCoreInput): MetricResult {
  const monthsTarget =
    input.employmentType === "self_employed"
      ? NITI_CORE_CONFIG.emergencyFundMonths.selfEmployed
      : NITI_CORE_CONFIG.emergencyFundMonths.salaried;
  const monthsCovered =
    input.monthlyEssentialExpenses > 0
      ? input.liquidAssets / input.monthlyEssentialExpenses
      : 0;
  const gap = Math.max(0, monthsTarget * input.monthlyEssentialExpenses - input.liquidAssets);
  const status =
    monthsCovered >= monthsTarget
      ? "on_track"
      : monthsCovered >= monthsTarget / 2
        ? "needs_attention"
        : "critical";

  return {
    metric: "emergency_fund",
    value: Number(monthsCovered.toFixed(2)),
    unit: "months",
    status,
    explanationKey: "emergency.months_covered",
    assumptions: { monthsTarget, employmentType: input.employmentType ?? "salaried" },
    calculationSummary: `${input.liquidAssets} / ${input.monthlyEssentialExpenses} = ${monthsCovered.toFixed(2)} months`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep:
      gap > 0
        ? `Build ₹${Math.round(gap).toLocaleString("en-IN")} more in a liquid fund.`
        : "Maintain buffer; rebalance annually.",
    aiPayload: { monthsCovered, monthsTarget, gap },
  };
}
