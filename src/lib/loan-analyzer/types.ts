/**
 * NitiLoan™ — Loan Intelligence types.
 *
 * Deterministic. Every field on the report is produced by the engine
 * from a `LoanInput` plus the user's `FinancialContext`. AI (NitiGuide)
 * only narrates the deterministic findings.
 */

export type LoanCategory =
  | "home"
  | "vehicle"
  | "education"
  | "personal"
  | "credit_card"
  | "business"
  | "gold"
  | "consumer_finance"
  | "other";

export const LOAN_CATEGORY_LABEL: Record<LoanCategory, string> = {
  home: "Home loan",
  vehicle: "Vehicle loan",
  education: "Education loan",
  personal: "Personal loan",
  credit_card: "Credit card debt",
  business: "Business loan",
  gold: "Gold loan",
  consumer_finance: "Consumer finance / BNPL",
  other: "Other loan",
};

export type DebtQuality = "healthy" | "neutral" | "poor";

export const DEBT_QUALITY_BY_CATEGORY: Record<LoanCategory, DebtQuality> = {
  home: "healthy",
  education: "healthy",
  business: "healthy",
  vehicle: "neutral",
  gold: "neutral",
  other: "neutral",
  personal: "poor",
  credit_card: "poor",
  consumer_finance: "poor",
};

export interface LoanInput {
  id?: string;
  name: string;
  category: LoanCategory;
  lender?: string | null;
  /** Original principal in INR. */
  principal: number;
  /** Current outstanding in INR. */
  outstanding: number;
  /** Annual interest rate, e.g. 8.5 (percent). */
  interestRate: number;
  /** Original tenure in months. */
  tenureMonths: number;
  /** Remaining tenure in months (null → derived from outstanding+rate+EMI). */
  remainingMonths?: number | null;
  /** Current monthly EMI. */
  monthlyEmi: number;
  /** Annual lump-sum prepayment the user makes (₹). */
  annualPrepayment?: number;
  /** Whether interest qualifies for a tax deduction (home / education). */
  taxDeductible?: boolean;
}

export function emptyLoanInput(): LoanInput {
  return {
    name: "",
    category: "home",
    lender: null,
    principal: 0,
    outstanding: 0,
    interestRate: 8.5,
    tenureMonths: 240,
    remainingMonths: null,
    monthlyEmi: 0,
    annualPrepayment: 0,
    taxDeductible: false,
  };
}

// ─────────────────────────── REPORT ──────────────────────────

export type Tone = "success" | "warning" | "danger" | "neutral";
export type Priority = "high" | "medium" | "low";

export interface LoanFinding {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
}

export interface LoanRecommendation {
  id: string;
  title: string;
  priority: Priority;
  reason: string;
  expectedBenefit: string;
  tradeOffs: string[];
  crossPillarNote?: string;
}

export interface RepaymentStrategy {
  id: "current" | "increase_emi" | "annual_prepay" | "optimized";
  name: string;
  description: string;
  monthlyOutflow: number;
  annualPrepayment: number;
  totalInterest: number;
  interestSavedVsCurrent: number;
  monthsToClose: number;
  monthsSavedVsCurrent: number;
  debtFreedomAge: number;
  isRecommended: boolean;
  tradeOffs: string[];
}

export interface DebtFreedomScenario {
  label: string;
  monthsToFreedom: number;
  ageAtFreedom: number;
}

export interface PrepaymentIntelligence {
  loanEffectiveCostPct: number;   // post-tax cost of debt %
  expectedInvestmentReturnPct: number; // realistic post-tax expected return %
  verdict: "prepay" | "invest" | "split";
  headline: string;
  reasoning: string;
  tradeOffs: string[];
  opportunityCostNote: string;
}

export interface DebtQualityBadge {
  quality: DebtQuality;
  label: string;
  description: string;
}

export interface LoanHealthBreakdown {
  pillar: string;
  score: number; // 0-100
  weight: number;
  note: string;
}

export interface LoanReport {
  loanHealthScore: number; // 0-100
  scoreLabel: string;
  debtQuality: DebtQualityBadge;
  breakdown: LoanHealthBreakdown[];

  // Snapshot
  totalOutstanding: number;
  monthlyEmi: number;
  interestRate: number;
  effectiveInterestCost: number; // post-tax
  remainingMonths: number;
  interestRemaining: number;
  emiToIncomePct: number;

  // Debt Freedom
  scenarios: DebtFreedomScenario[];
  debtFreedomAgeToday: number;

  // Strategies
  strategies: RepaymentStrategy[];
  recommendedStrategyId: RepaymentStrategy["id"];

  // Prepayment Intelligence
  prepayment: PrepaymentIntelligence;

  // Impact on the wider plan
  impactOnPlan: LoanFinding[];

  // Findings + recs + narration
  strengths: LoanFinding[];
  risks: LoanFinding[];
  recommendations: LoanRecommendation[];

  mentorSummary?: string;
  contextSummary: string;
}
