/**
 * NitiScore™ — proprietary financial health score (0–100).
 *
 * Per Master Bible §3.5–3.6: a transparent, pillar-based score where every
 * factor is explainable. AI never calculates — math does.
 *
 * Pillars (weights sum to 100):
 *   Savings (20) · Emergency (15) · Insurance (15) · Investments (20)
 *   Debt (15) · Retirement (15)
 *
 * This module is intentionally a small, pure function so it can be unit-tested
 * and audited. Inputs are a normalized FinancialProfile; outputs include the
 * score, every pillar breakdown, and a list of human-readable reasons that the
 * UI / AI explanation layer can render verbatim.
 */

export interface FinancialProfileSnapshot {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyEssentialExpenses: number;
  liquidSavings: number;
  totalInvestments: number;
  monthlyInvestments: number;
  monthlyEMI: number;
  totalLiabilities: number;
  hasTermInsurance: boolean;
  hasHealthInsurance: boolean;
  retirementCorpus: number;
  ageYears: number;
}

export interface PillarResult {
  pillar: string;
  weight: number;
  score: number; // 0–100
  reason: string;
}

export interface NitiScoreResult {
  score: number; // 0–100
  band: "Critical" | "Needs Work" | "Stable" | "Strong" | "Excellent";
  pillars: PillarResult[];
  strengths: string[];
  weaknesses: string[];
}

const WEIGHTS = {
  savings: 20,
  emergency: 15,
  insurance: 15,
  investments: 20,
  debt: 15,
  retirement: 15,
} as const;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function band(score: number): NitiScoreResult["band"] {
  if (score < 35) return "Critical";
  if (score < 55) return "Needs Work";
  if (score < 70) return "Stable";
  if (score < 85) return "Strong";
  return "Excellent";
}

export function calculateNitiScore(p: FinancialProfileSnapshot): NitiScoreResult {
  const pillars: PillarResult[] = [];

  // Savings Rate: target 30% of income.
  const savingsRate = p.monthlyIncome > 0 ? (p.monthlyIncome - p.monthlyExpenses) / p.monthlyIncome : 0;
  const savingsScore = clamp((savingsRate / 0.3) * 100);
  pillars.push({
    pillar: "Savings",
    weight: WEIGHTS.savings,
    score: savingsScore,
    reason: `You save ${(savingsRate * 100).toFixed(0)}% of income (target: 30%).`,
  });

  // Emergency Fund: target 6× essential monthly expenses.
  const target = p.monthlyEssentialExpenses * 6;
  const emergencyScore = target > 0 ? clamp((p.liquidSavings / target) * 100) : 0;
  const months = p.monthlyEssentialExpenses > 0 ? p.liquidSavings / p.monthlyEssentialExpenses : 0;
  pillars.push({
    pillar: "Emergency Fund",
    weight: WEIGHTS.emergency,
    score: emergencyScore,
    reason: `Liquid savings cover ${months.toFixed(1)} months of essentials (target: 6).`,
  });

  // Insurance: binary signal — both term + health required for full marks.
  const insuranceScore = (p.hasTermInsurance ? 50 : 0) + (p.hasHealthInsurance ? 50 : 0);
  pillars.push({
    pillar: "Insurance",
    weight: WEIGHTS.insurance,
    score: insuranceScore,
    reason:
      p.hasTermInsurance && p.hasHealthInsurance
        ? "You have both term and health cover."
        : !p.hasTermInsurance && !p.hasHealthInsurance
          ? "You have no term or health cover."
          : `Missing ${p.hasTermInsurance ? "health" : "term"} insurance.`,
  });

  // Investments: target 20% of income invested monthly.
  const investRate = p.monthlyIncome > 0 ? p.monthlyInvestments / p.monthlyIncome : 0;
  const investmentScore = clamp((investRate / 0.2) * 100);
  pillars.push({
    pillar: "Investments",
    weight: WEIGHTS.investments,
    score: investmentScore,
    reason: `You invest ${(investRate * 100).toFixed(0)}% of income monthly (target: 20%).`,
  });

  // Debt: EMI-to-income ratio. <20% great, >50% critical.
  const emiRatio = p.monthlyIncome > 0 ? p.monthlyEMI / p.monthlyIncome : 0;
  const debtScore = clamp(100 - (emiRatio / 0.5) * 100);
  pillars.push({
    pillar: "Debt",
    weight: WEIGHTS.debt,
    score: debtScore,
    reason: `EMIs are ${(emiRatio * 100).toFixed(0)}% of income (healthy: under 20%).`,
  });

  // Retirement: rough on-track signal = corpus vs. (annual expenses × age progress).
  const annualExp = p.monthlyExpenses * 12;
  const ageFactor = clamp(((p.ageYears - 25) / 35) * 1, 0, 1); // 25→0, 60→1
  const expectedCorpus = annualExp * 25 * ageFactor; // 25× rule, prorated by age
  const retirementScore = expectedCorpus > 0 ? clamp((p.retirementCorpus / expectedCorpus) * 100) : 50;
  pillars.push({
    pillar: "Retirement",
    weight: WEIGHTS.retirement,
    score: retirementScore,
    reason:
      expectedCorpus > 0
        ? `Retirement corpus is ${((p.retirementCorpus / expectedCorpus) * 100).toFixed(0)}% of age-adjusted target.`
        : "Start tracking retirement contributions to score this pillar.",
  });

  const score = Math.round(pillars.reduce((sum, x) => sum + (x.score * x.weight) / 100, 0));

  const strengths = pillars.filter((x) => x.score >= 75).map((x) => x.pillar);
  const weaknesses = pillars.filter((x) => x.score < 50).map((x) => x.pillar);

  return { score, band: band(score), pillars, strengths, weaknesses };
}
