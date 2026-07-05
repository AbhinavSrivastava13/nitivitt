/**
 * Canonical output types for every NitiCore™ service.
 *
 * Every deterministic calculation returns a `MetricResult`. This is the
 * contract that the UI, the recommendation engine, and (later) NitiGuide™
 * consume — never plain numbers.
 */

export type Priority = "high" | "medium" | "low";
export type Severity = "critical" | "warning" | "info" | "success";
export type Status = "on_track" | "needs_attention" | "critical" | "not_available";

export interface MetricResult<TValue = number> {
  metric: string;
  value: TValue;
  unit?: string;
  status: Status;
  explanationKey: string;
  assumptions: Record<string, number | string | boolean>;
  calculationSummary: string;
  priority: Priority;
  suggestedNextStep: string;
  /** Data available for AI (NitiGuide™) to compose plain-language explanations. */
  aiPayload?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  title: string;
  category:
    | "Emergency"
    | "Insurance"
    | "Debt"
    | "Savings"
    | "Investments"
    | "Goals"
    | "Retirement";
  priority: Priority;
  severity: Severity;
  explanation: string;
  /** Human-readable "why this matters" for the user's life — no numbers invented. */
  whyItMatters: string;
  /** Human-readable expected financial impact of taking this action. */
  expectedImpact: string;
  logic: string;
  assumptions: Record<string, number | string | boolean>;
  formulaSummary: string;
  impact: string;
  effort: "low" | "medium" | "high";
  nextAction: string;
  displayOrder: number;
  /** Deterministic global impact score used to rank across pillars. Higher = act sooner. */
  impactScore: number;
}

/** Canonical financial input the whole engine reads. */
export interface NitiCoreInput {
  ageYears: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyEssentialExpenses: number;
  liquidAssets: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyEmi: number;
  monthlyInvestments: number;
  totalInvestments: number;
  hasTermInsurance: boolean;
  hasHealthInsurance: boolean;
  termCover: number;
  retirementCorpus: number;
  retirementAge: number;
  employmentType?: "salaried" | "self_employed";
  riskProfile?: "conservative" | "moderate" | "aggressive";
}
