/**
 * NitiTax™ — deterministic tax engine (V1 scaffold).
 *
 * Interfaces only. The next milestone implements:
 *   - Old vs New Regime slab calculators (FY 2025-26 / AY 2026-27)
 *   - HRA exemption formula (min of 3 rules)
 *   - Chapter VI-A ceilings (80C ₹1.5L, 80CCD(1B) ₹50k, 80D per age)
 *   - Capital gains (Sec 111A, 112A, 112 debt, property)
 *   - Surcharge slabs + 4% cess
 *   - Deterministic Tax Health score
 *   - Regime recommendation
 */
import type {
  RegimeResult, TaxInput, TaxRegime, TaxReport, TaxSavingSuggestion,
} from "./types";

export const TAX_YEAR = "FY 2025-26";

/** Placeholder — computes a single-regime result. */
export function computeRegime(_input: TaxInput, regime: TaxRegime): RegimeResult {
  return {
    regime,
    grossIncome: 0,
    standardDeduction: 0,
    hraExempt: 0,
    chapterVIA: 0,
    taxableIncome: 0,
    slabTax: 0,
    capitalGainsTax: 0,
    surcharge: 0,
    cess: 0,
    totalTax: 0,
    takeHome: 0,
    effectiveRatePct: 0,
    breakdown: [],
  };
}

/** Placeholder — deterministic tax-saving suggestions. */
export function generateTaxSuggestions(_input: TaxInput, _old: RegimeResult, _new: RegimeResult): TaxSavingSuggestion[] {
  return [];
}

/** Placeholder — top-level orchestrator. */
export function analyzeTax(input: TaxInput): TaxReport {
  const oldR = computeRegime(input, "old");
  const newR = computeRegime(input, "new");
  const recommended: TaxRegime = newR.totalTax <= oldR.totalTax ? "new" : "old";
  const chosen = recommended === "new" ? newR : oldR;
  const other = recommended === "new" ? oldR : newR;

  return {
    taxYear: TAX_YEAR,
    ageYears: input.ageYears,
    recommendedRegime: recommended,
    regimeDeltaTax: Math.max(0, other.totalTax - chosen.totalTax),
    old: oldR,
    new: newR,
    effectiveRatePct: chosen.effectiveRatePct,
    marginalRatePct: 0,
    taxHealthScore: 0,
    taxHealthTone: "watchlist",
    suggestions: generateTaxSuggestions(input, oldR, newR),
    contextSummary: `Scaffold only — engine not yet implemented (${TAX_YEAR}).`,
  };
}

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
