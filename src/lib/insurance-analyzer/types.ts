/**
 * Insurance Analyzer V1 — types shared across engine, server functions, UI.
 *
 * Nothing in this file performs analysis. Deterministic reasoning lives in
 * `engine.ts` and calls NitiCore™ + FinancialContext.
 */

export type PolicyType =
  | "term"
  | "health"
  | "personal_accident"
  | "critical_illness"
  | "life"
  | "family_floater"
  | "other";

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  term: "Term Insurance",
  health: "Health Insurance",
  personal_accident: "Personal Accident",
  critical_illness: "Critical Illness",
  life: "Life Insurance (Endowment / ULIP)",
  family_floater: "Family Floater",
  other: "Other",
};

/**
 * Extracted policy fields — every field is optional because real policies
 * rarely surface every attribute. Never invent values; keep them null when
 * absent so the UI can prompt the user to confirm.
 */
export interface ExtractedPolicy {
  policyHolder: string | null;
  policyType: PolicyType | null;
  insurer: string | null;
  policyNumber: string | null;
  sumInsured: number | null;
  premiumAnnual: number | null;
  premiumFrequency: string | null;
  policyTermYears: number | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  nominee: string | null;
  riders: string[];
  waitingPeriods: string[];
  exclusions: string[];
  deductible: number | null;
  copayPct: number | null;
  roomRentLimit: string | null;
  addOns: string[];
  /** Free-form notes the extractor deemed relevant. */
  notes: string | null;
  /** Per-field confidence hints so the UI can nudge the user to confirm. */
  lowConfidenceFields: string[];
}

export function emptyExtractedPolicy(): ExtractedPolicy {
  return {
    policyHolder: null,
    policyType: null,
    insurer: null,
    policyNumber: null,
    sumInsured: null,
    premiumAnnual: null,
    premiumFrequency: null,
    policyTermYears: null,
    coverageStart: null,
    coverageEnd: null,
    nominee: null,
    riders: [],
    waitingPeriods: [],
    exclusions: [],
    deductible: null,
    copayPct: null,
    roomRentLimit: null,
    addOns: [],
    notes: null,
    lowConfidenceFields: [],
  };
}

export type FindingSeverity = "strength" | "observation" | "gap" | "risk";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface InsuranceRecommendation {
  id: string;
  title: string;
  priority: RecommendationPriority;
  reason: string;
  expectedBenefit: string;
  tradeOffs: string[];
  financialImpact: string;
}

export interface AnalysisReport {
  policyType: PolicyType;
  protectionScore: number; // 0–100, deterministic
  scoreLabel: string;
  coverageSummary: string[]; // key-value pairs rendered by the UI
  strengths: Finding[];
  gaps: Finding[];
  observations: Finding[];
  recommendations: InsuranceRecommendation[];
  contextSummary: string;
  /** Populated by the AI narration layer — never used for computation. */
  mentorSummary?: string;
}
