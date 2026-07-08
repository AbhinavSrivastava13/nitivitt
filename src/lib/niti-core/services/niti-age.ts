/**
 * NitiAge™ — Financial Age.
 *
 * Definition: Financial Age = your actual age adjusted by the quality of your
 * money habits (savings rate, emergency buffer, debt load, insurance, investing).
 *
 * Lower financial age than actual age = healthy habits (you are AHEAD).
 * Higher financial age than actual age = habits need work (you are BEHIND).
 *
 * The service returns explicit `direction` and `deltaYears` so every UI
 * consumer renders identical wording, colours and semantics.
 */
import type { MetricResult, NitiCoreInput } from "../types";
import { calculateSavingsRate } from "./savings-rate";
import { calculateEmergencyFund } from "./emergency-fund";
import { calculateDebtRatio } from "./debt-ratio";

export type NitiAgeDirection = "ahead" | "on_track" | "behind";

export interface NitiAgeAiPayload {
  actualAge: number;
  financialAge: number;
  /** Signed: negative = ahead, positive = behind. */
  delta: number;
  /** Always non-negative. */
  deltaYears: number;
  direction: NitiAgeDirection;
  interpretation: string;
}

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

  // Signed delta: financial age minus actual age.
  // Negative delta = financial age is lower = healthy habits = AHEAD.
  const delta = financialAge - input.ageYears;
  const deltaYears = Math.abs(delta);
  const direction: NitiAgeDirection = delta < 0 ? "ahead" : delta > 0 ? "behind" : "on_track";

  const interpretation =
    direction === "ahead"
      ? `Your financial age is ${deltaYears} year${deltaYears === 1 ? "" : "s"} lower than your actual age - your money habits are healthier than average for your age.`
      : direction === "behind"
        ? `Your financial age is ${deltaYears} year${deltaYears === 1 ? "" : "s"} higher than your actual age - your habits need to catch up with where you are in life.`
        : `Your financial age matches your actual age - you are exactly where you should be.`;

  const aiPayload: NitiAgeAiPayload = {
    actualAge: input.ageYears,
    financialAge,
    delta,
    deltaYears,
    direction,
    interpretation,
  };

  return {
    metric: "niti_age",
    value: financialAge,
    unit: "years",
    status: direction === "ahead" ? "on_track" : direction === "on_track" ? "needs_attention" : "critical",
    explanationKey: "age.financial",
    assumptions: { bound: 10 },
    calculationSummary: `Actual ${input.ageYears} + adjust ${adjust} = ${financialAge} (${direction})`,
    priority: direction === "behind" && deltaYears >= 4 ? "high" : direction === "behind" ? "medium" : "low",
    suggestedNextStep:
      direction === "behind"
        ? "Focus on the top NitiPath™ actions - savings rate and emergency buffer move NitiAge the fastest."
        : direction === "on_track"
          ? "Solid - a small boost to savings rate or emergency months will move you into 'ahead'."
          : "You're financially ahead of your years - protect it by keeping insurance current and investments automated.",
    aiPayload: aiPayload as unknown as Record<string, unknown>,
  };
}
