/**
 * Financial Services section — ONE implementation, used by both the public
 * homepage and the signed-in dashboard so the two are pixel-identical.
 *
 * All copy, icons, statuses and CTA wording come from `@/content/services`
 * (the single source of truth). The only difference between contexts is:
 *   - signed out → cards open the premium service overview page
 *   - signed in  → cards open the live service, and may show live stats
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  ADVISOR_SERVICE,
  ANALYZER_SERVICES,
  GUEST_CTA,
  statusToneClasses,
} from "@/content/services";
import type { Service } from "@/content/services";
import { ratingClasses } from "@/lib/ratings";
import type { RatingTone } from "@/lib/ratings";

export interface ServiceStat {
  hasData: boolean;
  scoreLabel?: string | null;
  score?: number | null;
  ratingText?: string | null;
  ratingTone?: RatingTone | null;
  lastReviewed?: string | null;
}

export type ServiceStats = Partial<Record<string, ServiceStat>>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function FinancialServicesSection({
  authenticated = false,
  stats = {},
  headerAction,
  className = "",
}: {
  authenticated?: boolean;
  stats?: ServiceStats;
  headerAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {/* Header — heading and description sit on the same top line */}
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-start md:justify-between md:gap-12">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            Financial services
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            One flagship advisor.
            <br className="hidden sm:block" />
            <span className="font-editorial italic font-normal text-primary"> Four </span>
            analyzers behind it.
          </h2>
        </div>
        <div className="max-w-md md:pt-9">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Every analyzer feeds the Financial Advisor with deeper intelligence.
            Every recommendation ends with a human conversation - never a product pitch.
          </p>
          {headerAction ? <div className="mt-4">{headerAction}</div> : null}
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[5.5fr_6.5fr] lg:gap-10">
        <FeaturedAdvisorCard authenticated={authenticated} />

        <div className="grid gap-5 sm:grid-cols-2">
          {ANALYZER_SERVICES.map((s) => (
            <AnalyzerCard
              key={s.slug}
              service={s}
              authenticated={authenticated}
              stat={stats[s.slug]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Featured — Financial Advisor ─────────────── */

function FeaturedAdvisorCard({ authenticated }: { authenticated: boolean }) {
  const s = ADVISOR_SERVICE;
  const Icon = s.icon;
  const cta = authenticated ? s.ctaActive : GUEST_CTA;

  const inner = (
    <>
      <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-accent/25 blur-3xl transition-opacity duration-700 group-hover:opacity-100" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 60% at 30% 20%, black 20%, transparent 75%)",
        }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 ring-primary-foreground/15 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Flagship service
        </span>
        <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-primary-foreground/15">
          {s.status}
        </span>
      </div>

      <div className="relative mt-auto pt-8">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20 backdrop-blur-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{s.tag}</p>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
              {s.name}
            </h3>
          </div>
        </div>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-primary-foreground/85">
          {s.cardDescription}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary transition-transform duration-300 group-hover:translate-x-0.5">
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </>
  );

  const cls =
    "group relative flex min-h-[300px] flex-col overflow-hidden rounded-[28px] p-7 text-primary-foreground shadow-elevated ring-1 ring-primary/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-glow md:p-8";
  const style = {
    background:
      "radial-gradient(120% 100% at 0% 0%, oklch(0.42 0.14 258) 0%, oklch(0.28 0.10 258) 55%, oklch(0.22 0.08 258) 100%)",
  };

  return authenticated ? (
    <Link to="/financial-advisor" className={cls} style={style} aria-label={s.ctaActive}>
      {inner}
    </Link>
  ) : (
    <Link
      to="/services/$slug"
      params={{ slug: s.slug }}
      className={cls}
      style={style}
      aria-label={`${s.name} — ${GUEST_CTA}`}
    >
      {inner}
    </Link>
  );
}

/* ─────────────── Analyzer card ─────────────── */

function AnalyzerCard({
  service,
  authenticated,
  stat,
}: {
  service: Service;
  authenticated: boolean;
  stat?: ServiceStat;
}) {
  const Icon = service.icon;
  const hasData = Boolean(stat?.hasData);
  const showStat = authenticated && hasData && stat?.scoreLabel;
  const ratingCls = stat?.ratingTone ? ratingClasses(stat.ratingTone).text : "text-foreground";
  const cta = authenticated ? (hasData ? service.ctaActive : service.ctaEmpty) : GUEST_CTA;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/15 transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/40">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/90">
              {service.tag}
            </p>
            <h4 className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
              {service.name}
            </h4>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${statusToneClasses(service.status)}`}
        >
          {service.status}
        </span>
      </div>

      {showStat ? (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary">
            {stat?.scoreLabel}
          </p>
          {stat?.ratingText ? (
            <p className={`mt-1 font-display text-2xl font-semibold leading-tight ${ratingCls}`}>
              {stat.ratingText}
            </p>
          ) : (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold leading-none text-foreground">
                {stat?.score ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          )}
          {stat?.lastReviewed && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Last reviewed {formatDate(stat.lastReviewed)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          {service.cardDescription}
        </p>
      )}

      <span className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        {cta}
        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </>
  );

  const cls =
    "group flex min-h-[190px] flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated";

  if (!authenticated) {
    return (
      <Link to="/services/$slug" params={{ slug: service.slug }} className={cls}>
        {inner}
      </Link>
    );
  }

  switch (service.appRoute) {
    case "/insurance-analyzer":
      return <Link to="/insurance-analyzer" className={cls}>{inner}</Link>;
    case "/portfolio-analyzer":
      return <Link to="/portfolio-analyzer" className={cls}>{inner}</Link>;
    case "/loan-analyzer":
      return <Link to="/loan-analyzer" className={cls}>{inner}</Link>;
    case "/tax-planner":
      return <Link to="/tax-planner" className={cls}>{inner}</Link>;
    default:
      return <Link to="/financial-advisor" className={cls}>{inner}</Link>;
  }
}
