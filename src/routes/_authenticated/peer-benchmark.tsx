import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/peer-benchmark")({
  head: () => ({
    meta: [
      { title: "Peer benchmarking — NitiVitt" },
      {
        name: "description",
        content:
          "Anonymised, cohort-based benchmarking. See how your savings, investments, and net worth compare to similar Indians — privately.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Module"
      title="Where do I stand vs. peers?"
      lede="Privacy-preserving, cohort-based benchmarks. We never expose individual data — only anonymised distributions across age, income, city tier, and occupation."
    >
      <ModulePlaceholder
        module="NitiVitt Peer Benchmark"
        description="Compare your savings rate, investment rate, emergency-fund coverage, and net worth against anonymised cohorts of users like you. Designed to inform, not to shame."
        features={[
          "Cohort dimensions: age band, income range, city tier, occupation",
          "Percentile placement on each NitiScore pillar",
          "Benchmarks recompute monthly from the live user base",
          "Differential-privacy guarantees on every cohort",
          "Education-first framing — never competitive ranking",
        ]}
      />
    </PageShell>
  ),
});
