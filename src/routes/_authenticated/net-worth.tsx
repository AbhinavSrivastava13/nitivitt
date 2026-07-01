import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/net-worth")({
  head: () => ({
    meta: [
      { title: "Net worth — NitiVitt" },
      {
        name: "description",
        content:
          "Track your real net worth — assets minus liabilities — with full transparency on every line item.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="What am I actually worth?"
      lede="A clean ledger of every asset and liability, updated as you live your financial life. No black boxes, no inflated numbers."
    >
      <ModulePlaceholder
        module="NitiVitt Net Worth"
        description="Categorised assets — liquid, investments, retirement, real estate, gold, other — minus categorised liabilities. Trended over time so you can see the trajectory, not just the snapshot."
        features={[
          "Asset & liability classification by category",
          "Net worth trend with monthly checkpoints",
          "Liquid vs. illiquid composition",
          "Debt-to-asset and debt-to-income ratios",
          "Concentration warnings (e.g. real estate > 60%)",
        ]}
      />
    </PageShell>
  ),
});
