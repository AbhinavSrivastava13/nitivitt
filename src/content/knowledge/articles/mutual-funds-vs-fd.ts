import type { Article } from "../types";

export const mutualFundsVsFd: Article = {
  slug: "mutual-funds-vs-fd",
  title: "Mutual Funds vs Fixed Deposits",
  subtitle: "Two very different tools, often used interchangeably. Here's when each one is actually the right answer.",
  category: "Investing",
  readingMinutes: 7,
  updatedAt: "2026-06-25",
  author: "NitiVitt",
  summary:
    "Fixed deposits give certainty. Mutual funds give growth. Choosing between them depends on your goal's time horizon, tax bracket and risk appetite — not on what your parents used.",
  sections: [
    {
      heading: "The core difference",
      body:
        "A **fixed deposit (FD)** is a loan you make to a bank. In return, the bank promises a fixed interest rate for a fixed period. The return is capped and known.\n\nA **mutual fund** is a pooled investment that owns a basket of underlying assets — equity shares, government bonds, corporate debt, or a mix. Its value moves with the market. The return is uncertain but potentially higher.\n\nThe temptation to compare their headline rates directly is the single biggest source of confusion in Indian personal finance. They serve different jobs.",
    },
    {
      heading: "When an FD is the right answer",
      body:
        "FDs are ideal when:\n\n- **You need certainty.** Money you'll use within 3 years — down payment, school fee, upcoming surgery.\n- **You cannot tolerate any drawdown.** Emergency fund, parents' living expenses.\n- **You have a specific ₹ amount to hit on a specific date.**\n\nCurrent FD rates in India are 5.5–7.5% pre-tax depending on tenure and bank. After tax at 30%, that's often 4–5% net — barely ahead of inflation. That's fine when the job is certainty, not growth.",
    },
    {
      heading: "When a mutual fund is the right answer",
      body:
        "Mutual funds — especially equity index funds — are ideal when:\n\n- **The horizon is 7+ years.** Retirement, a child's college fund 15 years out, a house down payment 8 years away.\n- **You want inflation-beating growth.** Historical long-run equity return in India is 11–13%. Even after tax, that's a large gap over FDs.\n- **You can automate contributions and ignore short-term moves.** SIPs into an index fund require you to look away.\n\nFor 3–7 year horizons, hybrid or short-duration debt funds sit between the two, offering higher-than-FD returns with less volatility than equity.",
    },
    {
      heading: "The taxation gap",
      body:
        "Interest on FDs is taxed at your slab rate — up to 30% + surcharge. So a 7% FD becomes 4.9% after tax at 30%.\n\nEquity mutual funds are taxed differently: 12.5% long-term capital gains (LTCG) after one year, with ₹1.25 lakh gain per year exempt. Debt mutual funds are now taxed at slab rate too, so the tax edge sits mostly with equity.\n\nOver 20 years, this tax gap alone can double the effective return of equity mutual funds compared to FDs.",
    },
    {
      heading: "A simple allocation rule",
      body:
        "Use FDs for **needs within 3 years**. Use equity mutual funds for **needs beyond 7 years**. In between, split — or use hybrid funds.\n\nDo not use FDs for retirement (you'll underrun inflation). Do not use equity mutual funds for your down payment two years away (you might have to sell in a drawdown). Match tool to horizon.",
    },
  ],
  keyTakeaways: [
    "FDs give certainty; equity mutual funds give growth. They aren't substitutes.",
    "Rule of thumb: FDs for <3 years, equity mutual funds for >7 years.",
    "After tax, equity mutual funds usually win over FDs on long horizons.",
    "Match the tool to the time horizon, not to your comfort zone.",
  ],
  relatedSlugs: ["sip-for-beginners", "emergency-fund", "retirement-planning-india"],
};
