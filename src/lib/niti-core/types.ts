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
  /**
   * Optional plain-English note describing how this recommendation
   * interacts with OTHER pillars — e.g. "raising SIP now would delay
   * building your 6-month buffer". Filled in by the cross-pillar
   * prioritiser when a meaningful trade-off exists.
   */
  crossPillarNote?: string;

  // ─── CFP-style deterministic reasoning framework (v2) ───
  // These fields are populated by the recommendation engine and consumed by
  // NitiGuide™ / NitiSim™ so every surface explains the SAME reasoning.
  // All optional to preserve backward compatibility with older callers.

  /** One-line financial objective this recommendation serves. */
  financialObjective?: string;
  /** Concrete short-term (0–12 months) consequences — cash-flow / liquidity. */
  shortTermImpact?: string;
  /** Concrete long-term (5+ years) consequences — wealth / resilience. */
  longTermImpact?: string;
  /** Explicit trade-offs a real planner would name out loud. */
  tradeOffs?: string[];
  /** Other recommendation IDs that should ideally be addressed first. */
  dependencies?: string[];
  /**
   * Opportunity cost — what the user gives up (or unlocks) by acting.
   * Phrased in the language of a planner, not a mathematician.
   */
  opportunityCost?: string;
  /**
   * All NitiCore recommendations are deterministic by construction. This flag
   * is carried through so downstream layers (NitiGuide, NitiSim) never
   * mislabel the reasoning as AI-generated.
   */
  confidenceLevel?: "deterministic";
  /**
   * The life-stage / context the engine used when ranking this action.
   * Kept for transparency and for the NitiGuide payload.
   */
  contextTag?: string;
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
  /** Optional — number of financial dependents (spouse, kids, parents). */
  dependentsCount?: number;
}
