/**
 * NitiTax™ — Tax Decision Engine types (V1).
 *
 * NitiTax deliberately produces NO score, rating or grade. Tax is about
 * decisions, not a number. Everything below is deterministic output from
 * `engine.ts`; the AI layer only explains it.
 */

export type TaxRegime = "old" | "new";

export type EmploymentType =
  | "salaried"
  | "self_employed"
  | "business"
  | "freelancer"
  | "other";

export interface SalaryIncome {
  basic: number;
  hra: number;
  specialAllowance: number;
  lta: number;
  bonus: number;
  professionalTax: number;
  employerNps: number;
  employerPf: number;
}

export interface OtherIncome {
  interest: number;         // FD / SB
  rental: number;           // gross annual rent received
  dividend: number;
  business: number;
  other: number;
}

export interface CapitalGains {
  ltcgEquity: number;       // Sec 112A
  stcgEquity: number;       // Sec 111A
  ltcgDebt: number;
  stcgDebt: number;
  ltcgProperty: number;
  otherGains: number;
}

export interface HraContext {
  cityType: "metro" | "non_metro";
  monthlyRentPaid: number;
  landlordPan?: string | null;
}

export interface Deductions80C {
  epfEmployee: number;
  ppf: number;
  elss: number;
  lifeInsurancePremium: number;
  childTuition: number;
  homeLoanPrincipal: number;
  nsc: number;
  other80c: number;
}

export interface Deductions80CCD {
  employeeNps: number;      // 80CCD(1) inside 80C ceiling
  additionalNps: number;    // 80CCD(1B) — extra 50k
  employerNps: number;      // 80CCD(2)
}

export interface Deductions80D {
  selfFamilyPremium: number;
  parentsPremium: number;
  parentsSenior: boolean;
  preventiveHealthCheck: number;
}

export interface OtherDeductions {
  homeLoanInterestSelf: number;   // 24(b)
  educationLoanInterest: number;  // 80E
  charity80G: number;
  savingsInterest80TTA: number;
  seniorInterest80TTB: number;
  disability80U: number;
}

export interface TaxInput {
  ageYears: number;
  employmentType: EmploymentType;
  regimePreference?: TaxRegime | null;   // null → let NitiTax recommend

  salary: SalaryIncome;
  otherIncome: OtherIncome;
  capitalGains: CapitalGains;
  hra: HraContext;

  d80c: Deductions80C;
  d80ccd: Deductions80CCD;
  d80d: Deductions80D;
  otherDeductions: OtherDeductions;

  cityMetro: boolean;
}

/** A single regime's evaluated tax stack. */
export interface RegimeResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  hraExempt: number;
  chapterVIA: number;         // 80C + 80CCD + 80D + others allowed in this regime
  otherExemptions: number;    // professional tax, 24(b), rental standard deduction
  taxableIncome: number;      // slab-rate income only
  specialRateIncome: number;  // 111A / 112A / property LTCG
  slabTax: number;
  capitalGainsTax: number;
  rebate87A: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  takeHome: number;
  effectiveRatePct: number;
  marginalRatePct: number;
  breakdown: TaxLineItem[];
}

export interface TaxLineItem {
  label: string;
  amount: number;
  hint?: string;
}

export interface DeductionUsage {
  section: string;
  label: string;
  limit: number;         // 0 = no statutory ceiling
  used: number;
  remaining: number;
  allowedInNewRegime: boolean;
  note?: string;
}

export interface TaxOpportunity {
  id: string;
  title: string;
  section: string;
  priority: "high" | "medium" | "low";
  additionalDeduction: number;
  estimatedTaxSaving: number;
  regime: TaxRegime | "both";
  reason: string;
  action: string;
}

export interface TaxStrategy {
  id: string;
  name: string;
  description: string;
  estimatedAnnualSaving: number;
  cashRequired: number;
  lockIn: string;
  tradeOffs: string[];
  isRecommended: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  deadline: string;
  priority: "high" | "medium" | "low";
}

export interface TaxFinding {
  id: string;
  title: string;
  detail: string;
  tone: "success" | "info" | "warning" | "danger";
}

export interface CompositionSlice {
  label: string;
  amount: number;
}

export interface TaxReport {
  taxYear: string;
  ageYears: number;
  employmentType: EmploymentType;

  grossIncome: number;
  recommendedRegime: TaxRegime;
  regimeDeltaTax: number;      // tax saved purely by choosing the recommended regime
  old: RegimeResult;
  new: RegimeResult;

  totalTaxPayable: number;
  estimatedTaxSaved: number;   // vs a zero-deduction baseline in the same regime
  effectiveRatePct: number;
  marginalRatePct: number;
  monthlyTdsEstimate: number;

  incomeComposition: CompositionSlice[];
  taxComposition: CompositionSlice[];
  deductions: DeductionUsage[];
  remainingDeductionCapacity: number;

  opportunities: TaxOpportunity[];
  strategies: TaxStrategy[];
  checklist: ChecklistItem[];
  findings: TaxFinding[];

  contextSummary: string;
  narrative?: string;          // NitiGuide™ (AI) — explanation only
}

export function emptyTaxInput(): TaxInput {
  return {
    ageYears: 30,
    employmentType: "salaried",
    regimePreference: null,
    salary: {
      basic: 0, hra: 0, specialAllowance: 0, lta: 0, bonus: 0,
      professionalTax: 2400, employerNps: 0, employerPf: 0,
    },
    otherIncome: { interest: 0, rental: 0, dividend: 0, business: 0, other: 0 },
    capitalGains: {
      ltcgEquity: 0, stcgEquity: 0, ltcgDebt: 0, stcgDebt: 0,
      ltcgProperty: 0, otherGains: 0,
    },
    hra: { cityType: "metro", monthlyRentPaid: 0, landlordPan: null },
    d80c: {
      epfEmployee: 0, ppf: 0, elss: 0, lifeInsurancePremium: 0,
      childTuition: 0, homeLoanPrincipal: 0, nsc: 0, other80c: 0,
    },
    d80ccd: { employeeNps: 0, additionalNps: 0, employerNps: 0 },
    d80d: {
      selfFamilyPremium: 0, parentsPremium: 0,
      parentsSenior: false, preventiveHealthCheck: 0,
    },
    otherDeductions: {
      homeLoanInterestSelf: 0, educationLoanInterest: 0, charity80G: 0,
      savingsInterest80TTA: 0, seniorInterest80TTB: 0, disability80U: 0,
    },
    cityMetro: true,
  };
}

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  salaried: "Salaried",
  self_employed: "Self-employed",
  business: "Business owner",
  freelancer: "Freelancer / professional",
  other: "Other",
};
