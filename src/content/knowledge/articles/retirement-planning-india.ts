import type { Article } from "../types";

export const retirementPlanningIndia: Article = {
  slug: "retirement-planning-india",
  title: "Retirement Planning in India",
  subtitle: "How much you actually need, and why starting at 30 costs a quarter of what it does at 45.",
  category: "Retirement",
  readingMinutes: 8,
  updatedAt: "2026-06-20",
  author: "NitiVitt",
  summary:
    "A realistic look at how big a retirement corpus Indian households need, why EPF alone rarely gets you there, and the deterministic math behind starting early.",
  sections: [
    {
      heading: "The retirement problem in one paragraph",
      body:
        "You will work for roughly 35 years and retire for roughly 25. Every rupee you spend in those 25 years has to come from money you've already saved and invested — because there's no pension for most private-sector Indians. Meanwhile, inflation at 6% doubles your monthly cost every 12 years. So the ₹60,000 lifestyle you enjoy today could cost ₹2 lakh at 60 and ₹5 lakh at 75.",
    },
    {
      heading: "How large a corpus you need",
      body:
        "A useful shortcut: **corpus needed ≈ future annual expenses × 25**.\n\nIf you'll want ₹1 lakh/month at retirement in today's money, at 6% inflation over 25 years that's roughly ₹4.3 lakh/month at 60. Annual: ~₹52 lakh. Corpus at 25×: **~₹13 crore**.\n\nThat number shocks most people. It shouldn't. It just reflects the reality of a 25-year retirement, inflation, and safe 4% withdrawal.\n\nEPF alone rarely gets you there. A typical mid-career EPF corpus tops out at ₹1–3 crore. The rest has to come from your own investing.",
    },
    {
      heading: "Why starting early is so cheap",
      body:
        "At 12% long-run return, the SIP required to reach ₹5 crore by age 60 is:\n\n- Start at 25: ₹9,000/month\n- Start at 30: ₹17,000/month\n- Start at 35: ₹31,000/month\n- Start at 40: ₹58,000/month\n- Start at 45: ₹1,20,000/month\n\nEvery 5-year delay roughly doubles the required monthly contribution. This is not motivational rhetoric — it's compounding math. Starting is more powerful than optimising.",
    },
    {
      heading: "Where to invest",
      body:
        "A defensible Indian retirement portfolio uses:\n\n- **EPF / VPF** — mandatory or voluntary, safe, 8%+ tax-free.\n- **PPF** — 15-year lock-in, tax-free, currently ~7.1%.\n- **NPS** — extra ₹50k 80CCD(1B) tax deduction, market-linked, low cost.\n- **Equity index mutual funds** — the growth engine. 60–70% of long-run allocation for most people under 45.\n- **Debt funds / govt bonds** — increase this from 40s onwards.\n\nAs you approach 60, gradually shift from equity to debt over 5–7 years so a bad final year of the market doesn't force you to sell low.",
    },
    {
      heading: "The 4% rule, adapted for India",
      body:
        "The classic '4% safe withdrawal rule' comes from US data. In India, given higher inflation and shorter historical bond returns, most planners use **3.5–4%** as a defensive number.\n\nThat means a ₹5 crore corpus safely supports about ₹17–20 lakh per year of pre-tax spending — around ₹1.4–1.7 lakh/month. Anything higher risks running out before you do.",
    },
  ],
  keyTakeaways: [
    "Target corpus ≈ future annual expenses × 25.",
    "Every 5-year delay roughly doubles the required monthly SIP.",
    "EPF alone rarely funds retirement — pair it with equity index SIPs, PPF and NPS.",
    "Safe withdrawal in India is around 3.5–4% of corpus per year.",
  ],
  relatedSlugs: ["sip-for-beginners", "mutual-funds-vs-fd", "tax-saving-basics"],
};
