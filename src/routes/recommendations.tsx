import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { RecommendationCard, type Recommendation } from "@/components/recommendation-card";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Recommendations — NitiVitt" },
      {
        name: "description",
        content:
          "Every NitiVitt recommendation discloses its reason, logic, assumptions, calculation, action, and confidence — never a black box.",
      },
    ],
  }),
  component: RecommendationsPage,
});

const SAMPLE: Recommendation[] = [
  {
    title: "Build your emergency fund to 6 months of essentials",
    reason: "Your liquid savings currently cover only 2.1 months of essential expenses.",
    logic:
      "A 6-month buffer protects you from income shocks without forcing you to liquidate long-term investments at a loss.",
    assumptions: [
      "Monthly essential expenses ≈ ₹45,000",
      "Liquid fund yield ≈ 6% p.a.",
      "No major lifestyle change in the next 12 months",
    ],
    calculation: "Target = ₹45,000 × 6 = ₹2,70,000. Gap = ₹2,70,000 − ₹95,000 = ₹1,75,000.",
    action: "Save ₹14,600 every month for 12 months into a liquid fund.",
    confidence: "high",
    priority: "high",
    impact: "Removes the largest single risk to your plan today.",
    timeHorizon: "12 months",
    risk: "Low — capital preservation focused.",
  },
  {
    title: "Add a ₹50L term life cover",
    reason:
      "Your dependants would face a shortfall of ~15× annual income if your income stopped today.",
    logic:
      "Term life is the cheapest, purest way to replace lost income. Sized to 15× annual income + liabilities − liquid assets.",
    assumptions: [
      "Annual income ≈ ₹14.4L",
      "Liabilities ≈ ₹8.5L",
      "Liquid assets ≈ ₹0.95L",
      "Multiplier 15× (mid-career, single earner)",
    ],
    calculation: "(14.4L × 15) + 8.5L − 0.95L ≈ ₹2.23 Cr recommended cover.",
    action: "Compare pure term policies for ~₹2 Cr cover, 30-year tenure, claim-settlement ratio > 97%.",
    confidence: "high",
    priority: "high",
    impact: "Protects your family's standard of living for the next 30 years.",
    timeHorizon: "Buy this month",
    risk: "None — term insurance has no investment component.",
  },
  {
    title: "Increase monthly SIP by ₹6,000",
    reason: "You're investing 15% of income; the long-term wealth target is 20%.",
    logic:
      "A 5-percentage-point uplift, compounded across 25 years at 11% p.a. real, materially changes your retirement corpus.",
    calculation: "Δ ₹6,000/mo × 12 × 25 years @ 11% → ≈ ₹85 L additional corpus.",
    action: "Step up the existing index-fund SIP by ₹6,000/month starting next salary cycle.",
    confidence: "medium",
    priority: "medium",
    impact: "Closes ~38% of your retirement gap.",
    timeHorizon: "Long term · 25+ years",
    risk: "Market — equity volatility over short horizons.",
  },
];

function RecommendationsPage() {
  return (
    <PageShell
      eyebrow="What should I do next?"
      title="Recommendations, fully explained."
      lede="No vague 'buy this fund' suggestions. Every recommendation discloses the math behind it so you can audit, question, or override it."
    >
      <div className="grid gap-5">
        {SAMPLE.map((r) => (
          <RecommendationCard key={r.title} rec={r} />
        ))}
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        These are illustrative recommendations against a demo profile. Personalised recommendations
        will activate once your financial profile is connected.
      </p>
    </PageShell>
  );
}
