/**
 * FinancialContext — the holistic situational read of a user's finances.
 *
 * NitiCore™ services compute individual metrics. The recommendation engine
 * needs to reason ACROSS those metrics like an experienced Certified Financial
 * Planner would: understand life stage, protection posture, liquidity health,
 * monthly surplus, wealth-building capacity, and opportunity cost — BEFORE
 * generating any recommendation.
 *
 * Everything here is deterministic. No AI. No randomness. Same input → same
 * context → same recommendations.
 */
import type { NitiCoreInput } from "./types";
import { calculateEmergencyFund } from "./services/emergency-fund";
import { calculateSavingsRate } from "./services/savings-rate";
import { calculateDebtRatio } from "./services/debt-ratio";
import { calculateInsuranceAdequacy } from "./services/insurance";

export type LifeStage =
  | "early_career" // 18–29
  | "family_building" // 30–44
  | "peak_earning" // 45–54
  | "pre_retirement" // 55–64
  | "retirement"; // 65+

export type ProtectionPosture = "unprotected" | "partial" | "protected";
export type LiquidityHealth = "critical" | "thin" | "adequate" | "excess";
export type WealthStage = "accumulation" | "consolidation" | "preservation";

export interface FinancialContext {
  lifeStage: LifeStage;
  wealthStage: WealthStage;
  protectionPosture: ProtectionPosture;
  liquidityHealth: LiquidityHealth;

  /** Monthly cash left after expenses AND EMIs — the true investable surplus. */
  monthlySurplus: number;
  /** Surplus as % of income (0–100). */
  surplusPct: number;

  /** Emergency months covered — cached from calc. */
  emergencyMonths: number;
  /** EMI-to-income ratio (%). */
  debtRatioPct: number;
  /** Savings rate (%). */
  savingsRatePct: number;
  /** Insurance adequacy (%). */
  insuranceAdequacyPct: number;

  /** True if the user has dependents (defaults to conservative "yes" when unknown & 30+). */
  hasDependents: boolean;

  /**
   * Ordered list of situational flags a CFP would notice at first glance.
   * Used by the recommendation engine to tune priority and trade-offs.
   */
  flags: ContextFlag[];
}

export type ContextFlag =
  | "protection_gap" // no term or health cover, with dependents
  | "emergency_critical" // < 2 months buffer
  | "emergency_thin" // 2–5 months buffer
  | "debt_overload" // EMI ratio > 40%
  | "debt_elevated" // EMI ratio 20–40%
  | "cash_flow_tight" // surplus < 10% of income
  | "under_invested" // surplus healthy but investing < 10% of income
  | "over_liquid" // > 12 months buffer while investing < 10%
  | "retirement_late_start" // 45+ with weak retirement position
  | "wealth_building_ready" // protection + buffer done, surplus available
  | "portfolio_concentrated" // NitiInvest™ flagged high concentration
  | "portfolio_weak" // NitiInvest™ score < 55
  | "insurance_reviewed_gap" // NitiSure™ portfolio score < 60
  | "cross_service_imbalance"; // strong investments but weak protection

function lifeStageFromAge(age: number): LifeStage {
  if (age < 30) return "early_career";
  if (age < 45) return "family_building";
  if (age < 55) return "peak_earning";
  if (age < 65) return "pre_retirement";
  return "retirement";
}

function wealthStageFromAge(age: number): WealthStage {
  if (age < 45) return "accumulation";
  if (age < 60) return "consolidation";
  return "preservation";
}

export function evaluateContext(input: NitiCoreInput): FinancialContext {
  const ef = calculateEmergencyFund(input);
  const sr = calculateSavingsRate(input);
  const dr = calculateDebtRatio(input);
  const ins = calculateInsuranceAdequacy(input);

  const emergencyMonths = Number(ef.value);
  const savingsRatePct = Number(sr.value);
  const debtRatioPct = Number(dr.value);
  const insuranceAdequacyPct = Number(ins.value);

  const monthlySurplus = Math.max(
    0,
    input.monthlyIncome - input.monthlyExpenses - input.monthlyEmi,
  );
  const surplusPct =
    input.monthlyIncome > 0 ? (monthlySurplus / input.monthlyIncome) * 100 : 0;

  const lifeStage = lifeStageFromAge(input.ageYears);
  const wealthStage = wealthStageFromAge(input.ageYears);

  // Dependents: prefer explicit count, else infer conservatively.
  const hasDependents =
    typeof input.dependentsCount === "number"
      ? input.dependentsCount > 0
      : input.ageYears >= 30; // reasonable Indian default

  // Protection posture — CFP treats missing term/health with dependents as top-priority.
  let protectionPosture: ProtectionPosture = "protected";
  if (!input.hasTermInsurance && !input.hasHealthInsurance) protectionPosture = "unprotected";
  else if (!input.hasTermInsurance || !input.hasHealthInsurance || insuranceAdequacyPct < 60)
    protectionPosture = "partial";

  // Liquidity health.
  let liquidityHealth: LiquidityHealth = "adequate";
  if (emergencyMonths < 2) liquidityHealth = "critical";
  else if (emergencyMonths < 6) liquidityHealth = "thin";
  else if (emergencyMonths > 12) liquidityHealth = "excess";

  const investmentRate =
    input.monthlyIncome > 0 ? (input.monthlyInvestments / input.monthlyIncome) * 100 : 0;

  const flags: ContextFlag[] = [];
  if (protectionPosture !== "protected" && hasDependents) flags.push("protection_gap");
  if (emergencyMonths < 2) flags.push("emergency_critical");
  else if (emergencyMonths < 6) flags.push("emergency_thin");
  if (debtRatioPct > 40) flags.push("debt_overload");
  else if (debtRatioPct > 20) flags.push("debt_elevated");
  if (surplusPct > 0 && surplusPct < 10) flags.push("cash_flow_tight");
  if (surplusPct >= 20 && investmentRate < 10) flags.push("under_invested");
  if (liquidityHealth === "excess" && investmentRate < 10) flags.push("over_liquid");
  if (input.ageYears >= 45 && input.retirementCorpus < input.monthlyIncome * 12 * 5)
    flags.push("retirement_late_start");
  if (
    protectionPosture === "protected" &&
    liquidityHealth !== "critical" &&
    liquidityHealth !== "thin" &&
    surplusPct >= 15
  )
    flags.push("wealth_building_ready");

  // Cross-service intelligence — only when analyzers have run.
  const cs = input.crossService;
  if (cs) {
    if (typeof cs.portfolioConcentrationScore === "number" && cs.portfolioConcentrationScore >= 60)
      flags.push("portfolio_concentrated");
    if (typeof cs.portfolioScore === "number" && cs.portfolioScore > 0 && cs.portfolioScore < 55)
      flags.push("portfolio_weak");
    if (typeof cs.insuranceProtectionScore === "number" && cs.insuranceProtectionScore > 0 && cs.insuranceProtectionScore < 60)
      flags.push("insurance_reviewed_gap");
    // Strong investments while insurance is missing — a common Indian pattern.
    const strongInvest = typeof cs.portfolioScore === "number" && cs.portfolioScore >= 65;
    const weakProtection =
      protectionPosture !== "protected" ||
      (typeof cs.insuranceProtectionScore === "number" && cs.insuranceProtectionScore < 60);
    if (strongInvest && weakProtection && hasDependents) flags.push("cross_service_imbalance");
  }

  return {
    lifeStage,
    wealthStage,
    protectionPosture,
    liquidityHealth,
    monthlySurplus,
    surplusPct: Number(surplusPct.toFixed(2)),
    emergencyMonths,
    debtRatioPct,
    savingsRatePct,
    insuranceAdequacyPct,
    hasDependents,
    flags,
  };
}

/**
 * Human-readable one-liner describing the user's current situation.
 * Used by NitiGuide to open its briefing without inventing anything.
 */
export function describeContext(ctx: FinancialContext): string {
  const stage = {
    early_career: "early-career",
    family_building: "family-building",
    peak_earning: "peak-earning",
    pre_retirement: "pre-retirement",
    retirement: "retirement",
  }[ctx.lifeStage];
  const protection = {
    unprotected: "no core insurance in place",
    partial: "partial insurance cover",
    protected: "core insurance in place",
  }[ctx.protectionPosture];
  const liquidity = {
    critical: "a critically thin buffer",
    thin: "a thin emergency buffer",
    adequate: "an adequate buffer",
    excess: "a buffer larger than needed",
  }[ctx.liquidityHealth];
  return `${stage} stage with ${protection} and ${liquidity}`;
}
