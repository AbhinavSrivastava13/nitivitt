import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Hub — NitiVitt" },
      {
        name: "description",
        content:
          "Plain-language explanations of every financial concept NitiVitt uses — from SIP to inflation, term insurance to the 25× rule.",
      },
    ],
  }),
  component: KnowledgeHub,
});

const TOPICS = [
  { title: "What is a NitiScore?", time: "3 min", category: "Foundations" },
  { title: "Why 6 months of emergency fund?", time: "4 min", category: "Safety" },
  { title: "Term vs. endowment insurance", time: "5 min", category: "Protection" },
  { title: "SIP math: how compounding actually works", time: "6 min", category: "Investing" },
  { title: "Inflation-adjusted retirement planning", time: "7 min", category: "Retirement" },
  { title: "Debt-to-income: the 20/36 rule", time: "4 min", category: "Debt" },
  { title: "Equity vs. debt allocation by age", time: "5 min", category: "Investing" },
  { title: "Goal probability and sensitivity", time: "6 min", category: "Planning" },
];

function KnowledgeHub() {
  return (
    <PageShell
      eyebrow="Knowledge Hub"
      title="Understand the money behind the math."
      lede="Every concept NitiVitt uses, explained in plain English. Because better decisions start with better understanding."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => (
          <article
            key={t.title}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              {t.category}
            </p>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{t.title}</h3>
            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.time} read</span>
              <span className="text-primary transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
