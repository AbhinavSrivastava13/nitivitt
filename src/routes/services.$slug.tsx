import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getServiceBySlug, listServices } from "@/content/services";
import type { Service } from "@/content/services";

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ params }) => {
    const service = await getServiceBySlug(params.slug);
    if (!service) throw notFound();
    const all = await listServices();
    const idx = all.findIndex((s) => s.slug === service.slug);
    return {
      service,
      prev: idx > 0 ? all[idx - 1] : null,
      next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
    };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.service;
    if (!s) return { meta: [{ title: "Service not found — NitiVitt" }] };
    return {
      meta: [
        { title: `${s.name} — NitiVitt Services` },
        { name: "description", content: s.shortDescription },
        { property: "og:title", content: `${s.name} — NitiVitt` },
        { property: "og:description", content: s.shortDescription },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container-page py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">404</p>
        <h1 className="mt-3 font-display text-4xl text-foreground">Service not found</h1>
        <Link to="/services" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Services
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container-page py-24 text-center">
        <h1 className="font-display text-3xl text-foreground">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
        <button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button>
      </main>
      <SiteFooter />
    </div>
  ),
  component: ServiceDetail,
});

function statusTone(status: Service["status"]): string {
  if (status === "Available") return "bg-success-soft text-success";
  if (status === "Beta") return "bg-secondary-soft text-secondary";
  return "bg-muted text-muted-foreground";
}

function ServiceDetail() {
  const { service, prev, next } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="container-page py-14 md:py-20">
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-secondary hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Services
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{service.category}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(service.status)}`}>
                {service.status}
              </span>
            </div>
            <h1 className="mt-3 max-w-4xl text-balance font-display text-4xl leading-tight text-foreground md:text-5xl">
              {service.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{service.tagline}</p>
            {service.slug === "insurance-analyzer" && (
              <Link
                to="/insurance-analyzer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
              >
                Analyze Policy <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {service.slug === "portfolio-analyzer" && (
              <Link
                to="/portfolio-analyzer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
              >
                Open NitiInvest™ <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>

        <article className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            <section>
              <h2 className="font-display text-2xl text-foreground">In one paragraph</h2>
              <p className="mt-3 text-base leading-relaxed text-foreground/90">{service.shortDescription}</p>
            </section>

            <section>
              <h2 className="font-display text-2xl text-foreground">Why it matters</h2>
              <p className="mt-3 text-base leading-relaxed text-foreground/90">{service.whyItMatters}</p>
            </section>

            {service.visionSections.map((s: { heading: string; body: string }, i: number) => (
              <section key={i}>
                <h2 className="font-display text-2xl text-foreground">{s.heading}</h2>
                <p className="mt-3 text-base leading-relaxed text-foreground/90">{s.body}</p>
              </section>
            ))}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Expected benefits</p>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-foreground">
                {service.expectedBenefits.map((b: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="mt-2 text-sm text-foreground">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(service.status)}`}>
                  {service.status}
                </span>
              </p>
              <p className="mt-3 text-[12px] text-muted-foreground">
                You'll be notified inside NitiVitt as soon as this service opens for early access.
              </p>
              {service.slug === "insurance-analyzer" && (
                <Link
                  to="/insurance-analyzer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open Insurance Analyzer <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {service.slug === "portfolio-analyzer" && (
                <Link
                  to="/portfolio-analyzer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open NitiInvest™ <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </aside>
        </article>

        <div className="border-t border-border">
          <div className="container-page grid gap-3 py-8 md:grid-cols-2">
            {prev ? (
              <Link
                to="/services/$slug"
                params={{ slug: prev.slug }}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">{prev.name}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link
                to="/services/$slug"
                params={{ slug: next.slug }}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-primary/40"
              >
                <span className="inline-flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">{next.name}</span>
              </Link>
            ) : <span />}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
