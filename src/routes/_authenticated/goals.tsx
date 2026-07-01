import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goal planning — NitiVitt" },
      {
        name: "description",
        content:
          "Plan home, car, education, retirement, and custom goals with transparent math — target, time horizon, monthly SIP, sensitivity.",
      },
      { property: "og:title", content: "Goal planning — NitiVitt" },
      {
        property: "og:description",
        content: "Every goal, broken into target, gap, action, and probability.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="Plan every goal with math, not guesswork."
      lede="Tell NitiVitt where you want to be. We compute the corpus you need, the SIP that gets you there, and what changes if inflation, returns, or your timeline shift."
    >
      <ModulePlaceholder
        module="NitiVitt Goals"
        description="A goal-first planning engine for home, education, retirement, vacation, business, and fully custom goals. Inputs flow into deterministic formulas — no opinion required."
        features={[
          "Target amount inflated to your goal year",
          "Existing corpus projected forward at expected return",
          "Required monthly SIP and the gap-closing path",
          "Sensitivity analysis: ±return, ±inflation, ±time",
          "Goal probability and confidence band",
          "Linked to NitiScore so progress is always visible",
        ]}
      />
    </PageShell>
  ),
});
