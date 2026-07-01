import { NITI_CORE_CONFIG } from "../config";
import type { MetricResult } from "../types";

export function calculateGoalPlan(input: {
  presentCost: number;
  years: number;
  expectedReturn?: number;
  currentSavings?: number;
}): MetricResult {
  const rate = input.expectedReturn ?? NITI_CORE_CONFIG.hybridReturn;
  const futureValue =
    input.presentCost * Math.pow(1 + NITI_CORE_CONFIG.inflation, input.years);
  const projectedCurrent = (input.currentSavings ?? 0) * Math.pow(1 + rate, input.years);
  const gap = Math.max(0, futureValue - projectedCurrent);
  const months = Math.max(1, input.years * 12);
  const r = rate / 12;
  const requiredSip =
    r === 0
      ? gap / months
      : gap / (((Math.pow(1 + r, months) - 1) / r) * (1 + r));

  return {
    metric: "goal_plan",
    value: Math.round(requiredSip),
    unit: "INR/month",
    status: "on_track",
    explanationKey: "goal.required_sip",
    assumptions: { inflation: NITI_CORE_CONFIG.inflation, expectedReturn: rate },
    calculationSummary: `FV=${Math.round(futureValue)}, gap=${Math.round(gap)}, SIP=${Math.round(requiredSip)}/mo`,
    priority: "medium",
    suggestedNextStep: `Automate ₹${Math.round(requiredSip).toLocaleString("en-IN")}/month into a goal-mapped fund.`,
    aiPayload: { futureValue, gap, requiredSip },
  };
}
