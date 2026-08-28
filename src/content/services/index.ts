/**
 * Services catalog - the SINGLE SOURCE OF TRUTH for NitiVitt service metadata.
 *
 * Homepage, Dashboard, /services, /services/$slug and the navbar all read from
 * here. Never hard-code a service name, tagline, icon, status or CTA anywhere
 * else - add it to this file instead.
 */
import { Sparkles, ShieldCheck, BarChart3, Landmark, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ServiceStatus = "Coming Soon" | "Beta" | "Live";

/** Typed app routes a service can open once the user is signed in. */
export type ServiceAppRoute =
  | "/financial-advisor"
  | "/insurance-analyzer"
  | "/portfolio-analyzer"
  | "/loan-analyzer"
  | "/tax-planner";

export interface Service {
  slug: string;
  /** Canonical, human-facing service name. Used everywhere. */
  name: string;
  /** Brand mark shown above the name on cards, e.g. "NitiSure™". */
  tag: string;
  tagline: string;
  status: ServiceStatus;
  category: "Advisory" | "Analysis" | "Planning";
  icon: LucideIcon;
  appRoute: ServiceAppRoute;
  featured?: boolean;
  /** One-line card copy - short, used in the grid on Home + Dashboard. */
  cardDescription: string;
  /** CTA shown to a signed-in user with no data yet. */
  ctaEmpty: string;
  /** CTA shown to a signed-in user who already has data. */
  ctaActive: string;
  shortDescription: string;
  whyItMatters: string;
  expectedBenefits: string[];
  whatYouReceive: string[];
  whyDifferent: string;
  visionSections: Array<{ heading: string; body: string }>;
}

/** Consistent CTA wording for a visitor who is not signed in. */
export const GUEST_CTA = "Sign in to Continue";

const SERVICES: Service[] = [
  {
    slug: "financial-advisor",
    name: "Financial Advisor",
    tag: "NitiVitt Advisory",
    tagline: "1:1 guidance from fee-only advisors, powered by your NitiVitt snapshot.",
    status: "Live",
    category: "Advisory",
    icon: Sparkles,
    appRoute: "/financial-advisor",
    featured: true,
    cardDescription:
      "1:1 sessions with fee-only advisors - powered by your full NitiVitt snapshot. No commissions, no product pitches, no cold calls.",
    ctaEmpty: "Talk to an Advisor",
    ctaActive: "Talk to an Advisor",
    shortDescription:
      "Request a private session with a fee-only advisor who reviews your NitiVitt snapshot with you - no commissions, no product-pushing.",
    whyItMatters:
      "Every serious financial decision - a house, a career change, a large inheritance - deserves a human conversation. NitiVitt gives you the numbers; a great advisor helps you weigh the trade-offs against your life.",
    expectedBenefits: [
      "A calm, confidential review of your NitiScore™, NitiAge™ and top NitiPath™ actions.",
      "A written plan you can act on - not a product pitch.",
      "Continuity: the same advisor over years, not a call-centre roulette.",
    ],
    whatYouReceive: [
      "A structured NitiCore™ briefing prepared automatically from your own data before the call.",
      "A scheduled 1:1 session at a time slot you choose.",
      "A written action plan with clear next steps and a reference ID you can track.",
    ],
    whyDifferent:
      "Ordinary advisory starts with a sales target and works backwards. NitiVitt Advisory starts with your deterministic NitiCore™ position - score, age, buffer, protection, debt, portfolio and tax - so the conversation begins where most advisors finish.",
    visionSections: [
      {
        heading: "How it works",
        body:
          "Pick the topics you want covered, describe your situation, attach any documents privately, choose your preferred time slots and a package. Your advisor receives a read-only NitiVitt briefing before the session - so you don't spend the first 20 minutes explaining your finances.",
      },
      {
        heading: "Why fee-only, always",
        body:
          "NitiVitt will never onboard commission-driven advisors. Fee-only means the advisor gets paid the same regardless of what you buy. It's the only model that aligns incentives with your outcomes - and it's the reason we say 'guidance, not sales'.",
      },
    ],
  },
  {
    slug: "insurance-analyzer",
    name: "Insurance Analyzer",
    tag: "NitiSure™",
    tagline: "See what you're actually covered for - and where you're exposed.",
    status: "Beta",
    category: "Analysis",
    icon: ShieldCheck,
    appRoute: "/insurance-analyzer",
    cardDescription: "Score every policy against real cover gaps.",
    ctaEmpty: "Analyze Policy",
    ctaActive: "Manage Policies",
    shortDescription:
      "Add your term, health, motor and property policies once. Get a plain-English map of what's covered, what isn't, and where you're over- or under-paying.",
    whyItMatters:
      "In India, insurance is bought by relationship, not need. Most people are simultaneously under-insured on term and health, and over-insured with endowment plans that don't protect anyone. NitiSure™ makes the gap visible.",
    expectedBenefits: [
      "Term-cover adequacy checked against income and dependents (NitiCore™ rules).",
      "Health-cover adequacy checked against city-tier medical costs.",
      "ULIP / endowment plans flagged with a fair, math-based verdict.",
      "A single premium calendar so nothing lapses silently.",
    ],
    whatYouReceive: [
      "A NitiSure™ protection score for every policy and for your portfolio as a whole.",
      "A gap report: how much cover you need versus how much you hold.",
      "A policy library you maintain once and reuse forever.",
    ],
    whyDifferent:
      "Comparison sites exist to sell you the next policy. NitiSure™ never routes you to an insurer - it tells you what cover you need and at what sum insured, then leaves the purchase entirely to you.",
    visionSections: [
      {
        heading: "Why we'll never sell insurance",
        body:
          "The Insurance Analyzer will never route you to a partner insurer. It tells you what type of cover you need, at what sum insured, and lets you buy it through any channel you prefer. Our credibility depends on us having no product in the sale.",
      },
      {
        heading: "The behaviours it fixes",
        body:
          "Mis-sold endowment plans, over-lapping health policies, term covers pegged at ₹1 crore for a family that needs ₹3 crore, expired motor renewals. The analyzer surfaces each of these before they hurt.",
      },
    ],
  },
  {
    slug: "portfolio-analyzer",
    name: "Portfolio Analyzer",
    tag: "NitiInvest™",
    tagline: "Portfolio intelligence, grounded in your whole financial life.",
    status: "Beta",
    category: "Analysis",
    icon: BarChart3,
    appRoute: "/portfolio-analyzer",
    cardDescription: "Overlap, concentration and drift across your holdings.",
    ctaEmpty: "Analyze Portfolio",
    ctaActive: "Manage Portfolio",
    shortDescription:
      "Upload broker screenshots from Groww, Zerodha, INDmoney, Upstox, Angel One or Paytm Money. NitiInvest™ scores your portfolio deterministically, checks concentration, allocation and diversification, and grounds every observation in your NitiCore™ context.",
    whyItMatters:
      "Most Indians own five mutual funds that look different but hold the same 50 stocks. NitiInvest™ doesn't just show you the pie chart - it tells you where you're duplicating risk, over-concentrated, and where your portfolio is out of step with your emergency fund, protection and life stage.",
    expectedBenefits: [
      "Deterministic NitiInvest™ rating with concentration and diversification breakdowns.",
      "Asset-allocation drift measured against NitiCore™'s age- and risk-adjusted target.",
      "Sector, market-cap and asset-class allocation surfaced clearly.",
      "Cross-pillar reasoning: portfolio advice honours the Emergency > Insurance > Debt > Investments hierarchy.",
    ],
    whatYouReceive: [
      "A full investment review with allocation, overlap and concentration visuals.",
      "A Portfolio Rating you can track over time.",
      "Fund-level intelligence and a benchmark against similar investors.",
    ],
    whyDifferent:
      "Tracking apps show you returns. NitiInvest™ judges the structure of your portfolio against your own financial position - buffer, protection, debt and life stage - not against a leaderboard.",
    visionSections: [
      {
        heading: "The problem it solves",
        body:
          "Indian investors accumulate holdings the way we accumulate WhatsApp groups - quickly, without pruning. Over a decade, portfolios drift into duplication, high costs and unmanaged concentration in a few large-caps. NitiInvest™ surfaces those patterns in a single view.",
      },
      {
        heading: "Grounded in NitiCore™",
        body:
          "NitiInvest™ shares the same deterministic engine that powers your NitiScore. Every observation is formula-driven - never 'the model thinks tech will do well'. AI is used only to explain, never to decide.",
      },
    ],
  },
  {
    slug: "loan-analyzer",
    name: "Loan Analyzer",
    tag: "NitiLoan™",
    tagline: "Every loan scored - Debt Health, Debt Freedom Age, prepay-vs-invest.",
    status: "Beta",
    category: "Planning",
    icon: Landmark,
    appRoute: "/loan-analyzer",
    cardDescription: "Debt Health, Debt Freedom Age, prepay-vs-invest.",
    ctaEmpty: "Analyze Loan",
    ctaActive: "Manage Loans",
    shortDescription:
      "Add each loan once. NitiLoan™ scores it deterministically - Debt Health Rating, Debt Freedom Age, repayment strategies and a prepay-vs-invest verdict grounded in your whole financial life.",
    whyItMatters:
      "Most Indian borrowers pay 60-90% of the loan amount in interest over 20 years. A ₹5,000 monthly prepayment on a ₹50 lakh home loan can cut 6+ years and lakhs in interest - but banks rarely tell you that, and prepaying isn't always right either.",
    expectedBenefits: [
      "Debt Health Rating across affordability, burden, interest cost, flexibility and debt quality.",
      "Debt Freedom Age under current, higher-EMI, annual-prepay and optimized strategies.",
      "Prepay-vs-invest verdict from post-tax cost vs realistic post-tax expected return.",
      "Cross-pillar check - buffer and protection are honoured before prepayment.",
    ],
    whatYouReceive: [
      "A Debt Health Rating for your whole borrowing position.",
      "Your Debt Freedom Age under four repayment strategies.",
      "A clear prepay-vs-invest verdict with the math shown.",
    ],
    whyDifferent:
      "EMI calculators answer 'what will I pay?'. NitiLoan™ answers 'what should I do?' - and refuses to recommend prepayment when your buffer or protection isn't in place first.",
    visionSections: [
      {
        heading: "How it decides",
        body:
          "NitiLoan™ compares the post-tax cost of your loan against a realistic post-tax expected return for your risk profile. If your home loan is 8.4% (post-tax ~5.9%) and your equity plan is expected to compound at 11%, prepayment isn't automatically right - it depends on your buffer, protection and life stage. NitiCore™ does the math; you get the verdict.",
      },
    ],
  },
  {
    slug: "tax-planner",
    name: "Tax Planner",
    tag: "NitiTax™",
    tagline: "A tax decision engine, not a calculator.",
    status: "Beta",
    category: "Planning",
    icon: Receipt,
    appRoute: "/tax-planner",
    cardDescription: "Old vs new regime, deductions and a year-end action plan.",
    ctaEmpty: "Run Tax Review",
    ctaActive: "Manage Tax Reviews",
    shortDescription:
      "A guided walkthrough that picks the right regime for your salary structure, surfaces the deductions you're actually eligible for, and estimates capital-gains tax on planned exits - before you file.",
    whyItMatters:
      "Tax is the single largest annual expense for most salaried Indians. Choosing the wrong regime, or missing a deduction, quietly costs ₹30,000-₹1,00,000 every year. Multiplied over a career, it's a house down-payment.",
    expectedBenefits: [
      "Regime decision (old vs new) grounded in your actual salary structure.",
      "Deduction checklist tailored to 80C / 80D / 80CCD / HRA / home-loan usage.",
      "Capital-gains estimator for planned equity/debt/property exits.",
      "A calendar of tax-relevant dates so nothing surprises you in March.",
    ],
    whatYouReceive: [
      "A regime verdict with the full tax computation for both regimes.",
      "A personalised deduction checklist with the rupee impact of each.",
      "A saved tax review you can revisit and compare through the year.",
    ],
    whyDifferent:
      "Filing portals optimise the return you're about to submit. NitiTax™ optimises the decisions you make during the year - so by filing season the number is already as low as it legally can be.",
    visionSections: [
      {
        heading: "Not a tax-filing tool",
        body:
          "The Tax Planner will not file your return. It does something more valuable: it helps you make tax-aware decisions during the year - when you get an appraisal, when you plan a redemption, when you take a home loan - so that by the time filing season arrives, the number is already optimised.",
      },
    ],
  },
];

/** Ordered list used by the grid layouts: featured first, then the analyzers. */
export const ADVISOR_SERVICE = SERVICES.find((s) => s.featured)!;
export const ANALYZER_SERVICES = SERVICES.filter((s) => !s.featured);
export const ALL_SERVICES = SERVICES;

export function statusToneClasses(status: ServiceStatus): string {
  if (status === "Live") return "bg-success-soft text-success";
  if (status === "Beta") return "bg-secondary-soft text-secondary";
  return "bg-muted text-muted-foreground";
}

export async function listServices(): Promise<Service[]> {
  return SERVICES;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return SERVICES.find((s) => s.slug === slug) ?? null;
}

export function listServiceSlugs(): string[] {
  return SERVICES.map((s) => s.slug);
}
