import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/insurance")({
  head: () => ({
    meta: [
      { title: "Insurance analysis — NitiVitt" },
      {
        name: "description",
        content:
          "Term + health cover analysis. We compute recommended cover, current cover, the gap, and the monthly premium fit — no products sold.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="Am I protected?"
      lede="A clean view of how much term and health cover you need, how much you have, and where the gap is. We never sell policies — we explain what you actually need."
    >
      <ModulePlaceholder
        module="NitiVitt Insurance"
        description="Term cover sized to your income, liabilities and liquid assets. Health cover sized to family composition and city tier. Transparent, formula-driven, never commission-driven."
        features={[
          "Term cover = (15–20× annual income) + liabilities − liquid assets",
          "Health cover guidance by family size and city tier",
          "Critical-illness and disability gap analysis",
          "Cover vs. premium efficiency benchmarks",
          "Education-first: every assumption disclosed",
        ]}
      />
    </PageShell>
  ),
});
