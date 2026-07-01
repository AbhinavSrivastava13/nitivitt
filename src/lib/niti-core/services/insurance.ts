import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult, NitiCoreInput } from "../types";

export function calculateInsuranceAdequacy(input: NitiCoreInput): MetricResult {
  const annualIncome = input.monthlyIncome * 12;
  const recommendedTerm = Math.max(
    NITI_CORE_CONFIG.termLifeMultiplier * annualIncome,
    input.totalLiabilities,
  );
  const termGap = Math.max(0, recommendedTerm - input.termCover);
  const bothPresent = input.hasTermInsurance && input.hasHealthInsurance;
  const status = bothPresent && termGap === 0 ? "on_track" : bothPresent ? "needs_attention" : "critical";
  return {
    metric: "insurance_adequacy",
    value: Number(((1 - termGap / Math.max(1, recommendedTerm)) * 100).toFixed(2)),
    unit: "%",
    status,
    explanationKey: "insurance.term_cover",
    assumptions: {
      termMultiplier: NITI_CORE_CONFIG.termLifeMultiplier,
      hasTerm: input.hasTermInsurance,
      hasHealth: input.hasHealthInsurance,
    },
    calculationSummary: `max(${NITI_CORE_CONFIG.termLifeMultiplier}×${annualIncome}, ${input.totalLiabilities}) = ${recommendedTerm}`,
    priority: status === "critical" ? "high" : status === "needs_attention" ? "medium" : "low",
    suggestedNextStep: !input.hasTermInsurance
      ? "Buy a pure term-life policy that covers 15× your annual income."
      : !input.hasHealthInsurance
        ? "Get a family-floater health policy of at least ₹10 L."
        : termGap > 0
          ? `Top up term cover by ₹${Math.round(termGap).toLocaleString("en-IN")}.`
          : "Cover is adequate. Review annually.",
    aiPayload: { recommendedTerm, termGap },
  };
}
