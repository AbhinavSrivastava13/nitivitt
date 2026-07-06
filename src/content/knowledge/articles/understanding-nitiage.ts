import type { Article } from "../types";

export const understandingNitiage: Article = {
  slug: "understanding-nitiage",
  title: "Understanding NitiAge™",
  subtitle: "Your money habits, expressed as an age. Lower than your actual age is healthy — here's why.",
  category: "Foundations",
  readingMinutes: 5,
  updatedAt: "2026-07-01",
  author: "NitiVitt",
  summary:
    "NitiAge™ translates your savings rate, emergency buffer, debt load, insurance and investing habits into a single 'financial age'. If it's lower than your actual age, your habits are ahead of your years.",
  sections: [
    {
      heading: "The idea in one line",
      body:
        "Your NitiAge is your actual age adjusted for the quality of your money habits. If your financial habits look like a 32-year-old's despite being 40, your NitiAge is 32 — you are **ahead by 8 years**. If they look like a 46-year-old's, you are **behind by 6 years**.\n\nLower is healthier. That's the entire mental model.",
    },
    {
      heading: "How it's calculated",
      body:
        "NitiCore™ starts with your actual age and applies deterministic adjustments in years:\n\n- **Savings rate ≥ 30%** subtracts 3 years. Below 10% adds 3.\n- **Emergency fund ≥ 6 months** subtracts 3. Below 1 month adds 3.\n- **EMI ratio ≤ 20%** subtracts 2. Above 40% adds 3.\n- **Both term & health insurance** subtracts 1. Missing either adds 2.\n- **Investments > 15% of income** subtracts 1.\n\nThe total adjustment is bounded to ±10 years so no single number distorts the picture. The final NitiAge is `actual age + adjustment`, floored at 18.",
    },
    {
      heading: "Why 'ahead' and 'behind' are the right words",
      body:
        "If your financial age is lower than your actual age, you're demonstrating habits that most people reach later in life. That's a genuine advantage — you have more compounding runway, less catch-up to do, and more room to take measured risk.\n\nIf your financial age is higher, your habits are lagging where you are in life. That's not a judgement — it's a signal. Every year of lag translates into extra SIP required later to hit the same goals. The earlier you close the gap, the cheaper it is.",
    },
    {
      heading: "Where NitiAge is not the whole story",
      body:
        "NitiAge is a *behavioural* summary. It doesn't say anything about how much wealth you have — that's what Net Worth and NitiScore's Investments pillar are for. Someone with a large inherited corpus but weak habits can have a low net worth trajectory even with a young NitiAge, and vice versa.\n\nRead NitiAge alongside your NitiScore and Financial Health Report, not by itself.",
    },
  ],
  keyTakeaways: [
    "NitiAge is your actual age adjusted for habits — lower is healthier.",
    "Ahead by X years means your habits look like someone X years younger.",
    "Behind by X years is a signal, not a judgement — the fix is usually the top NitiPath™ action.",
    "It's a behavioural metric — combine it with Net Worth and NitiScore for the full picture.",
  ],
  relatedSlugs: ["understanding-nitiscore", "emergency-fund", "sip-for-beginners"],
};
