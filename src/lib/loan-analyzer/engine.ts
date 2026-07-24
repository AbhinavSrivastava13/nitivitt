/**
 * NitiLoan™ — deterministic Loan Intelligence engine.
 *
 * Same input → same output. All math lives here. Nothing invented, no AI.
 * The AI narration (NitiGuide) is produced separately from this report.
 */
import { NITI_CORE_CONFIG } from "@/lib/niti-core";
import type { FinancialContext, NitiCoreInput } from "@/lib/niti-core";
import {
  DEBT_QUALITY_BY_CATEGORY,
  LOAN_CATEGORY_LABEL,
  type DebtFreedomScenario,
  type DebtQualityBadge,
  type LoanFinding,
  type LoanInput,
  type LoanHealthBreakdown,
  type LoanRecommendation,
  type LoanReport,
  type PrepaymentIntelligence,
  type RepaymentStrategy,
} from "./types";

interface EngineInput {
  loan: LoanInput;
  input: NitiCoreInput;
  context: FinancialContext;
}

const MARGINAL_TAX_RATE = 0.30; // conservative estimate for tax-deductible interest

export function inr(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "₹0";
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Solve remaining months from outstanding, EMI, and monthly rate. */
function monthsFromEmi(outstanding: number, monthlyRate: number, emi: number): number {
  if (outstanding <= 0 || emi <= 0) return 0;
  if (monthlyRate <= 0) return Math.ceil(outstanding / emi);
  if (emi <= outstanding * monthlyRate) return 360 * 5; // EMI barely covers interest → practically forever, capped
  const n = Math.log(emi / (emi - outstanding * monthlyRate)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

/** Simulate an amortisation with optional extra monthly + annual prepayments. */
function simulate(opts: {
  outstanding: number;
  monthlyRate: number;
  emi: number;
  extraMonthly?: number;
  annualPrepayment?: number;
  maxMonths?: number;
}): { months: number; interest: number } {
  const maxMonths = opts.maxMonths ?? 12 * 40;
  let bal = opts.outstanding;
  const monthlyOut = opts.emi + (opts.extraMonthly ?? 0);
  const annualPrepay = opts.annualPrepayment ?? 0;
  let interest = 0;
  let m = 0;
  while (bal > 0 && m < maxMonths) {
    const iThis = bal * opts.monthlyRate;
    const principal = Math.max(0, monthlyOut - iThis);
    interest += iThis;
    bal = bal - principal;
    m += 1;
    if (annualPrepay > 0 && m % 12 === 0 && bal > 0) {
      bal = bal - annualPrepay;
    }
    if (bal < 0.01) bal = 0;
  }
  return { months: m, interest: Math.round(interest) };
}

function scoreLabelFor(s: number): string {
  if (s >= 85) return "Excellent — this loan sits comfortably in your plan";
  if (s >= 70) return "Healthy — minor tuning will make it even better";
  if (s >= 50) return "Manageable but strained — plan a few corrections";
  if (s >= 30) return "Under pressure — this loan is holding back your plan";
  return "Critical — this loan is destabilising your finances";
}

function debtQualityBadge(input: LoanInput): DebtQualityBadge {
  const q = DEBT_QUALITY_BY_CATEGORY[input.category];
  const label = q === "healthy" ? "Healthy debt" : q === "neutral" ? "Neutral debt" : "Poor debt";
  const description = q === "healthy"
    ? "Builds a productive asset or long-term earning power. Manage the cost; do not fear it."
    : q === "neutral"
      ? "Neither builds wealth nor destroys it. Keep tenure short and cost low."
      : "Funds consumption at rates that quietly erode your future. Prioritise closure.";
  return { quality: q, label, description };
}

export function analyzeLoan({ loan, input, context }: EngineInput): LoanReport {
  const outstanding = Math.max(0, Number(loan.outstanding) || 0);
  const rate = Math.max(0, Number(loan.interestRate) || 0);
  const monthlyRate = rate / 100 / 12;
  const emi = Math.max(0, Number(loan.monthlyEmi) || 0);
  const monthlyIncome = Math.max(0, input.monthlyIncome);
  const annualPrepay = Math.max(0, Number(loan.annualPrepayment ?? 0));

  // Remaining tenure — respect user's value if provided, else solve
  const remainingMonths = loan.remainingMonths && loan.remainingMonths > 0
    ? Math.round(loan.remainingMonths)
    : monthsFromEmi(outstanding, monthlyRate, emi);

  // Current-plan simulation
  const current = simulate({ outstanding, monthlyRate, emi, annualPrepayment: annualPrepay });
  const interestRemaining = current.interest;

  // Post-tax effective cost (tax-deductible loans cost less)
  const effectiveCost = loan.taxDeductible ? rate * (1 - MARGINAL_TAX_RATE) : rate;

  // EMI / income pressure
  const totalMonthlyEmi = Math.max(input.monthlyEmi, emi); // whole-portfolio EMI includes this loan
  const emiToIncome = monthlyIncome > 0 ? (totalMonthlyEmi / monthlyIncome) * 100 : 0;
  const emiToIncomeThis = monthlyIncome > 0 ? (emi / monthlyIncome) * 100 : 0;

  // ─────────────── Debt Freedom scenarios ───────────────
  const ageToday = input.ageYears;
  const freedomMonths = current.months;
  const debtFreedomAgeToday = ageToday + Math.ceil(freedomMonths / 12);
  const scenarios: DebtFreedomScenario[] = [
    { label: "Current plan", monthsToFreedom: freedomMonths, ageAtFreedom: debtFreedomAgeToday },
  ];
  const emiBumpAmount = Math.round(emi * 0.10);
  if (emi > 0) {
    const bumped = simulate({ outstanding, monthlyRate, emi, extraMonthly: emiBumpAmount, annualPrepayment: annualPrepay });
    scenarios.push({
      label: `EMI + ₹${emiBumpAmount.toLocaleString("en-IN")}/mo (+10%)`,
      monthsToFreedom: bumped.months,
      ageAtFreedom: ageToday + Math.ceil(bumped.months / 12),
    });
  }
  const yearlyPrepayAmount = Math.max(emi, Math.round(monthlyIncome * 0.5));
  if (yearlyPrepayAmount > 0) {
    const yr = simulate({ outstanding, monthlyRate, emi, annualPrepayment: annualPrepay + yearlyPrepayAmount });
    scenarios.push({
      label: `Annual prepay ₹${yearlyPrepayAmount.toLocaleString("en-IN")}`,
      monthsToFreedom: yr.months,
      ageAtFreedom: ageToday + Math.ceil(yr.months / 12),
    });
  }

  // ─────────────── Repayment strategies (for the simulator table) ───────────────
  const strategies: RepaymentStrategy[] = [];
  strategies.push({
    id: "current",
    name: "Current plan",
    description: "Keep EMI and prepayments exactly as they are today.",
    monthlyOutflow: emi,
    annualPrepayment: annualPrepay,
    totalInterest: current.interest,
    interestSavedVsCurrent: 0,
    monthsToClose: current.months,
    monthsSavedVsCurrent: 0,
    debtFreedomAge: debtFreedomAgeToday,
    isRecommended: false,
    tradeOffs: [],
  });

  if (emiBumpAmount > 0) {
    const s = simulate({ outstanding, monthlyRate, emi, extraMonthly: emiBumpAmount, annualPrepayment: annualPrepay });
    strategies.push({
      id: "increase_emi",
      name: "Increase EMI by 10%",
      description: `Pay ₹${emiBumpAmount.toLocaleString("en-IN")} extra every month.`,
      monthlyOutflow: emi + emiBumpAmount,
      annualPrepayment: annualPrepay,
      totalInterest: s.interest,
      interestSavedVsCurrent: current.interest - s.interest,
      monthsToClose: s.months,
      monthsSavedVsCurrent: current.months - s.months,
      debtFreedomAge: ageToday + Math.ceil(s.months / 12),
      isRecommended: false,
      tradeOffs: ["Reduces monthly cash flow available for investing or lifestyle."],
    });
  }

  if (yearlyPrepayAmount > 0) {
    const s = simulate({ outstanding, monthlyRate, emi, annualPrepayment: annualPrepay + yearlyPrepayAmount });
    strategies.push({
      id: "annual_prepay",
      name: `Annual prepayment ₹${yearlyPrepayAmount.toLocaleString("en-IN")}`,
      description: "Direct annual bonus / surplus to a lump-sum prepayment every year.",
      monthlyOutflow: emi,
      annualPrepayment: annualPrepay + yearlyPrepayAmount,
      totalInterest: s.interest,
      interestSavedVsCurrent: current.interest - s.interest,
      monthsToClose: s.months,
      monthsSavedVsCurrent: current.months - s.months,
      debtFreedomAge: ageToday + Math.ceil(s.months / 12),
      isRecommended: false,
      tradeOffs: ["Uses annual bonus / windfall that could otherwise be invested."],
    });
  }

  // Optimised strategy — chosen by prepayment intelligence below.
  // If invest is better (expected return > effective cost), a smaller +5% EMI + invest surplus is proposed.
  // If prepay is better, combine both prior levers.
  const expectedReturnGross = NITI_CORE_CONFIG.equityReturn * 100; // 12% p.a.
  const expectedReturnNet = expectedReturnGross * 0.85; // approx post-tax / drag
  const spread = effectiveCost - expectedReturnNet;

  let verdict: PrepaymentIntelligence["verdict"];
  let headline: string;
  let reasoning: string;
  let tradeOffs: string[];
  let opportunityCostNote: string;
  if (spread >= 1) {
    verdict = "prepay";
    headline = "Prepayment likely wins — this loan is expensive money.";
    reasoning = `The post-tax cost of this loan (${effectiveCost.toFixed(2)}%) exceeds the realistic post-tax return on equity (~${expectedReturnNet.toFixed(1)}%). Every extra rupee against principal earns a guaranteed ${effectiveCost.toFixed(2)}% — better than most investable alternatives at similar risk.`;
    tradeOffs = ["Ties up liquidity that could compound in the market", "Rebuilding investment corpus takes time"];
    opportunityCostNote = "You give up potential upside on the invested surplus, but avoid guaranteed high interest — a better risk-adjusted trade.";
  } else if (spread <= -1.5) {
    verdict = "invest";
    headline = "Investing likely wins — the loan is cheaper than your alternatives.";
    reasoning = `Post-tax cost (${effectiveCost.toFixed(2)}%) is meaningfully below the realistic post-tax return on equity (~${expectedReturnNet.toFixed(1)}%). Aggressive prepayment would trade a higher-return future for a lower-cost present.`;
    tradeOffs = ["Requires SIP discipline for a decade+", "Emotional discomfort of carrying debt while investing"];
    opportunityCostNote = "Prepaying now feels safe but caps long-term wealth. Only right if you are undisciplined with SIPs or emergency fund is thin.";
  } else {
    verdict = "split";
    headline = "Split the surplus — the two options are roughly even.";
    reasoning = `Loan cost (${effectiveCost.toFixed(2)}%) and expected investment return (~${expectedReturnNet.toFixed(1)}%) are within 1.5%. A 50/50 split reduces regret in both directions.`;
    tradeOffs = ["Marginal wins either way", "Adds a decision every year — automate it"];
    opportunityCostNote = "Neither choice is clearly wrong. The behavioural benefit of a fixed split usually outweighs optimising the last rupee.";
  }

  const prepayment: PrepaymentIntelligence = {
    loanEffectiveCostPct: Math.round(effectiveCost * 100) / 100,
    expectedInvestmentReturnPct: Math.round(expectedReturnNet * 100) / 100,
    verdict,
    headline,
    reasoning,
    tradeOffs,
    opportunityCostNote,
  };

  // Optimised strategy: bump EMI slightly + annual prepay when spread favors prepay; a lighter version when invest wins.
  const optimisedBump = verdict === "prepay" ? Math.round(emi * 0.15) : verdict === "split" ? Math.round(emi * 0.08) : Math.round(emi * 0.05);
  const optimisedAnnual = verdict === "prepay"
    ? annualPrepay + yearlyPrepayAmount
    : verdict === "split"
      ? annualPrepay + Math.round(yearlyPrepayAmount * 0.5)
      : annualPrepay;
  if (emi > 0) {
    const s = simulate({ outstanding, monthlyRate, emi, extraMonthly: optimisedBump, annualPrepayment: optimisedAnnual });
    const desc =
      verdict === "prepay" ? "Higher EMI + annual prepayment aggressively closes an expensive loan."
        : verdict === "invest" ? "Small EMI bump for behavioural momentum; direct surplus into SIPs."
          : "A gentle EMI bump plus a half-sized annual prepayment — a balanced middle path.";
    strategies.push({
      id: "optimized",
      name: "NitiLoan™ optimised strategy",
      description: desc,
      monthlyOutflow: emi + optimisedBump,
      annualPrepayment: optimisedAnnual,
      totalInterest: s.interest,
      interestSavedVsCurrent: current.interest - s.interest,
      monthsToClose: s.months,
      monthsSavedVsCurrent: current.months - s.months,
      debtFreedomAge: ageToday + Math.ceil(s.months / 12),
      isRecommended: true,
      tradeOffs:
        verdict === "prepay"
          ? ["Reduces surplus available for equity SIPs.", "Should only follow a full emergency fund and adequate insurance."]
          : verdict === "invest"
            ? ["Requires you to actually invest the surplus — automate it or it disappears."]
            : ["Sacrifices some optimality in exchange for behavioural robustness."],
    });
  }

  const recommendedStrategyId: RepaymentStrategy["id"] = strategies.find((s) => s.isRecommended)?.id ?? "current";

  // ─────────────── Loan Health Score breakdown ───────────────
  const affordability = monthlyIncome > 0
    ? Math.max(0, 100 - Math.max(0, emiToIncome - 20) * 4) // penalise above 20%
    : 60;
  const debtBurden = Math.max(0, 100 - Math.min(80, (outstanding / Math.max(1, monthlyIncome * 60)) * 100)); // outstanding vs 5y income
  const interestBurden = Math.max(0, 100 - Math.max(0, effectiveCost - 8) * 6);
  const flexibility = context.liquidityHealth === "excess" ? 100
    : context.liquidityHealth === "adequate" ? 85
      : context.liquidityHealth === "partial" ? 55
        : 25;
  const debtQualityScore =
    DEBT_QUALITY_BY_CATEGORY[loan.category] === "healthy" ? 90
      : DEBT_QUALITY_BY_CATEGORY[loan.category] === "neutral" ? 65
        : 35;

  const breakdown: LoanHealthBreakdown[] = [
    { pillar: "Affordability", score: Math.round(affordability), weight: 25, note: `Total EMI is ${Math.round(emiToIncome)}% of monthly income. Healthy ≤ 30%.` },
    { pillar: "Debt burden", score: Math.round(debtBurden), weight: 20, note: `Outstanding vs. 5-year income capacity.` },
    { pillar: "Interest burden", score: Math.round(interestBurden), weight: 20, note: `Post-tax effective cost: ${effectiveCost.toFixed(2)}%.` },
    { pillar: "Financial flexibility", score: Math.round(flexibility), weight: 15, note: `Emergency buffer: ${context.liquidityHealth.replace("_", " ")}.` },
    { pillar: "Debt quality", score: Math.round(debtQualityScore), weight: 20, note: `${LOAN_CATEGORY_LABEL[loan.category]} → ${debtQualityBadge(loan).label}.` },
  ];
  const loanHealthScore = Math.round(breakdown.reduce((a, b) => a + (b.score * b.weight) / 100, 0));

  // ─────────────── Findings + recs ───────────────
  const strengths: LoanFinding[] = [];
  const risks: LoanFinding[] = [];
  const recommendations: LoanRecommendation[] = [];

  if (loan.taxDeductible) {
    strengths.push({
      id: "tax-deductible",
      tone: "success",
      title: "Tax-deductible interest lowers the true cost",
      detail: `At an assumed marginal tax rate of ${Math.round(MARGINAL_TAX_RATE * 100)}%, the effective post-tax cost of this loan is ${effectiveCost.toFixed(2)}%.`,
    });
  }
  if (DEBT_QUALITY_BY_CATEGORY[loan.category] === "healthy") {
    strengths.push({
      id: "healthy-debt",
      tone: "success",
      title: "This is productive debt",
      detail: "It builds a long-lived asset or your earning power. Manage the cost; do not rush to close it prematurely.",
    });
  }

  if (emiToIncomeThis > 40) {
    risks.push({
      id: "emi-critical",
      tone: "danger",
      title: `This EMI alone is ${Math.round(emiToIncomeThis)}% of your monthly income`,
      detail: "Single-loan EMI above 40% of income leaves almost no room for saving, investing, or surviving a job disruption.",
    });
    recommendations.push({
      id: "restructure-loan",
      title: "Restructure or refinance to bring the EMI below 30% of income",
      priority: "high",
      reason: "Above 40% EMI-to-income, every unplanned expense becomes a crisis.",
      expectedBenefit: "Restores cash-flow room for emergencies, savings and investing.",
      tradeOffs: ["Longer tenure may mean more absolute interest paid.", "Processing / switching fees on refinance."],
    });
  } else if (emiToIncome > 40) {
    risks.push({
      id: "total-emi-heavy",
      tone: "warning",
      title: `Total EMI across loans is ${Math.round(emiToIncome)}% of income`,
      detail: "Above 40% is where debt starts pushing out saving and investing. Bring the total ratio below 40%, ideally under 30%.",
    });
  }

  if (DEBT_QUALITY_BY_CATEGORY[loan.category] === "poor") {
    recommendations.push({
      id: "close-poor-debt",
      title: "Close this loan on priority — it is poor-quality debt",
      priority: effectiveCost >= 14 ? "high" : "medium",
      reason: `${LOAN_CATEGORY_LABEL[loan.category]} at ${effectiveCost.toFixed(2)}% funds consumption and quietly erodes long-term wealth.`,
      expectedBenefit: "Frees cash flow, improves credit health, and unlocks investment capacity.",
      tradeOffs: ["Temporarily slows investing while surplus is redirected."],
    });
  }

  if (context.liquidityHealth === "insufficient" || context.liquidityHealth === "partial") {
    risks.push({
      id: "prepay-vs-buffer",
      tone: "warning",
      title: "Emergency buffer is thin — don't over-prepay yet",
      detail: "Aggressive prepayment while the emergency fund is below 3 months' expenses is risky. A missed EMI hurts more than saved interest helps.",
    });
    recommendations.push({
      id: "buffer-first",
      title: "Complete the emergency fund before extra prepayment",
      priority: "high",
      reason: "NitiCore hierarchy: Emergency > Insurance > Debt > Investments.",
      expectedBenefit: "Ensures a missed month does not turn this loan into a default.",
      tradeOffs: ["Interest keeps ticking on the loan for a few extra months."],
      crossPillarNote: "Buffer first, then run the optimised strategy from the Repayment Simulator.",
    });
  }

  if (!context.hasDependents === false && context.protectionPosture !== "protected") {
    risks.push({
      id: "protection-gap",
      tone: "warning",
      title: "Loan outstanding is not protected by term insurance",
      detail: "If something happens to the borrower, dependents inherit the EMI. A term policy sized against outstanding + goals removes that risk.",
    });
  }

  // Prepay vs invest recommendation (only when there's room to do either)
  if (context.liquidityHealth !== "insufficient") {
    if (verdict === "prepay") {
      recommendations.push({
        id: "adopt-optimized",
        title: "Adopt the NitiLoan™ optimised strategy to save interest fast",
        priority: "medium",
        reason: `Post-tax loan cost (${effectiveCost.toFixed(2)}%) exceeds realistic equity returns (~${expectedReturnNet.toFixed(1)}%).`,
        expectedBenefit: "Interest saved + earlier debt freedom age.",
        tradeOffs: ["Lower monthly investable surplus."],
      });
    } else if (verdict === "invest") {
      recommendations.push({
        id: "invest-surplus",
        title: "Keep EMI as-is and direct surplus to equity SIPs",
        priority: "medium",
        reason: `Loan is cheap money — post-tax cost ${effectiveCost.toFixed(2)}% vs. expected equity returns ~${expectedReturnNet.toFixed(1)}%.`,
        expectedBenefit: "Higher long-term wealth despite carrying the loan for longer.",
        tradeOffs: ["Requires SIP discipline for a decade+.", "Emotionally harder than the certainty of prepayment."],
      });
    }
  }

  // ─────────────── Impact on wider plan ───────────────
  const impactOnPlan: LoanFinding[] = [];
  if (emiToIncome > 30) {
    impactOnPlan.push({
      id: "plan-savings",
      tone: emiToIncome > 40 ? "danger" : "warning",
      title: `EMI-to-income at ${Math.round(emiToIncome)}% pushes down savings rate`,
      detail: "Every percentage point of EMI above 30% typically comes out of investable savings — slowing retirement corpus growth.",
    });
  }
  if (context.protectionPosture !== "protected" && outstanding > 20_00_000) {
    impactOnPlan.push({
      id: "plan-protection",
      tone: "warning",
      title: "Large outstanding balance without adequate protection",
      detail: "A loan of this size directly increases the term-life cover you should carry.",
    });
  }
  if (loan.category === "credit_card" || loan.category === "consumer_finance") {
    impactOnPlan.push({
      id: "plan-poor-debt",
      tone: "danger",
      title: "Poor-quality debt lowers NitiScore™",
      detail: "Credit-card and consumer-finance balances are the fastest way to lose ground on the Debt pillar of your NitiScore.",
    });
  }

  const contextSummary = [
    `Life stage: ${context.lifeStage}`,
    `Liquidity: ${context.liquidityHealth}`,
    `Protection: ${context.protectionPosture}`,
    context.hasDependents ? "Dependents: yes" : "Dependents: none stated",
  ].join(" · ");

  return {
    loanHealthScore,
    scoreLabel: scoreLabelFor(loanHealthScore),
    debtQuality: debtQualityBadge(loan),
    breakdown,
    totalOutstanding: outstanding,
    monthlyEmi: emi,
    interestRate: rate,
    effectiveInterestCost: Math.round(effectiveCost * 100) / 100,
    remainingMonths,
    interestRemaining,
    emiToIncomePct: Math.round(emiToIncome * 10) / 10,
    scenarios,
    debtFreedomAgeToday,
    strategies,
    recommendedStrategyId,
    prepayment,
    impactOnPlan,
    strengths,
    risks,
    recommendations,
    contextSummary,
  };
}
