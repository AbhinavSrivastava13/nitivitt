import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/platform/empty-state";

export const Route = createFileRoute("/_authenticated/tax-planner")({
  head: () => ({
    meta: [
      { title: "NitiTax™ — Tax Planner — NitiVitt" },
      { name: "description", content: "Old vs New Regime, deductions and capital gains — decided cleanly. Coming soon." },
    ],
  }),
  component: TaxPlannerPage,
});

function TaxPlannerPage() {
  return (
    <PageShell
      eyebrow="Service · NitiTax™"
      title="Tax Planner"
      lede="Old vs New Regime, HRA, 80C, 80CCD, 80D, capital gains — every deduction and slab computed the NitiCore™ way."
    >
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon={Receipt}
          eyebrow="Coming next"
          title="NitiTax™ engine in progress"
          description="The Tax Planner architecture is in place — regime comparison, deductions and capital-gains engines land in the next milestone."
        />
      </div>
    </PageShell>
  );
}
