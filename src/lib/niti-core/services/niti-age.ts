/**
 * NitiAge™ — Financial Age. Actual age ± adjustments bounded to ±10 years.
 */
import type { MetricResult, NitiCoreInput } from "../types";
import { calculateSavingsRate } from "./savings-rate";
import { calculateEmergencyFund } from "./emergency-fund";
import { calculateDebtRatio } from "./debt-ratio";

export function calculateNitiAge(input: NitiCoreInput): MetricResult<number> {
  let adjust = 0;
  const sr = Number(calculateSavingsRate(input).value);
  const ef = Number(calculateEmergencyFund(input).value);
  const dr = Number(calculateDebtRatio(input).value);

  if (sr >= 30) adjust -= 3;
  else if (sr < 10) adjust += 3;

  if (ef >= 6) adjust -= 3;
  else if (ef < 1) adjust += 3;

  if (dr <= 20) adjust -= 2;
  else if (dr > 40) adjust += 3;

  if (input.hasTermInsurance && input.hasHealthInsurance) adjust -= 1;
  else adjust += 2;

  if (input.monthlyInvestments > input.monthlyIncome * 0.15) adjust -= 1;

  adjust = Math.max(-10, Math.min(10, adjust));
  const financialAge = Math.max(18, input.ageYears + adjust);

  return {
    metric: "niti_age",
    value: financialAge,
    unit: "years",
    status: adjust <= 0 ? "on_track" : adjust <= 3 ? "needs_attention" : "critical",
    explanationKey: "age.financial",
    assumptions: { bound: 10 },
    calculationSummary: `Actual ${input.ageYears} + adjust ${adjust} = ${financialAge}`,
    priority: adjust > 3 ? "high" : "medium",
    suggestedNextStep:
      adjust > 0
        ? "Improve savings rate and emergency buffer to reduce your financial age."
        : "You're financially ahead of your years — keep going.",
    aiPayload: { actualAge: input.ageYears, financialAge, delta: adjust },
  };
}
