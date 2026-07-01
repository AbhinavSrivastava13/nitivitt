import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/retirement")({
  head: () => ({
    meta: [
      { title: "Retirement planning — NitiVitt" },
      {
        name: "description",
        content:
          "Compute your retirement corpus, monthly SIP, and on-track status — inflation-adjusted and post-retirement-return-aware.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="Will I have enough?"
      lede="The single question retirement planning has to answer. NitiVitt inflates today's expenses to your retirement year, projects your corpus, and tells you exactly how much further you need to go."
    >
      <ModulePlaceholder
        module="NitiVitt Retirement"
        description="Corpus needed for your post-retirement lifestyle, accounting for inflation, expected returns, and longevity. Every formula is auditable."
        features={[
          "Inflation-adjusted post-retirement monthly expenses",
          "Required corpus using the present-value-of-annuity model",
          "Current projection vs. target — clear gap analysis",
          "Recommended monthly contribution",
          "Sensitivity: retire 5 years earlier? Inflation +1%?",
        ]}
      />
    </PageShell>
  ),
});
