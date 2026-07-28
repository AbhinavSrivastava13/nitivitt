/**
 * NitiTax™ — Tax Planner types (V1 scaffold).
 *
 * This file only defines the deterministic interfaces. All actual math
 * (regime comparison, HRA, capital-gains slabs, deductions) is intentionally
 * unimplemented — the next milestone fills `engine.ts`.
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
  rental: number;
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
  regimePreference?: TaxRegime;   // null → recommend

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
  chapterVIA: number;         // 80C+80CCD+80D+others where allowed
  taxableIncome: number;
  slabTax: number;
  capitalGainsTax: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  takeHome: number;
  effectiveRatePct: number;
  breakdown: TaxLineItem[];
}

export interface TaxLineItem {
  label: string;
  amount: number;
  hint?: string;
}

export type TaxHealthTone = "healthy" | "watchlist" | "stressed";

export interface TaxSavingSuggestion {
  id: string;
  title: string;
  section: string;          // "80C" / "80D" / "80CCD(1B)" / "HRA" / …
  priority: "high" | "medium" | "low";
  estimatedTaxSaving: number;
  reason: string;
  action: string;
}

export interface TaxReport {
  taxYear: string;
  ageYears: number;
  recommendedRegime: TaxRegime;
  regimeDeltaTax: number;   // (other regime tax) - (recommended regime tax) — positive = savings
  old: RegimeResult;
  new: RegimeResult;
  effectiveRatePct: number; // recommended regime
  marginalRatePct: number;
  taxHealthScore: number;   // 0-100 deterministic
  taxHealthTone: TaxHealthTone;
  suggestions: TaxSavingSuggestion[];
  contextSummary: string;
  narrative?: string;       // AI-written summary (optional)
}

export function emptyTaxInput(): TaxInput {
  return {
    ageYears: 30,
    employmentType: "salaried",
    salary: {
      basic: 0, hra: 0, specialAllowance: 0, lta: 0, bonus: 0,
      professionalTax: 0, employerNps: 0, employerPf: 0,
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
