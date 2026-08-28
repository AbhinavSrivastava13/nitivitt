import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listServices, statusToneClasses } from "@/content/services";
import type { Service } from "@/content/services";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services - NitiVitt" },
      {
        name: "description",
        content:
          "NitiVitt's services - Financial Advisor, Insurance Analyzer, Portfolio Analyzer, Loan Analyzer and Tax Planner. Guidance, never commissions.",
      },
      { property: "og:title", content: "Services - NitiVitt" },
      {
        property: "og:description",
        content:
          "Financial Advisor plus four analyzers - insurance, portfolio, loan and tax - all grounded in NitiCore™ math.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => ({ services: await listServices() }),
  component: ServicesPage,
});

function ServicesPage() {
  const { services } = Route.useLoaderData();
  return (
    <PageShell
      eyebrow="Services"
      title="One flagship advisor. Four analyzers behind it."
      lede="Every NitiVitt service is fee-only and grounded in NitiCore™ math. Open any service below to see exactly what it does, what you receive, and why it is different from an ordinary tool."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((s: Service) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.slug}
              to="/services/$slug"
              params={{ slug: s.slug }}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/15 transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/40">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/90">{s.tag}</p>
                    <h3 className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
                      {s.name}
                    </h3>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${statusToneClasses(s.status)}`}
                >
                  {s.status}
                </span>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{s.tagline}</p>

              <ul className="mt-5 space-y-1.5 text-sm text-foreground/90">
                {s.expectedBenefits.slice(0, 2).map((b: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <span className="mt-auto inline-flex w-fit items-center gap-1.5 pt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Explore {s.name}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Product principle</p>
            <h4 className="mt-1 font-display text-xl text-foreground">Every service follows the NitiVitt contract.</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Deterministic math from NitiCore™, plain-language explanations from NitiGuide™, and zero commissions. If a service can't be built to that standard, it doesn't ship.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
