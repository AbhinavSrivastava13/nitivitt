import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/ai-coach")({
  head: () => ({
    meta: [
      { title: "NitiGuide™ — AI Financial Coach — NitiVitt" },
      {
        name: "description",
        content:
          "An AI coach that explains your numbers, never decides for you. Ask anything about your plan — get an answer with the math behind it.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="NitiGuide™"
      title="Help me understand."
      lede="AI assists. Mathematics decides. NitiGuide explains your numbers, your recommendations, and the trade-offs — in plain language."
    >
      <ModulePlaceholder
        module="NitiVitt AI Coach"
        description="A conversational layer that reads your profile, your NitiScore breakdown, and your active recommendations. It explains — it never calculates. Every answer is grounded in the deterministic engine."
        features={[
          "Explain any recommendation in plain English",
          "Walk through the math behind any score",
          "Compare trade-offs (e.g. prepay loan vs. invest)",
          "Define financial terms in context",
          "Never sells, never persuades, never invents numbers",
        ]}
      />
    </PageShell>
  ),
});
