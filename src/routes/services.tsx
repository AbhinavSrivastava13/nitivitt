import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listServices } from "@/content/services";
import type { Service } from "@/content/services";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — NitiVitt" },
      {
        name: "description",
        content:
          "NitiVitt's upcoming ecosystem — SEBI-registered advisors, portfolio, insurance, loan and tax analysers. Guidance, never commissions.",
      },
      { property: "og:title", content: "Services — NitiVitt" },
      {
        property: "og:description",
        content:
          "A roadmap of the guidance services coming to NitiVitt — advisors, portfolio, insurance, loan and tax analysers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => ({ services: await listServices() }),
  component: ServicesPage,
});

function statusTone(status: Service["status"]): string {
  if (status === "Available") return "bg-success-soft text-success";
  if (status === "Beta") return "bg-secondary-soft text-secondary";
  return "bg-muted text-muted-foreground";
}

function ServicesPage() {
  const { services } = Route.useLoaderData();
  return (
    <PageShell
      eyebrow="Services"
      title="Where NitiVitt is going next."
      lede="A curated ecosystem of guidance services — always fee-only, always grounded in NitiCore™. Explore the roadmap; every service listed here is being designed with the same transparency and math-first philosophy as the app you're using today."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.slug}
            to="/services/$slug"
            params={{ slug: s.slug }}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{s.category}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(s.status)}`}>
                {s.status}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold leading-snug text-foreground group-hover:text-primary">
              {s.name}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.tagline}</p>
            <p className="mt-4 line-clamp-3 text-sm text-foreground/85">{s.shortDescription}</p>

            <div className="mt-5 rounded-xl bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Why it matters</p>
              <p className="mt-1 line-clamp-3 text-sm text-foreground/90">{s.whyItMatters}</p>
            </div>

            <ul className="mt-4 space-y-1.5 text-sm text-foreground/90">
              {s.expectedBenefits.slice(0, 2).map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Read the vision <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Product principle</p>
            <h4 className="mt-1 font-display text-xl text-foreground">Every service on this roadmap will follow the NitiVitt contract.</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Deterministic math from NitiCore™, plain-language explanations from NitiGuide™, and zero commissions. If a service can't be built to that standard, it doesn't ship.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
