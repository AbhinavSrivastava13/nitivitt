import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "NitiSim™ Simulator — NitiVitt" },
      {
        name: "description",
        content:
          "Simulate any 'what if' before you act — retire 5 years earlier, market crash, salary cut, second child. See the impact on your plan instantly.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="NitiSim™"
      title="What happens if…"
      lede="The most important financial decisions are the ones you can't undo. NitiSim lets you stress-test your plan against every realistic scenario before you commit."
    >
      <ModulePlaceholder
        module="NitiVitt Simulator"
        description="A deterministic scenario engine layered on top of your financial profile. Change one assumption at a time — or all of them at once — and watch every downstream number recompute live."
        features={[
          "Retire 5 years earlier — corpus shortfall, required SIP uplift",
          "Income shock — runway, recovery plan",
          "Inflation +1% — corpus impact, SIP adjustment",
          "Job switch with relocation — net cashflow delta",
          "Children's education timeline change",
        ]}
      />
    </PageShell>
  ),
});
