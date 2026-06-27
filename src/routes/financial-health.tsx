import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/financial-health")({
  head: () => ({
    meta: [
      { title: "Financial health — NitiVitt" },
      {
        name: "description",
        content:
          "Your financial health, beyond a single score. Six pillars, every metric explained, every weakness paired with an action.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="How healthy are my finances?"
      lede="The NitiScore answers in one number. This page answers in detail — every pillar, every ratio, every benchmark, every next step."
    >
      <ModulePlaceholder
        module="NitiVitt Financial Health"
        description="A deeper view of the six NitiScore pillars: how each one is measured, what the healthy range looks like, and exactly which action will move it."
        features={[
          "Savings rate trend (target 30%)",
          "Emergency fund coverage in months",
          "Insurance adequacy gap analysis",
          "Investment rate (target 20%) and asset allocation",
          "Debt-to-income and debt-to-asset ratios",
          "Retirement readiness vs. age-adjusted target",
        ]}
      />
    </PageShell>
  ),
});
