/**
 * Financial Advisor (V1) - shared types & catalogue.
 *
 * The Financial Advisor is NitiVitt's first human-assisted layer. Everything
 * deterministic (scores, ratings, NitiPath actions) is attached automatically
 * as a briefing so the advisor never starts from zero.
 */

export type AdvisorTopicId =
  | "tax_planning"
  | "investments"
  | "insurance"
  | "loans_debt"
  | "retirement"
  | "goal_planning"
  | "nri"
  | "business_finance"
  | "estate_planning"
  | "general_review";

export interface AdvisorTopic {
  id: AdvisorTopicId;
  label: string;
  description: string;
}

export const ADVISOR_TOPICS: AdvisorTopic[] = [
  { id: "tax_planning", label: "Tax Planning & Filing", description: "Regime choice, deductions, capital gains, ITR filing support." },
  { id: "investments", label: "Investments & Portfolio", description: "Fund selection, allocation, rebalancing, consolidation." },
  { id: "insurance", label: "Insurance & Protection", description: "Term, health, critical illness - adequacy and claim readiness." },
  { id: "loans_debt", label: "Loans & Debt", description: "Prepayment strategy, refinancing, EMI restructuring." },
  { id: "retirement", label: "Retirement Planning", description: "Corpus target, withdrawal strategy, NPS and EPF decisions." },
  { id: "goal_planning", label: "Goal Planning", description: "Home, education, marriage, sabbatical - funding roadmaps." },
  { id: "nri", label: "NRI Finances", description: "NRE/NRO, repatriation, DTAA, India-side investments." },
  { id: "business_finance", label: "Business & Freelance Finance", description: "Cashflow, advance tax, presumptive taxation, GST basics." },
  { id: "estate_planning", label: "Estate & Succession", description: "Nominations, will basics, family protection." },
  { id: "general_review", label: "Full Financial Review", description: "A calm, end-to-end look at everything you have." },
];

export type AdvisorPackageId = "quick" | "tax_filing" | "comprehensive";

export interface AdvisorPackage {
  id: AdvisorPackageId;
  name: string;
  priceInr: number;
  duration: string;
  tagline: string;
  includes: string[];
  featured?: boolean;
}

export const ADVISOR_PACKAGES: AdvisorPackage[] = [
  {
    id: "quick",
    name: "Quick Guidance",
    priceInr: 49,
    duration: "20-minute call",
    tagline: "One focused question, answered properly.",
    includes: [
      "20-minute 1:1 call with a fee-only advisor",
      "Your NitiVitt briefing shared with the advisor beforehand",
      "A short written summary of what was decided",
    ],
  },
  {
    id: "tax_filing",
    name: "Tax Filing Assistance",
    priceInr: 199,
    duration: "45-minute session + filing help",
    tagline: "Pay the least tax the law allows - correctly.",
    includes: [
      "45-minute session with a tax specialist",
      "Old vs New regime decision reviewed against your NitiTax™ analysis",
      "Deduction checklist and document guidance",
      "Help through the ITR filing process",
    ],
    featured: true,
  },
  {
    id: "comprehensive",
    name: "Comprehensive Review",
    priceInr: 499,
    duration: "60-minute deep dive + written plan",
    tagline: "Your whole financial life, reviewed by a human.",
    includes: [
      "60-minute deep-dive with a SEBI-registered, fee-only advisor",
      "Protection, debt, investments, tax and retirement reviewed together",
      "A written action plan you can execute",
      "One follow-up check-in",
    ],
  },
];

export function packageById(id: string): AdvisorPackage | undefined {
  return ADVISOR_PACKAGES.find((p) => p.id === id);
}

export interface AdvisorDocumentRef {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface AdvisorPreferredSlot {
  /** ISO date, e.g. 2026-03-14 */
  date: string;
  /** One of the fixed windows below. */
  window: AdvisorSlotWindow;
}

export type AdvisorSlotWindow = "morning" | "afternoon" | "evening" | "late_evening";

export const SLOT_WINDOWS: { id: AdvisorSlotWindow; label: string; hint: string }[] = [
  { id: "morning", label: "Morning", hint: "9:00 - 12:00" },
  { id: "afternoon", label: "Afternoon", hint: "12:00 - 16:00" },
  { id: "evening", label: "Evening", hint: "16:00 - 19:00" },
  { id: "late_evening", label: "Late evening", hint: "19:00 - 21:30" },
];

export function slotLabel(slot: AdvisorPreferredSlot): string {
  const w = SLOT_WINDOWS.find((x) => x.id === slot.window);
  const d = new Date(`${slot.date}T00:00:00`);
  const nice = Number.isNaN(d.getTime())
    ? slot.date
    : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${nice} · ${w?.label ?? slot.window} (${w?.hint ?? ""})`;
}

export type AdvisorPaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type AdvisorRequestStatus = "submitted" | "scheduled" | "completed" | "cancelled";

export interface AdvisorRequestListItem {
  id: string;
  referenceId: string;
  topics: AdvisorTopicId[];
  packageId: string;
  packageName: string;
  amountInr: number;
  paymentStatus: AdvisorPaymentStatus;
  status: AdvisorRequestStatus;
  preferredSlots: AdvisorPreferredSlot[];
  createdAt: string;
}

/** Deterministic briefing attached to every request. AI never writes this. */
export interface AdvisorBriefing {
  generatedAt: string;
  client: {
    firstName: string;
    ageYears: number;
    city: string | null;
    occupation: string | null;
    maritalStatus: string | null;
    dependents: number;
  };
  metrics: {
    nitiScore: number;
    nitiScoreGrade: string;
    nitiAge: number;
    nitiAgeDirection: string;
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRatePct: number;
    emergencyMonths: number;
    debtRatioPct: number;
    insuranceAdequacyPct: number;
    retirementStatus: string;
  };
  analyzers: {
    nitiSurePolicies: number;
    nitiSureAvgScore: number | null;
    nitiInvestPortfolios: number;
    nitiInvestValue: number;
    nitiInvestRating: string | null;
    nitiLoanCount: number;
    nitiLoanOutstanding: number;
    nitiTaxRegime: string | null;
    nitiTaxTotal: number | null;
  };
  context: {
    lifeStage: string;
    wealthStage: string;
    protectionPosture: string;
    liquidityHealth: string;
    summary: string;
  };
  topActions: { title: string; priority: string; nextAction: string }[];
  goals: { name: string; target: number; progress: number; targetDate: string | null }[];
}
