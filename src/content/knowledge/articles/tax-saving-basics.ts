import type { Article } from "../types";

export const taxSavingBasics: Article = {
  slug: "tax-saving-basics",
  title: "Tax Saving Basics",
  subtitle: "How to think about tax deductions in India — old regime, new regime, and the trap of buying products for tax alone.",
  category: "Tax",
  readingMinutes: 6,
  updatedAt: "2026-06-10",
  author: "NitiVitt",
  summary:
    "Choosing the old vs new tax regime, understanding Section 80C, and why 'tax saving' should almost never be your primary reason to buy a financial product.",
  sections: [
    {
      heading: "Old regime vs new regime — the honest answer",
      body:
        "The **new regime** offers lower slab rates but disallows most deductions. The **old regime** keeps higher slabs but allows 80C (₹1.5 L), 80D (health premium), 80CCD(1B) NPS (₹50 k), HRA and home-loan interest.\n\nWhich wins depends entirely on your deductions. A simple rule: if your combined verified deductions (80C used, health premium paid, home-loan interest, HRA received) exceed ~₹3.5–4 lakh per year, old regime usually wins. Below that, new regime is often better and definitely simpler.\n\nRun both in the ITR utility every year before filing — the answer can flip when your salary structure or home-loan interest changes.",
    },
    {
      heading: "What Section 80C actually covers",
      body:
        "The 80C limit is ₹1.5 lakh combined across ALL of these:\n\n- **EPF** — your employee contribution counts.\n- **VPF** — voluntary top-up on EPF.\n- **PPF** — 15-year lock-in, tax-free interest.\n- **ELSS mutual funds** — 3-year lock-in, equity growth, taxed as equity LTCG on exit.\n- **Life insurance premium** — only on genuine term or endowment (up to 10% of sum assured).\n- **Home loan principal repayment**.\n- **Kids' school tuition fee** (not donation, not transport, not books).\n- **Sukanya Samriddhi** — for a daughter under 10.\n\nMost salaried people fill 80C with EPF + a bit of ELSS or PPF. Don't overthink it.",
    },
    {
      heading: "The extra ₹50k under NPS",
      body:
        "Under Section 80CCD(1B), you get an additional ₹50,000 deduction over and above 80C by contributing to NPS Tier-1. This is one of the few pure-benefit tax breaks in the code.\n\nNPS is a low-cost market-linked retirement product with partial equity allocation. The catch: it locks money until 60, and 40% must be annuitised (poor returns). Use it for the tax break and modest long-run growth, not as your primary retirement vehicle.",
    },
    {
      heading: "Why tax should never be the primary reason to buy",
      body:
        "The most damaging tax-driven purchases in India are:\n\n- **Endowment / money-back insurance** bought only for 80C — pays 5–6% over 20 years while promising 'tax-free'. A pure term + ELSS SIP wins by a large margin.\n- **ULIPs** — same problem, wrapped in complexity.\n- **Deep-in-the-money real estate** bought only for the home-loan interest deduction — you save ₹50k in tax on a ₹5 lakh cost.\n\nBuy financial products for what they do (protection, growth, liquidity). Then, from that shortlist, choose the tax-efficient version. Never the other way around.",
    },
    {
      heading: "A defensible tax stack",
      body:
        "For a mid-career salaried Indian in the old regime:\n\n1. EPF fills a chunk of 80C automatically.\n2. Add ELSS SIP or PPF to complete the ₹1.5 L 80C limit — favour ELSS if under 45 for growth.\n3. Add ₹50 k to NPS Tier-1 for the extra 80CCD(1B) deduction.\n4. Pay health insurance premium (80D, up to ₹25 k self + ₹50 k parents if senior).\n5. Claim HRA and home-loan interest where applicable.\n\nThat's usually the full old-regime deduction stack for a household — no exotic products needed.",
    },
  ],
  keyTakeaways: [
    "Choose old vs new regime by running actual numbers every year — no rule of thumb replaces this.",
    "80C is ₹1.5 L combined — EPF, ELSS and PPF are the workhorses.",
    "The ₹50k NPS deduction is genuine free money if you're OK with the lock-in.",
    "Never buy a financial product primarily for tax savings — buy for its actual job.",
  ],
  relatedSlugs: ["sip-for-beginners", "retirement-planning-india", "common-mistakes"],
};
