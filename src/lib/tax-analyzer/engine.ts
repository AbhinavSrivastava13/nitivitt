/**
 * NitiTax™ - deterministic Tax Decision Engine (V1).
 *
 * FY 2025-26 / AY 2026-27. Every rupee below is formula-driven. The AI layer
 * never computes tax; it only explains what this file produced.
 *
 * V1 simplifications (documented, not hidden):
 *  - Surcharge is applied without marginal relief and without the 15% cap
 *    carve-out for 111A/112A gains.
 *  - Debt capital gains are taxed at slab rates (post-Apr-2023 regime).
 *  - Rental income uses the 30% standard deduction under Section 24(a).
 *  - Business income is accepted as a net figure (presumptive/ITR-3 detail
 *    lands in V2).
 */
import type {
  ChecklistItem, CompositionSlice, DeductionUsage, RegimeResult, TaxFinding,
  TaxInput, TaxOpportunity, TaxRegime, TaxReport, TaxStrategy,
} from "./types";

export const TAX_YEAR = "FY 2025-26";

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const round = (n: number) => Math.round(n);
const clamp0 = (n: number) => (n > 0 ? n : 0);

// ─────────────────────────── SLABS ───────────────────────────

type Slab = { upto: number; rate: number };

const NEW_SLABS: Slab[] = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.10 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.20 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.30 },
];

function oldSlabs(age: number): Slab[] {
  const exempt = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
  const slabs: Slab[] = [{ upto: exempt, rate: 0 }];
  if (exempt < 500000) slabs.push({ upto: 500000, rate: 0.05 });
  slabs.push({ upto: 1000000, rate: 0.20 });
  slabs.push({ upto: Infinity, rate: 0.30 });
  return slabs;
}

function slabTaxOf(income: number, slabs: Slab[]): number {
  let tax = 0;
  let prev = 0;
  for (const s of slabs) {
    if (income <= prev) break;
    const band = Math.min(income, s.upto) - prev;
    tax += band * s.rate;
    prev = s.upto;
  }
  return tax;
}

function marginalRateOf(income: number, slabs: Slab[]): number {
  for (const s of slabs) {
    if (income <= s.upto) return s.rate * 100;
  }
  return (slabs[slabs.length - 1]?.rate ?? 0) * 100;
}

function surchargeRate(totalIncome: number, regime: TaxRegime): number {
  if (totalIncome > 50000000) return regime === "new" ? 0.25 : 0.37;
  if (totalIncome > 20000000) return 0.25;
  if (totalIncome > 10000000) return 0.15;
  if (totalIncome > 5000000) return 0.10;
  return 0;
}

// ─────────────────────────── DEDUCTION MATH ───────────────────────────

export const LIMIT_80C = 150000;
export const LIMIT_80CCD1B = 50000;
export const LTCG_112A_EXEMPT = 125000;
export const STD_DEDUCTION_OLD = 50000;
export const STD_DEDUCTION_NEW = 75000;
export const LIMIT_24B = 200000;

function isSalaried(input: TaxInput): boolean {
  return input.employmentType === "salaried" || totalSalary(input) > 0;
}

function totalSalary(input: TaxInput): number {
  const s = input.salary;
  return s.basic + s.hra + s.specialAllowance + s.lta + s.bonus;
}

function rentalNet(input: TaxInput): number {
  return input.otherIncome.rental * 0.7; // Sec 24(a) 30% standard deduction
}

export function hraExemption(input: TaxInput): number {
  const { salary, hra } = input;
  const annualRent = hra.monthlyRentPaid * 12;
  if (annualRent <= 0 || salary.hra <= 0) return 0;
  const cityPct = input.cityMetro || hra.cityType === "metro" ? 0.5 : 0.4;
  return clamp0(Math.min(
    salary.hra,
    clamp0(annualRent - 0.1 * salary.basic),
    cityPct * salary.basic,
  ));
}

export function used80C(input: TaxInput): number {
  const d = input.d80c;
  return d.epfEmployee + d.ppf + d.elss + d.lifeInsurancePremium +
    d.childTuition + d.homeLoanPrincipal + d.nsc + d.other80c +
    input.d80ccd.employeeNps;
}

export function used80D(input: TaxInput): number {
  const d = input.d80d;
  const selfLimit = input.ageYears >= 60 ? 50000 : 25000;
  const parentLimit = d.parentsSenior ? 50000 : 25000;
  const preventive = Math.min(d.preventiveHealthCheck, 5000);
  const self = Math.min(d.selfFamilyPremium + preventive, selfLimit);
  const parents = Math.min(d.parentsPremium, parentLimit);
  return self + parents;
}

function employerNpsAllowed(input: TaxInput, regime: TaxRegime): number {
  const cap = (regime === "new" ? 0.14 : 0.10) * input.salary.basic;
  return Math.min(input.d80ccd.employerNps, clamp0(cap));
}

function chapterVIA(input: TaxInput, regime: TaxRegime): number {
  const empNps = employerNpsAllowed(input, regime); // 80CCD(2) - both regimes
  if (regime === "new") return empNps;
  const o = input.otherDeductions;
  const savingsInterest = input.ageYears >= 60
    ? Math.min(o.seniorInterest80TTB, 50000)
    : Math.min(o.savingsInterest80TTA, 10000);
  return (
    Math.min(used80C(input), LIMIT_80C) +
    Math.min(input.d80ccd.additionalNps, LIMIT_80CCD1B) +
    empNps +
    used80D(input) +
    o.educationLoanInterest +
    Math.round(o.charity80G * 0.5) +
    savingsInterest +
    o.disability80U
  );
}

// ─────────────────────────── REGIME COMPUTE ───────────────────────────

export function computeRegime(input: TaxInput, regime: TaxRegime): RegimeResult {
  const salary = totalSalary(input);
  const oi = input.otherIncome;
  const cg = input.capitalGains;

  const grossIncome =
    salary + oi.interest + oi.rental + oi.dividend + oi.business + oi.other +
    cg.ltcgEquity + cg.stcgEquity + cg.ltcgDebt + cg.stcgDebt + cg.ltcgProperty + cg.otherGains;

  const salaried = isSalaried(input);
  const standardDeduction = salaried
    ? (regime === "new" ? STD_DEDUCTION_NEW : STD_DEDUCTION_OLD)
    : 0;

  const hraExempt = regime === "old" ? hraExemption(input) : 0;
  const professionalTax = regime === "old" ? input.salary.professionalTax : 0;
  const homeLoanInterest = regime === "old"
    ? Math.min(input.otherDeductions.homeLoanInterestSelf, LIMIT_24B)
    : 0;
  const rentalStd = oi.rental * 0.3;
  const otherExemptions = professionalTax + homeLoanInterest + rentalStd;

  const via = chapterVIA(input, regime);

  // Slab-rate income (debt & unlisted gains are taxed at slab rates).
  const slabGross =
    salary + oi.interest + rentalNet(input) + oi.dividend + oi.business + oi.other +
    cg.ltcgDebt + cg.stcgDebt + cg.otherGains;

  const taxableIncome = clamp0(
    slabGross - standardDeduction - hraExempt - professionalTax - homeLoanInterest - via,
  );

  const slabs = regime === "new" ? NEW_SLABS : oldSlabs(input.ageYears);
  let slabTax = slabTaxOf(taxableIncome, slabs);

  // Special-rate capital gains
  const ltcg112a = clamp0(cg.ltcgEquity - LTCG_112A_EXEMPT) * 0.125;
  const stcg111a = cg.stcgEquity * 0.20;
  const ltcgProperty = cg.ltcgProperty * 0.125;
  const capitalGainsTax = ltcg112a + stcg111a + ltcgProperty;
  const specialRateIncome = cg.ltcgEquity + cg.stcgEquity + cg.ltcgProperty;

  // Rebate 87A
  let rebate = 0;
  if (regime === "new") {
    if (taxableIncome <= 1200000) {
      rebate = Math.min(slabTax, 60000);
    } else if (taxableIncome <= 1275000) {
      // marginal relief band
      const excess = taxableIncome - 1200000;
      rebate = clamp0(slabTax - excess);
    }
  } else if (taxableIncome <= 500000) {
    rebate = Math.min(slabTax, 12500);
  }
  slabTax = clamp0(slabTax - rebate);

  const taxBeforeSurcharge = slabTax + capitalGainsTax;
  const totalIncomeForSurcharge = taxableIncome + specialRateIncome;
  const sRate = surchargeRate(totalIncomeForSurcharge, regime);
  const surcharge = taxBeforeSurcharge * sRate;
  const cess = (taxBeforeSurcharge + surcharge) * 0.04;
  const totalTax = round(taxBeforeSurcharge + surcharge + cess);

  const marginalRatePct =
    round(marginalRateOf(taxableIncome, slabs) * (1 + sRate) * 1.04 * 100) / 100;

  const breakdown = [
    { label: "Gross total income", amount: round(grossIncome) },
    { label: "Standard deduction", amount: -round(standardDeduction) },
    ...(hraExempt > 0 ? [{ label: "HRA exemption (Sec 10(13A))", amount: -round(hraExempt) }] : []),
    ...(otherExemptions > 0 ? [{ label: "Professional tax, 24(b) & house-property", amount: -round(otherExemptions) }] : []),
    { label: "Chapter VI-A deductions", amount: -round(via) },
    { label: "Taxable income (slab rates)", amount: round(taxableIncome) },
    { label: "Tax on slab income", amount: round(slabTax + rebate) },
    ...(rebate > 0 ? [{ label: "Rebate under Sec 87A", amount: -round(rebate) }] : []),
    ...(capitalGainsTax > 0 ? [{ label: "Capital gains tax (111A / 112A / property)", amount: round(capitalGainsTax) }] : []),
    ...(surcharge > 0 ? [{ label: `Surcharge @ ${(sRate * 100).toFixed(0)}%`, amount: round(surcharge) }] : []),
    { label: "Health & education cess @ 4%", amount: round(cess) },
    { label: "Total tax payable", amount: totalTax },
  ];

  return {
    regime,
    grossIncome: round(grossIncome),
    standardDeduction: round(standardDeduction),
    hraExempt: round(hraExempt),
    chapterVIA: round(via),
    otherExemptions: round(otherExemptions),
    taxableIncome: round(taxableIncome),
    specialRateIncome: round(specialRateIncome),
    slabTax: round(slabTax),
    capitalGainsTax: round(capitalGainsTax),
    rebate87A: round(rebate),
    surcharge: round(surcharge),
    cess: round(cess),
    totalTax,
    takeHome: round(grossIncome - totalTax),
    effectiveRatePct: grossIncome > 0 ? round((totalTax / grossIncome) * 10000) / 100 : 0,
    marginalRatePct,
    breakdown,
  };
}

// ─────────────────────────── DEDUCTION LEDGER ───────────────────────────

export function buildDeductionLedger(input: TaxInput): DeductionUsage[] {
  const c80 = Math.min(used80C(input), LIMIT_80C);
  const selfLimit = input.ageYears >= 60 ? 50000 : 25000;
  const parentLimit = input.d80d.parentsSenior ? 50000 : 25000;
  const limit80D = selfLimit + parentLimit;
  const npsCap = round(0.14 * input.salary.basic);

  return [
    {
      section: "80C", label: "EPF, PPF, ELSS, insurance, tuition, principal",
      limit: LIMIT_80C, used: c80, remaining: clamp0(LIMIT_80C - c80),
      allowedInNewRegime: false,
    },
    {
      section: "80CCD(1B)", label: "Additional NPS Tier-1 contribution",
      limit: LIMIT_80CCD1B, used: Math.min(input.d80ccd.additionalNps, LIMIT_80CCD1B),
      remaining: clamp0(LIMIT_80CCD1B - input.d80ccd.additionalNps),
      allowedInNewRegime: false,
    },
    {
      section: "80CCD(2)", label: "Employer NPS contribution",
      limit: npsCap, used: Math.min(input.d80ccd.employerNps, npsCap),
      remaining: clamp0(npsCap - input.d80ccd.employerNps),
      allowedInNewRegime: true,
      note: "Up to 14% of basic in the new regime, 10% in the old regime.",
    },
    {
      section: "80D", label: "Health insurance premium (self + parents)",
      limit: limit80D, used: used80D(input), remaining: clamp0(limit80D - used80D(input)),
      allowedInNewRegime: false,
    },
    {
      section: "24(b)", label: "Home-loan interest on self-occupied property",
      limit: LIMIT_24B, used: Math.min(input.otherDeductions.homeLoanInterestSelf, LIMIT_24B),
      remaining: clamp0(LIMIT_24B - input.otherDeductions.homeLoanInterestSelf),
      allowedInNewRegime: false,
    },
    {
      section: "HRA", label: "House rent allowance exemption",
      limit: 0, used: round(hraExemption(input)), remaining: 0,
      allowedInNewRegime: false,
    },
    {
      section: "80E", label: "Education-loan interest (no ceiling)",
      limit: 0, used: input.otherDeductions.educationLoanInterest, remaining: 0,
      allowedInNewRegime: false,
    },
    {
      section: input.ageYears >= 60 ? "80TTB" : "80TTA",
      label: input.ageYears >= 60 ? "Interest income for senior citizens" : "Savings-account interest",
      limit: input.ageYears >= 60 ? 50000 : 10000,
      used: input.ageYears >= 60
        ? Math.min(input.otherDeductions.seniorInterest80TTB, 50000)
        : Math.min(input.otherDeductions.savingsInterest80TTA, 10000),
      remaining: input.ageYears >= 60
        ? clamp0(50000 - input.otherDeductions.seniorInterest80TTB)
        : clamp0(10000 - input.otherDeductions.savingsInterest80TTA),
      allowedInNewRegime: false,
    },
  ];
}

// ─────────────────────────── OPPORTUNITIES ───────────────────────────

function buildOpportunities(
  input: TaxInput, ledger: DeductionUsage[], recommended: TaxRegime, marginalRate: number,
): TaxOpportunity[] {
  const out: TaxOpportunity[] = [];
  const mr = marginalRate / 100;
  const oldSide = recommended === "old";

  const c80 = ledger.find((l) => l.section === "80C")!;
  if (c80.remaining > 0) {
    out.push({
      id: "80c-headroom",
      title: `₹${c80.remaining.toLocaleString("en-IN")} of Section 80C is still unused`,
      section: "80C",
      priority: oldSide ? "high" : "low",
      additionalDeduction: c80.remaining,
      estimatedTaxSaving: oldSide ? round(c80.remaining * mr) : 0,
      regime: "old",
      reason: "Your EPF, PPF, ELSS, insurance premium, tuition fees and home-loan principal together have not reached the ₹1,50,000 ceiling.",
      action: "Top up with an ELSS SIP (3-year lock-in, equity growth) or PPF if you prefer certainty. Do not buy an endowment policy purely to fill this.",
    });
  }

  const nps1b = ledger.find((l) => l.section === "80CCD(1B)")!;
  if (nps1b.remaining > 0) {
    out.push({
      id: "80ccd1b-headroom",
      title: `Additional NPS deduction of ₹${nps1b.remaining.toLocaleString("en-IN")} is unclaimed`,
      section: "80CCD(1B)",
      priority: oldSide ? "high" : "low",
      additionalDeduction: nps1b.remaining,
      estimatedTaxSaving: oldSide ? round(nps1b.remaining * mr) : 0,
      regime: "old",
      reason: "80CCD(1B) sits over and above the 80C ceiling and is one of the few genuinely additive deductions left in the old regime.",
      action: "Contribute to NPS Tier-1 before 31 March. Accept the lock-in to 60 and the 40% annuitisation rule before you commit.",
    });
  }

  const nps2 = ledger.find((l) => l.section === "80CCD(2)")!;
  if (nps2.remaining > 1000) {
    out.push({
      id: "80ccd2-restructure",
      title: "Employer NPS is the only large deduction that survives the new regime",
      section: "80CCD(2)",
      priority: "high",
      additionalDeduction: nps2.remaining,
      estimatedTaxSaving: round(nps2.remaining * mr),
      regime: "both",
      reason: "Up to 14% of basic salary routed through employer NPS is deductible in the new regime, where 80C and 80D are not.",
      action: "Ask payroll to restructure part of your special allowance into employer NPS at the start of the next financial year.",
    });
  }

  const d80d = ledger.find((l) => l.section === "80D")!;
  if (d80d.used === 0) {
    out.push({
      id: "80d-missing",
      title: "No health insurance premium is being claimed",
      section: "80D",
      priority: "high",
      additionalDeduction: d80d.limit,
      estimatedTaxSaving: oldSide ? round(d80d.limit * mr) : 0,
      regime: "old",
      reason: "A missing 80D entry usually means missing health cover, which is a protection problem before it is a tax problem.",
      action: "Buy or record adequate family health cover, then claim the premium under 80D. Preventive health check-ups count up to ₹5,000.",
    });
  } else if (d80d.remaining > 0) {
    out.push({
      id: "80d-headroom",
      title: `₹${d80d.remaining.toLocaleString("en-IN")} of health-premium deduction is unused`,
      section: "80D",
      priority: "medium",
      additionalDeduction: d80d.remaining,
      estimatedTaxSaving: oldSide ? round(d80d.remaining * mr) : 0,
      regime: "old",
      reason: "Premiums paid for parents carry their own ceiling on top of your own family cover.",
      action: "If your parents' policy is paid by you, record and claim it. Never buy extra cover only to use the headroom.",
    });
  }

  if (input.salary.hra > 0 && input.hra.monthlyRentPaid === 0) {
    out.push({
      id: "hra-unclaimed",
      title: "You receive HRA but no rent is recorded",
      section: "HRA",
      priority: oldSide ? "high" : "medium",
      additionalDeduction: 0,
      estimatedTaxSaving: 0,
      regime: "old",
      reason: "HRA is fully taxable when no rent is actually paid. If you do pay rent, the exemption is being lost.",
      action: "Record the rent you actually pay and collect receipts. Landlord PAN is mandatory above ₹1,00,000 of annual rent.",
    });
  }

  const cg = input.capitalGains;
  const usedExempt = Math.min(cg.ltcgEquity, LTCG_112A_EXEMPT);
  if (usedExempt < LTCG_112A_EXEMPT) {
    const headroom = LTCG_112A_EXEMPT - usedExempt;
    out.push({
      id: "ltcg-harvest",
      title: `₹${headroom.toLocaleString("en-IN")} of the annual LTCG exemption is unused`,
      section: "112A",
      priority: "medium",
      additionalDeduction: headroom,
      estimatedTaxSaving: round(headroom * 0.125),
      regime: "both",
      reason: "Long-term equity gains up to ₹1,25,000 a year are exempt. Unused exemption does not carry forward.",
      action: "Consider harvesting long-term equity gains up to the exemption and reinvesting the same day, if it fits your plan.",
    });
  }

  if (cg.stcgEquity > 0) {
    out.push({
      id: "stcg-cost",
      title: "Short-term equity gains are taxed at 20%",
      section: "111A",
      priority: "medium",
      additionalDeduction: 0,
      estimatedTaxSaving: round(cg.stcgEquity * (0.20 - 0.125)),
      regime: "both",
      reason: "Holding listed equity beyond twelve months moves the gain from 20% to 12.5% with a ₹1,25,000 exemption.",
      action: "Where the investment thesis still holds, let positions cross the twelve-month mark before selling.",
    });
  }

  return out.sort((a, b) => b.estimatedTaxSaving - a.estimatedTaxSaving);
}

// ─────────────────────────── STRATEGIES ───────────────────────────

function buildStrategies(
  input: TaxInput, oldR: RegimeResult, newR: RegimeResult,
  recommended: TaxRegime, opportunities: TaxOpportunity[],
): TaxStrategy[] {
  const out: TaxStrategy[] = [];
  const delta = Math.abs(oldR.totalTax - newR.totalTax);

  out.push({
    id: "regime",
    name: recommended === "new" ? "Stay on the new regime" : "Opt into the old regime",
    description: recommended === "new"
      ? "With your current deduction profile the lower slab rates beat the deductions you can claim."
      : "Your verified deductions are large enough that the old regime's higher slabs still leave you ahead.",
    estimatedAnnualSaving: delta,
    cashRequired: 0,
    lockIn: "None",
    tradeOffs: recommended === "old"
      ? ["Requires proof for every deduction claimed.", "Salaried taxpayers can switch each year; business income cannot switch freely."]
      : ["Most deductions, including 80C and HRA, stop applying.", "Re-test the choice whenever your salary structure or home loan changes."],
    isRecommended: true,
  });

  const c80 = opportunities.find((o) => o.id === "80c-headroom");
  if (c80 && c80.additionalDeduction > 0) {
    out.push({
      id: "fill-80c",
      name: "Complete the 80C ceiling",
      description: `Direct ₹${c80.additionalDeduction.toLocaleString("en-IN")} into ELSS or PPF before 31 March.`,
      estimatedAnnualSaving: c80.estimatedTaxSaving,
      cashRequired: c80.additionalDeduction,
      lockIn: "ELSS 3 years · PPF 15 years",
      tradeOffs: ["Only worth doing if the old regime is your final choice.", "Never buy insurance to fill 80C."],
      isRecommended: recommended === "old" && c80.estimatedTaxSaving > 0,
    });
  }

  const nps = opportunities.find((o) => o.id === "80ccd1b-headroom");
  if (nps && nps.additionalDeduction > 0) {
    out.push({
      id: "nps-1b",
      name: "Use the additional NPS deduction",
      description: `Contribute ₹${nps.additionalDeduction.toLocaleString("en-IN")} to NPS Tier-1 under 80CCD(1B).`,
      estimatedAnnualSaving: nps.estimatedTaxSaving,
      cashRequired: nps.additionalDeduction,
      lockIn: "Until age 60, with 40% annuitisation",
      tradeOffs: ["Long lock-in.", "Annuity income at exit is taxable."],
      isRecommended: recommended === "old" && nps.estimatedTaxSaving > 0,
    });
  }

  const nps2 = opportunities.find((o) => o.id === "80ccd2-restructure");
  if (nps2) {
    out.push({
      id: "salary-restructure",
      name: "Restructure salary towards employer NPS",
      description: "Move part of your special allowance into employer NPS, which stays deductible even in the new regime.",
      estimatedAnnualSaving: nps2.estimatedTaxSaving,
      cashRequired: 0,
      lockIn: "Retirement-linked",
      tradeOffs: ["Reduces monthly take-home.", "Needs payroll approval and is usually only possible at the start of a financial year."],
      isRecommended: nps2.estimatedTaxSaving > 0,
    });
  }

  const harvest = opportunities.find((o) => o.id === "ltcg-harvest");
  if (harvest) {
    out.push({
      id: "harvest",
      name: "Harvest long-term equity gains",
      description: "Book long-term gains up to the ₹1,25,000 annual exemption and reinvest immediately.",
      estimatedAnnualSaving: harvest.estimatedTaxSaving,
      cashRequired: 0,
      lockIn: "None",
      tradeOffs: ["Brokerage and a one-day market gap.", "Pointless if you plan to hold for decades without rebalancing."],
      isRecommended: harvest.estimatedTaxSaving > 3000,
    });
  }

  if (input.otherIncome.interest > 40000) {
    out.push({
      id: "interest-shift",
      name: "Reconsider large fixed-deposit interest",
      description: "Interest income is taxed fully at your slab rate, unlike equity gains which are taxed at 12.5%.",
      estimatedAnnualSaving: 0,
      cashRequired: 0,
      lockIn: "None",
      tradeOffs: ["Only shift money that is genuinely long-term.", "Emergency-fund money should stay in FDs regardless of tax."],
      isRecommended: false,
    });
  }

  return out;
}

// ─────────────────────────── CHECKLIST ───────────────────────────

function buildChecklist(input: TaxInput, recommended: TaxRegime, opportunities: TaxOpportunity[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (recommended === "old") {
    items.push({
      id: "declare-regime",
      label: "Declare the old regime to payroll",
      detail: "Submit your regime choice and investment declaration so TDS is deducted correctly for the rest of the year.",
      deadline: "Before the payroll declaration window closes",
      priority: "high",
    });
    items.push({
      id: "proofs",
      label: "Collect investment and premium proofs",
      detail: "80C receipts, health-premium certificates, rent receipts with landlord PAN, home-loan interest certificate.",
      deadline: "January to February",
      priority: "high",
    });
  } else {
    items.push({
      id: "confirm-new",
      label: "Confirm the new regime with payroll",
      detail: "The new regime is the default. Confirm no unnecessary declarations are pending so TDS matches your actual liability.",
      deadline: "Before the payroll declaration window closes",
      priority: "medium",
    });
  }

  for (const o of opportunities.filter((x) => x.estimatedTaxSaving > 0).slice(0, 3)) {
    items.push({
      id: `act-${o.id}`,
      label: o.title,
      detail: o.action,
      deadline: "31 March",
      priority: o.priority,
    });
  }

  items.push({
    id: "advance-tax",
    label: "Check advance-tax instalments",
    detail: "If tax after TDS exceeds ₹10,000, advance tax is payable in four instalments. Capital gains change this mid-year.",
    deadline: "15 Jun · 15 Sep · 15 Dec · 15 Mar",
    priority: input.capitalGains.stcgEquity + input.capitalGains.ltcgEquity > 0 ? "high" : "medium",
  });
  items.push({
    id: "ais",
    label: "Reconcile Form 26AS and AIS",
    detail: "Match interest, dividend and capital-gains entries before filing so no mismatch notice arrives later.",
    deadline: "June, before filing",
    priority: "medium",
  });
  items.push({
    id: "file",
    label: "File the return",
    detail: "Run both regimes once more in the filing utility. A salaried taxpayer may switch regimes at filing time.",
    deadline: "31 July",
    priority: "high",
  });
  return items;
}

// ─────────────────────────── FINDINGS ───────────────────────────

function buildFindings(input: TaxInput, chosen: RegimeResult, other: RegimeResult, recommended: TaxRegime): TaxFinding[] {
  const f: TaxFinding[] = [];
  f.push({
    id: "regime",
    title: recommended === "new" ? "The new regime is cheaper for you this year" : "The old regime is cheaper for you this year",
    detail: `Choosing it instead of the alternative keeps ${inr(Math.abs(other.totalTax - chosen.totalTax))} with you for the year.`,
    tone: "success",
  });

  if (chosen.effectiveRatePct < 10 && chosen.grossIncome > 0) {
    f.push({
      id: "low-eff",
      title: "Your effective tax rate is already low",
      detail: "Further tax-driven purchases are unlikely to help. Optimise for the underlying financial job instead.",
      tone: "info",
    });
  }

  if (used80C(input) > LIMIT_80C) {
    f.push({
      id: "80c-over",
      title: "You are contributing beyond the 80C ceiling",
      detail: `${inr(used80C(input) - LIMIT_80C)} of your 80C-eligible contributions earns no deduction. That is fine if you want the product, wasteful if you bought it for tax.`,
      tone: "warning",
    });
  }

  if (input.d80c.lifeInsurancePremium > 50000 && input.d80c.elss === 0) {
    f.push({
      id: "endowment-risk",
      title: "A large insurance premium is filling your 80C",
      detail: "Traditional policies typically return 5-6%. Term cover plus an ELSS SIP usually protects better and grows faster.",
      tone: "warning",
    });
  }

  if (input.d80d.selfFamilyPremium === 0) {
    f.push({
      id: "no-health",
      title: "No health premium recorded",
      detail: "Missing health cover is a protection gap first and a lost deduction second.",
      tone: "danger",
    });
  }

  if (input.capitalGains.stcgEquity > 100000) {
    f.push({
      id: "churn",
      title: "Meaningful short-term equity churn",
      detail: "Short-term gains are taxed at 20% versus 12.5% for long-term. Frequent switching quietly transfers returns to tax.",
      tone: "warning",
    });
  }

  if (input.otherIncome.interest > 100000) {
    f.push({
      id: "interest-heavy",
      title: "Interest income is a large part of your total",
      detail: "Interest is taxed at your full slab rate, which makes it the least tax-efficient income you can hold at scale.",
      tone: "info",
    });
  }

  return f;
}

// ─────────────────────────── ORCHESTRATOR ───────────────────────────

export function analyzeTax(input: TaxInput): TaxReport {
  const oldR = computeRegime(input, "old");
  const newR = computeRegime(input, "new");

  const cheaper: TaxRegime = newR.totalTax <= oldR.totalTax ? "new" : "old";
  const recommended: TaxRegime = input.regimePreference ?? cheaper;
  const chosen = recommended === "new" ? newR : oldR;
  const other = recommended === "new" ? oldR : newR;

  // Zero-deduction baseline in the same regime - quantifies what the
  // deductions currently claimed are actually worth.
  const baselineInput: TaxInput = {
    ...input,
    hra: { ...input.hra, monthlyRentPaid: 0 },
    d80c: { epfEmployee: 0, ppf: 0, elss: 0, lifeInsurancePremium: 0, childTuition: 0, homeLoanPrincipal: 0, nsc: 0, other80c: 0 },
    d80ccd: { employeeNps: 0, additionalNps: 0, employerNps: 0 },
    d80d: { selfFamilyPremium: 0, parentsPremium: 0, parentsSenior: input.d80d.parentsSenior, preventiveHealthCheck: 0 },
    otherDeductions: {
      homeLoanInterestSelf: 0, educationLoanInterest: 0, charity80G: 0,
      savingsInterest80TTA: 0, seniorInterest80TTB: 0, disability80U: 0,
    },
  };
  const baseline = computeRegime(baselineInput, recommended);
  const estimatedTaxSaved = clamp0(baseline.totalTax - chosen.totalTax);

  const ledger = buildDeductionLedger(input);
  const opportunities = buildOpportunities(input, ledger, recommended, chosen.marginalRatePct);
  const strategies = buildStrategies(input, oldR, newR, recommended, opportunities);
  const checklist = buildChecklist(input, recommended, opportunities);
  const findings = buildFindings(input, chosen, other, recommended);

  const oi = input.otherIncome;
  const cg = input.capitalGains;
  const incomeComposition: CompositionSlice[] = [
    { label: "Salary", amount: round(totalSalary(input)) },
    { label: "Interest", amount: round(oi.interest) },
    { label: "Rental", amount: round(oi.rental) },
    { label: "Dividend", amount: round(oi.dividend) },
    { label: "Business", amount: round(oi.business) },
    { label: "Capital gains", amount: round(cg.ltcgEquity + cg.stcgEquity + cg.ltcgDebt + cg.stcgDebt + cg.ltcgProperty + cg.otherGains) },
    { label: "Other", amount: round(oi.other) },
  ].filter((s) => s.amount > 0);

  const taxComposition: CompositionSlice[] = [
    { label: "Slab tax", amount: chosen.slabTax },
    { label: "Capital gains tax", amount: chosen.capitalGainsTax },
    { label: "Surcharge", amount: chosen.surcharge },
    { label: "Cess", amount: chosen.cess },
  ].filter((s) => s.amount > 0);

  const remainingDeductionCapacity = recommended === "old"
    ? ledger.filter((l) => !l.allowedInNewRegime).reduce((a, l) => a + l.remaining, 0)
    : ledger.filter((l) => l.allowedInNewRegime).reduce((a, l) => a + l.remaining, 0);

  const contextSummary = [
    `${TAX_YEAR}. Gross income ${inr(chosen.grossIncome)}.`,
    `${recommended === "new" ? "New" : "Old"} regime recommended, saving ${inr(Math.abs(other.totalTax - chosen.totalTax))} against the alternative.`,
    `Total tax payable ${inr(chosen.totalTax)} at an effective rate of ${chosen.effectiveRatePct.toFixed(2)}%.`,
    remainingDeductionCapacity > 0
      ? `${inr(remainingDeductionCapacity)} of deduction capacity is still unused.`
      : "All usable deduction capacity is already claimed.",
  ].join(" ");

  return {
    taxYear: TAX_YEAR,
    ageYears: input.ageYears,
    employmentType: input.employmentType,
    grossIncome: chosen.grossIncome,
    recommendedRegime: recommended,
    regimeDeltaTax: Math.abs(oldR.totalTax - newR.totalTax),
    old: oldR,
    new: newR,
    totalTaxPayable: chosen.totalTax,
    estimatedTaxSaved,
    effectiveRatePct: chosen.effectiveRatePct,
    marginalRatePct: chosen.marginalRatePct,
    monthlyTdsEstimate: round(chosen.totalTax / 12),
    incomeComposition,
    taxComposition,
    deductions: ledger,
    remainingDeductionCapacity,
    opportunities,
    strategies,
    checklist,
    findings,
    contextSummary,
  };
}
