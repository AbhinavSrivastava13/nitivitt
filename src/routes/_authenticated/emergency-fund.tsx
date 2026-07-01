import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/emergency-fund")({
  head: () => ({
    meta: [
      { title: "Emergency fund planner — NitiVitt" },
      {
        name: "description",
        content:
          "Build a 6-month buffer the right way. Compute your target, gap, and a monthly savings plan that gets you to safety.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="The fund that lets you sleep at night."
      lede="Before you invest, you need a buffer. NitiVitt sizes your emergency fund to your real essential expenses and gives you the exact monthly plan to build it."
    >
      <ModulePlaceholder
        module="NitiVitt Emergency Fund"
        description="6 months of essential expenses, parked in liquid instruments — calculated from your real spending, not generic rules of thumb."
        features={[
          "Target = monthly essentials × 6 (configurable for variable income)",
          "Months-of-runway tracker linked to NitiScore",
          "Recommended liquid-fund allocation",
          "Auto-replenishment plan after a withdrawal",
        ]}
      />
    </PageShell>
  ),
});
