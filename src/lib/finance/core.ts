/**
 * NitiVitt Financial Core — deterministic math primitives.
 *
 * Per Master Bible §2.7: every financial formula must be deterministic.
 * No AI, no randomness. Pure functions. Inputs in, numbers out.
 * All monetary values in INR (number, paise-safe within JS precision for
 * realistic personal-finance ranges).
 */

/** Future value of a one-time present amount at an annual rate over `years`. */
export function futureValue(present: number, annualRate: number, years: number): number {
  if (years <= 0) return present;
  return present * Math.pow(1 + annualRate, years);
}

/** Future value of a monthly SIP (contribution at end of each month). */
export function sipFutureValue(monthly: number, annualRate: number, years: number): number {
  if (monthly <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.round(years * 12);
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

/** Monthly SIP required to reach a target corpus in `years` at `annualRate`. */
export function requiredMonthlySIP(target: number, annualRate: number, years: number): number {
  if (target <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.round(years * 12);
  if (r === 0) return target / n;
  return target / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

/** Inflate a today-rupee amount forward. */
export function inflate(today: number, inflationRate: number, years: number): number {
  return futureValue(today, inflationRate, years);
}

/** Real rate from nominal & inflation (Fisher). */
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Recommended emergency fund = monthly essential expenses × months (default 6). */
export function emergencyFundTarget(monthlyEssentialExpenses: number, months = 6): number {
  return Math.max(0, monthlyEssentialExpenses) * months;
}

/** Term-life cover guidance: 15–20× annual income, plus liabilities, minus liquid assets. */
export function termLifeCoverEstimate(input: {
  annualIncome: number;
  liabilities: number;
  liquidAssets: number;
  multiplier?: number;
}): number {
  const m = input.multiplier ?? 15;
  return Math.max(0, input.annualIncome * m + input.liabilities - input.liquidAssets);
}

/** Retirement corpus needed using inflation-adjusted post-retirement expenses. */
export function retirementCorpus(input: {
  monthlyExpenseToday: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  inflation: number;
  postRetirementReturn: number;
}): number {
  const futureMonthly = inflate(input.monthlyExpenseToday, input.inflation, input.yearsToRetirement);
  const futureAnnual = futureMonthly * 12;
  const realPostRet = realRate(input.postRetirementReturn, input.inflation);
  // Present value of an annuity over yearsInRetirement at the real rate.
  if (realPostRet === 0) return futureAnnual * input.yearsInRetirement;
  return futureAnnual * ((1 - Math.pow(1 + realPostRet, -input.yearsInRetirement)) / realPostRet);
}

/** Format INR with the Indian numbering system (lakh / crore aware). */
export function formatINR(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "—";
  if (opts.compact) {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
