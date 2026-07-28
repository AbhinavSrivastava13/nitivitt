# NitiTax™ — Tax Planner (Architecture Scaffold)

This folder is the architectural home for the Tax Planner. **The
deterministic engine is intentionally unimplemented in this milestone.**
The next milestone should only need to write tax logic, not create files.

## Layout

- `types.ts` — All input/output interfaces: `TaxInput`, `RegimeResult`,
  `TaxReport`, `TaxSavingSuggestion`.
- `engine.ts` — Placeholder for the deterministic engine:
  `computeRegime`, `generateTaxSuggestions`, `analyzeTax`.
- `analyzer.functions.ts` — Server functions (`analyzeTaxServer`,
  `listTaxAnalyses`, `getTaxAnalysis`, `deleteTaxAnalysis`).

## What the engine must support (next milestone)

- Old vs New Regime comparison (FY 2025-26 slabs)
- Salary income, standard deduction
- HRA exemption (min-of-three rule)
- Chapter VI-A: 80C (₹1.5L), 80CCD(1B) (+₹50k), 80CCD(2), 80D by age
- Capital gains: Sec 111A, 112A (with ₹1.25L exemption), 112 debt, property
- Surcharge slabs + 4% health-and-education cess
- Deterministic **Tax Health Rating** (Healthy / Watchlist / Stressed)
- Regime recommendation with rupee delta
- Effective and marginal rate calculation
- Deterministic tax-saving suggestions ranked by rupee impact

## Database (to be added)

A `tax_analyses` table with RLS + GRANTs, following the same shape as
`loan_analyses` / `portfolio_analyses`. Draft SQL will be shipped with the
engine milestone.
