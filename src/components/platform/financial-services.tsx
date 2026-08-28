/**
 * Financial Services section - shared implementation for the public homepage and
 * the signed-in dashboard.
 *
 * All copy, icons, statuses and CTA wording come from `@/content/services`
 * (the single source of truth). The component supports two layouts:
 *   - `full` (default) → dashboard-style service grid with optional live stats
 *   - `minimal`        → compact homepage feature block with the flagship
 *                        Financial Advisor card and an "Explore all services" link
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

export interface FinancialServicesSectionProps {
  authenticated?: boolean;
  stats?: ServiceStats;
  headerAction?: React.ReactNode;
  className?: string;
  /** Layout variant. `minimal` = homepage, `compact` = dashboard, `full` = legacy grid. */
  variant?: "full" | "minimal" | "compact";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Locale-independent formatting so SSR and client output always match. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

/** Short dashboard labels - the marketing names stay on the public surfaces. */
const SHORT_NAMES: Record<string, string> = {
  "insurance-analyzer": "Insurance",
  "portfolio-analyzer": "Portfolio",
  "loan-analyzer": "Loans",
  "tax-planner": "Tax",
};

/** One-line purpose shown under each analyzer in the dashboard strip. */
const ANALYZER_PURPOSE: Record<string, string> = {
  "insurance-analyzer": "Understand your protection gaps.",
  "portfolio-analyzer": "See what your portfolio is really doing.",
  "loan-analyzer": "Understand your debt and payoff path.",
  "tax-planner": "Plan your taxes before year-end.",
};


export function FinancialServicesSection({
  authenticated = false,
  stats = {},
  headerAction,
  className = "",
  variant = "full",
}: FinancialServicesSectionProps) {
  if (variant === "minimal") {
    return <MinimalServicesSection className={className} authenticated={authenticated} />;
  }

  if (variant === "compact") {
    return <CompactServicesSection className={className} stats={stats} />;
  }


  return (
    <section className={className}>
      {/* Header - heading and description sit on the same top line */}
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

/* ─────────────── Minimal homepage section ─────────────── */

function MinimalServicesSection({
  authenticated,
  className = "",
}: {
  authenticated: boolean;
  className?: string;
}) {
  const s = ADVISOR_SERVICE;
  const Icon = s.icon;
  const cta = s.ctaActive;

  const advisorLink = authenticated ? "/financial-advisor" : "/services/$slug";
  const advisorParams = authenticated ? undefined : { slug: s.slug };

  return (
    <section className={className}>
      <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            Financial services
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            One flagship advisor.{" "}
            <span className="font-editorial italic font-normal text-primary">Deeper</span> financial intelligence behind it.
          </h2>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground lg:pb-1">
          AI analyzes your financial picture across the areas that matter. When you need to act, a
          Financial Advisor can work from that context - so the conversation starts with your
          situation, not a product pitch.
        </p>
      </div>

      <div className="mt-10 md:mt-12">
        <Link
          to={advisorLink}
          params={advisorParams}
          className="group relative flex flex-col overflow-hidden rounded-[28px] p-7 text-primary-foreground shadow-elevated ring-1 ring-primary/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-glow md:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.42 0.14 258) 0%, oklch(0.28 0.10 258) 55%, oklch(0.22 0.08 258) 100%)",
          }}
          aria-label={authenticated ? s.ctaActive : `${s.name} - ${GUEST_CTA}`}
        >
          {/* Soft ambient glow */}
          <div
            className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-accent/20 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-secondary/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse 70% 60% at 30% 20%, black 20%, transparent 75%)",
            }}
            aria-hidden
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20 backdrop-blur-sm">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                  {s.tag}
                </p>
                <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                  {s.name}
                </h3>
              </div>
            </div>

            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 ring-primary-foreground/15 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Flagship service
                </span>
                <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-primary-foreground/15">
                  {s.status}
                </span>
              </div>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-primary-foreground/85">
                1:1 sessions with fee-only advisors, supported by your NitiVitt financial context.
              </p>
            </div>
          </div>

          <span className="relative mt-6 inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-sm font-semibold text-primary transition-all duration-300 group-hover:translate-x-0.5 lg:mt-0">
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border/70 pt-6 md:flex-row md:items-center md:gap-8">
        <p className="text-sm text-muted-foreground">
          Multiple analyzers. One connected financial picture.
        </p>
        <Link
          to="/services"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          aria-label="Explore all services"
        >
          Explore all services
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────── Featured - Financial Advisor ─────────────── */

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
      aria-label={`${s.name} - ${GUEST_CTA}`}
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
                {stat?.score ?? "-"}
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

/* ─────────────── Compact dashboard section ─────────────── */

function AnalyzerLink({
  service,
  className,
  children,
  ariaLabel,
}: {
  service: Service;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const props = { className, "aria-label": ariaLabel };
  switch (service.appRoute) {
    case "/insurance-analyzer":
      return <Link to="/insurance-analyzer" {...props}>{children}</Link>;
    case "/portfolio-analyzer":
      return <Link to="/portfolio-analyzer" {...props}>{children}</Link>;
    case "/loan-analyzer":
      return <Link to="/loan-analyzer" {...props}>{children}</Link>;
    case "/tax-planner":
      return <Link to="/tax-planner" {...props}>{children}</Link>;
    default:
      return <Link to="/financial-advisor" {...props}>{children}</Link>;
  }
}

function CompactServicesSection({
  stats,
  className = "",
}: {
  stats: ServiceStats;
  className?: string;
}) {
  const advisor = ADVISOR_SERVICE;
  const AdvisorIcon = advisor.icon;

  return (
    <section className={className}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">
            Financial services
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Your financial analyses, advisor access and latest status - in one place.
          </p>
        </div>
        <Link
          to="/services"
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Flagship advisor block */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
        <Link
          to="/financial-advisor"
          className="group relative flex flex-col justify-between gap-4 bg-gradient-to-br from-primary-soft/80 via-primary-soft/40 to-card px-5 py-3.5 transition-all duration-300 hover:from-primary-soft hover:shadow-elevated sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <AdvisorIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                  NitiVitt Advisory
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-secondary/20">
                  <span className="h-1 w-1 rounded-full bg-secondary" />
                  Human guidance
                </span>
              </div>
              <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                Financial Advisor
              </h3>
              <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
                Turn your NitiVitt financial picture into a conversation with a human advisor.
              </p>
              <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-muted-foreground/75">
                Your analysis is already prepared, so the conversation can focus on decisions and next steps.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end sm:pl-4">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-300 group-hover:translate-x-0.5">
              Talk to an Advisor
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            <span className="text-[10px] text-muted-foreground">
              Fee-only · No commissions · No product pitches
            </span>
          </div>
        </Link>
      </div>

      {/* Analyzer status panel */}
      <div className="mt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary/80">
          Your financial intelligence
        </p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {ANALYZER_SERVICES.map((s, i) => {
              const stat = stats[s.slug];
              const Icon = s.icon;
              const hasData = Boolean(stat?.hasData);
              const state = hasData
                ? stat?.ratingText ?? (stat?.score != null ? `${stat.score} / 100` : "Reviewed")
                : "Not reviewed";
              const tone = hasData && stat?.ratingTone ? ratingClasses(stat.ratingTone).text : "text-foreground";


              return (
                <AnalyzerLink
                  key={s.slug}
                  service={s}
                  ariaLabel={`${SHORT_NAMES[s.slug] ?? s.name} - ${state}`}
                  className={`group flex flex-col gap-0.5 px-5 py-3 transition-colors hover:bg-muted/40 sm:border-t sm:border-border/70 ${
                    i % 2 === 1 ? "sm:border-l" : ""
                  } lg:border-l lg:first:border-l-0 lg:[&:nth-child(3)]:border-l`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="truncate text-[12px] font-semibold text-foreground">
                        {SHORT_NAMES[s.slug] ?? s.name}
                      </p>
                    </div>
                    <span className="shrink-0 pt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {s.tag}
                    </span>
                  </div>
                  <p className="truncate text-[11px] leading-relaxed text-muted-foreground/85">
                    {ANALYZER_PURPOSE[s.slug] ?? s.cardDescription}
                  </p>
                  <p
                    className={`mt-0.5 font-display text-xl font-semibold leading-tight ${
                      hasData ? tone : "text-muted-foreground"
                    }`}
                  >
                    {state}
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {hasData && stat?.lastReviewed ? `Last reviewed · ${formatShortDate(stat.lastReviewed)}` : "-"}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary">
                      {hasData ? "Open" : "Start"}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </AnalyzerLink>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
