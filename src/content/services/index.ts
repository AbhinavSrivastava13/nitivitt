/**
 * Services catalog — NitiVitt's future ecosystem of paid & partner services.
 *
 * Same CMS-swap boundary as the Knowledge Hub: routes only depend on these
 * types. Today they're static; tomorrow this file can be swapped for a
 * Supabase or CMS fetch without touching the UI.
 */

export type ServiceStatus = "Coming Soon" | "Beta" | "Available";

export interface Service {
  slug: string;
  name: string;
  tagline: string;
  status: ServiceStatus;
  category: "Advisory" | "Analysis" | "Planning";
  shortDescription: string;
  whyItMatters: string;
  expectedBenefits: string[];
  visionSections: Array<{ heading: string; body: string }>;
}

const SERVICES: Service[] = [
  {
    slug: "financial-advisor",
    name: "Connect with a Financial Advisor",
    tagline: "1:1 conversations with SEBI-registered, fee-only advisors.",
    status: "Coming Soon",
    category: "Advisory",
    shortDescription:
      "Book a private session with a SEBI-registered advisor who reviews your NitiVitt snapshot with you — no commissions, no product-pushing.",
    whyItMatters:
      "Every serious financial decision — a house, a career change, a large inheritance — deserves a human conversation. NitiVitt gives you the numbers; a great advisor helps you weigh the trade-offs against your life.",
    expectedBenefits: [
      "A calm, confidential review of your NitiScore™, NitiAge™ and top NitiPath™ actions.",
      "A written plan you can act on — not a product pitch.",
      "Continuity: the same advisor over years, not a call-centre roulette.",
    ],
    visionSections: [
      {
        heading: "How it will work",
        body:
          "Once live, you'll be able to browse a curated panel of SEBI-registered, fee-only advisors filtered by specialisation (young families, NRIs, business owners, pre-retirees). Every advisor gets a read-only view of your NitiVitt snapshot before the session — so you don't spend the first 20 minutes explaining your finances.",
      },
      {
        heading: "Why fee-only, always",
        body:
          "NitiVitt will never onboard commission-driven advisors. Fee-only means the advisor gets paid the same regardless of what you buy. It's the only model that aligns incentives with your outcomes — and it's the reason we say ‘guidance, not sales’.",
      },
    ],
  },
  {
    slug: "portfolio-analyzer",
    name: "Portfolio Analyzer",
    tagline: "Deep, honest analysis of what you actually own.",
    status: "Coming Soon",
    category: "Analysis",
    shortDescription:
      "Upload or link your holdings and see them scored against NitiVitt's asset-allocation model — with concentration, overlap, expense-ratio and tax-efficiency called out clearly.",
    whyItMatters:
      "Most Indians own five mutual funds that look different but hold the same 50 stocks. A good analyser doesn't just show you the pie chart — it tells you where you're duplicating risk, paying too much, and missing what you should own.",
    expectedBenefits: [
      "Fund overlap and concentration risk quantified.",
      "Expense ratios benchmarked against low-cost alternatives.",
      "Tax-efficiency review of debt, equity and hybrid holdings.",
      "A prioritised list of consolidation actions — no fund-of-the-month.",
    ],
    visionSections: [
      {
        heading: "The problem it solves",
        body:
          "Indian investors accumulate holdings the way we accumulate WhatsApp groups — quickly, without pruning. Over a decade, portfolios drift into duplication, high costs and unmanaged concentration in a few large-caps. The Portfolio Analyzer will surface those patterns in a single view.",
      },
      {
        heading: "Grounded in NitiCore™",
        body:
          "The analyser will use the same deterministic engine that powers your NitiScore. Recommendations will remain formula-driven — never ‘the advisor thinks tech will do well’. You'll always see the math behind every suggested action.",
      },
    ],
  },
  {
    slug: "insurance-analyzer",
    name: "Insurance Analyzer",
    tagline: "See what you're actually covered for — and where you're exposed.",
    status: "Coming Soon",
    category: "Analysis",
    shortDescription:
      "Add your term, health, motor and property policies once. Get a plain-English map of what's covered, what isn't, and where you're over- or under-paying.",
    whyItMatters:
      "In India, insurance is bought by relationship, not need. Most people are simultaneously under-insured on term and health, and over-insured with endowment plans that don't protect anyone. This tool will make the gap visible.",
    expectedBenefits: [
      "Term-cover adequacy checked against income and dependents (NitiCore rules).",
      "Health-cover adequacy checked against city-tier medical costs.",
      "ULIP / endowment plans flagged with a fair, math-based verdict.",
      "A single premium calendar so nothing lapses silently.",
    ],
    visionSections: [
      {
        heading: "Why we'll never sell insurance",
        body:
          "The Insurance Analyzer will never route you to a partner insurer. It will tell you what type of cover you need, at what sum insured, and let you buy it through any channel you prefer. Our credibility depends on us having no product in the sale.",
      },
      {
        heading: "The behaviours it fixes",
        body:
          "Mis-sold endowment plans, over-lapping health policies, term covers pegged at ₹1 crore for a family that needs ₹3 crore, expired motor renewals. The analyser will surface each of these before they hurt.",
      },
    ],
  },
  {
    slug: "loan-optimizer",
    name: "Loan Optimizer",
    tagline: "Prepay, refinance, or keep — grounded in real math.",
    status: "Coming Soon",
    category: "Planning",
    shortDescription:
      "Enter your loans once. See the exact prepayment schedule, refinance case, tenure-vs-EMI trade-offs and the interest saved — before your bank ever calls you.",
    whyItMatters:
      "Most home-loan borrowers pay 60–90% of the loan amount in interest over 20 years. A ₹5,000 monthly prepayment on a ₹50 lakh home loan can cut 6+ years and lakhs in interest — but banks rarely tell you that.",
    expectedBenefits: [
      "Amortisation schedules generated deterministically by NitiCore™.",
      "Prepayment ‘what-if’ curves — tenure saved vs interest saved.",
      "Refinance case with switching-cost, break-even and after-tax comparison.",
      "Debt-vs-invest verdict when you have surplus cash flow.",
    ],
    visionSections: [
      {
        heading: "How it will decide",
        body:
          "The optimizer will compare the after-tax cost of your loan against the realistic after-tax return of your alternative use of the money. If your home loan is 8.4% and your equity SIP is expected to compound at 11%, prepayment isn't automatically ‘right’ — it depends on your buffer, your goals and your risk profile. NitiCore will do the math; you get the verdict.",
      },
    ],
  },
  {
    slug: "tax-planner",
    name: "Tax Planner",
    tagline: "Old vs new regime, deductions, and capital-gains — decided cleanly.",
    status: "Coming Soon",
    category: "Planning",
    shortDescription:
      "A guided walkthrough that picks the right regime for your salary structure, surfaces the deductions you're actually eligible for, and estimates capital-gains tax on planned exits — before you file.",
    whyItMatters:
      "Tax is the single largest annual expense for most salaried Indians. Choosing the wrong regime, or missing a deduction, quietly costs ₹30,000–₹1,00,000 every year. Multiplied over a career, it's a house down-payment.",
    expectedBenefits: [
      "Regime decision (old vs new) grounded in your actual salary structure.",
      "Deduction checklist tailored to 80C / 80D / 80CCD / HRA / home-loan usage.",
      "Capital-gains estimator for planned equity/debt/property exits.",
      "A calendar of tax-relevant dates so nothing surprises you in March.",
    ],
    visionSections: [
      {
        heading: "Not a tax-filing tool",
        body:
          "The Tax Planner will not file your return. It will do something more valuable: help you make tax-aware decisions during the year — when you get an appraisal, when you plan a redemption, when you take a home loan — so that by the time filing season arrives, the number is already optimised.",
      },
    ],
  },
];

export async function listServices(): Promise<Service[]> {
  return SERVICES;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return SERVICES.find((s) => s.slug === slug) ?? null;
}

export function listServiceSlugs(): string[] {
  return SERVICES.map((s) => s.slug);
}
