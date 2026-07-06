import type { Article } from "../types";

export const understandingNitiscore: Article = {
  slug: "understanding-nitiscore",
  title: "Understanding NitiScore™",
  subtitle: "How NitiVitt scores your financial health on a single 0–1000 scale — and why every point has a reason.",
  category: "Foundations",
  readingMinutes: 6,
  updatedAt: "2026-07-01",
  author: "NitiVitt",
  summary:
    "NitiScore™ is a transparent, deterministic score built from six pillars of your financial life. Learn what it measures, how it's calculated, and how to move it in the right direction.",
  sections: [
    {
      heading: "What NitiScore actually measures",
      body:
        "NitiScore™ is a single number between 0 and 1000 that summarises how healthy your money life is right now. It's designed for Indian households, so it weighs things that matter here — emergency buffer in months of essentials, EMI-to-income ratio, term and health cover multiples, savings rate, retirement readiness and net worth.\n\nUnlike a credit score, NitiScore is not about how well you repay borrowed money. It's about whether your overall financial system — inflows, outflows, protection and long-term compounding — is set up to weather shocks and reach your goals.",
    },
    {
      heading: "The six pillars",
      body:
        "NitiScore is the weighted sum of six pillars. Each pillar has a formula from NitiCore™, our deterministic engine:\n\n- **Savings** — how much of your income you keep every month.\n- **Emergency Fund** — months of essential expenses you can cover from liquid savings.\n- **Debt** — how much of your monthly income is committed to EMIs.\n- **Insurance** — whether your term and health cover are sized correctly for your income and family.\n- **Investments & Net Worth** — how your assets minus liabilities are compounding.\n- **Retirement** — whether your current trajectory meets your target retirement corpus.\n\nEach pillar produces a score out of 100. Weights are applied and combined into the final 0–1000 number.",
    },
    {
      heading: "How the grade is decided",
      body:
        "A grade from A+ to D is assigned based on your final score, so you don't have to interpret the number in a vacuum. A+ means every pillar is healthy. B usually means one or two pillars are dragging the rest down. D means at least one foundational pillar (emergency, insurance, debt) needs urgent attention.\n\nBecause the score is deterministic, two people with the same numbers will always get the same score. There's no black box, no adjustment for arbitrary factors.",
    },
    {
      heading: "Moving the score",
      body:
        "The fastest levers, in order, are usually:\n\n1. Fill your emergency fund to 6× monthly essentials.\n2. Buy term insurance if you have dependents and don't have it.\n3. Bring EMIs below 20% of monthly income.\n4. Push savings rate above 30%.\n5. Automate SIPs into low-cost index funds.\n\nNitiPath™ ranks these for you based on your specific situation, so you never have to guess which move improves your score the most next month.",
    },
  ],
  keyTakeaways: [
    "NitiScore is a 0–1000 number built from six deterministic pillars.",
    "The grade (A+ to D) tells you at a glance whether every pillar is healthy.",
    "The score is fully transparent — every point comes from a formula you can inspect in your Financial Health Report.",
    "The fastest ways to move it are usually protection and buffer, not chasing returns.",
  ],
  relatedSlugs: ["understanding-nitiage", "emergency-fund", "insurance-planning"],
};
