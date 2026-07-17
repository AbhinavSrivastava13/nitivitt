import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Gauge,
  Hourglass,
  Route as RouteIcon,
  Sparkles,
  LineChart,
  ShieldCheck,
  Target,
  Wallet,
  Brain,
  Calculator,
  GraduationCap,
  Compass,
  Check,
  X,
  Plus,
  Minus,
  TrendingUp,
  Briefcase,
  Home,
  Baby,
  PiggyBank,
  Sun,
  Heart,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NitiVitt — Wise Wealth, for every Indian" },
      {
        name: "description",
        content:
          "NitiVitt is India's financial intelligence platform. Know your NitiScore, plan with NitiPath, and learn the math behind every recommendation. Zero commissions. Total transparency.",
      },
      { property: "og:title", content: "NitiVitt — Wise Wealth, for every Indian" },
      {
        property: "og:description",
        content:
          "Most platforms tell you what to invest in. NitiVitt teaches you why — with math, transparency, and zero commissions.",
      },
    ],
  }),
  beforeLoad: async () => {
    // Authenticated users never see the landing page — send them straight to the app.
    if (typeof window === "undefined") return;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <TrustBar />
        <IntelligenceSuite />
        <HowItWorks />
        <WhyNitiVitt />
        <FinancialJourney />
        <Comparison />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------------- HERO ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-grid-soft opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--color-primary) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="container-page relative pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-secondary" />
              </span>
              India's financial intelligence platform
            </div>

            <h1 className="mt-5 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-[4.25rem]">
              <span className="font-editorial italic font-normal text-primary">
                Wise
              </span>{" "}
              Wealth, for every <span className="whitespace-nowrap">Indian.</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Most platforms tell you <em className="font-editorial">what</em> to
              invest in. NitiVitt teaches you{" "}
              <em className="font-editorial">why</em>&nbsp;- with math, transparency,
              and zero commissions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-95 active:scale-[0.98]"
              >
                Get My NitiScore™
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                See How It Works
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                Zero commissions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-secondary" />
                Transparent math
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-secondary" />
                5-minute setup
              </span>
            </div>
          </div>

          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

function HeroDashboard() {
  const pillars: { name: string; score: number; icon: typeof Wallet }[] = [
    { name: "Savings", score: 82, icon: Wallet },
    { name: "Emergency", score: 65, icon: ShieldCheck },
    { name: "Insurance", score: 58, icon: Heart },
    { name: "Investments", score: 74, icon: LineChart },
  ];

  return (
    <div className="relative">
      <div
        className="absolute -inset-4 rounded-[2rem] opacity-50 blur-2xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 25%, transparent), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative rounded-2xl border border-border bg-surface-elevated p-2 shadow-elevated">
        <div className="rounded-xl bg-card p-5">
          {/* Top: Score + NitiAge */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  NitiScore™
                </p>
                <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold text-secondary">
                  Stable
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold text-foreground">
                  742
                </span>
                <span className="text-xs text-muted-foreground">/1000</span>
              </div>
              <ScoreArc value={74.2} />
            </div>


            <div className="rounded-xl border border-border bg-primary p-4 text-primary-foreground">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">
                NitiAge™
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-semibold">31</span>
                <span className="text-xs text-primary-foreground/70">yrs</span>
              </div>
              <p className="mt-1 text-[11px] text-primary-foreground/70">
                vs. real age 29
              </p>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-accent">
                <TrendingUp className="h-3 w-3" />
                −2 yrs in 90 days
              </div>
            </div>
          </div>

          {/* Pillars */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {pillars.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex items-center justify-between text-[12px]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <p.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.name}
                  </span>
                  <span className="text-muted-foreground">{p.score}</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.score}%`,
                      background:
                        p.score >= 75
                          ? "var(--color-secondary)"
                          : p.score >= 55
                            ? "var(--color-primary)"
                            : "var(--color-warning)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Goals + Retirement */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniGoal
              icon={Home}
              label="House down-payment"
              progress={42}
              eta="2028"
            />
            <MiniGoal icon={Sun} label="Retirement" progress={18} eta="2052" />
          </div>

          {/* AI Recommendation */}
          <div className="mt-3 rounded-xl border border-border bg-gradient-to-br from-primary-soft to-transparent p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Brain className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    NitiGuide™
                  </p>
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    Confidence 92%
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
                  Raise emergency fund by ₹12,000/mo for 13 months to reach a
                  6-month buffer.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  ₹40k essentials × 6 = ₹2.4L target · current ₹84k
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip */}
      <div className="absolute -left-3 top-6 hidden rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium shadow-elevated md:flex md:items-center md:gap-1.5">
        <Check className="h-3 w-3 text-secondary" />
        Every number explained
      </div>
    </div>
  );
}

function ScoreArc({ value }: { value: number }) {
  // simple decorative bar
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function MiniGoal({
  icon: Icon,
  label,
  progress,
  eta,
}: {
  icon: typeof Home;
  label: string;
  progress: number;
  eta: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </span>
        <span>{eta}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold text-foreground">
          {progress}%
        </span>
      </div>
    </div>
  );
}

/* ---------------- TRUST BAR ---------------- */

function TrustBar() {
  const items = [
    { icon: Target, label: "Financial Planning" },
    { icon: Compass, label: "Goal Planning" },
    { icon: ShieldCheck, label: "Insurance Analysis" },
    { icon: Sun, label: "Retirement Planning" },
    { icon: Brain, label: "AI Guidance" },
    { icon: Calculator, label: "Transparent Math" },
  ];
  return (
    <section className="border-b border-border bg-surface">
      <div className="container-page py-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 md:flex md:flex-wrap md:items-center md:justify-between">
          {items.map((i) => (
            <div
              key={i.label}
              className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
            >
              <i.icon className="h-3.5 w-3.5 text-secondary" />
              {i.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- INTELLIGENCE SUITE ---------------- */

function IntelligenceSuite() {
  const suite = [
    {
      name: "NitiScore™",
      tagline: "Know your overall financial health.",
      body: "A single 0-1000 score across six pillars - savings, emergency, insurance, investments, debt and retirement. Every point is auditable.",
      to: "/dashboard",
      icon: Gauge,
      accent: "primary",
    },
    {
      name: "NitiAge™",
      tagline: "Discover your financial age.",
      body: "Translates your habits into a single number. Are your finances 5 years ahead, or 7 years behind? Find out - and change it.",
      to: "/dashboard",
      icon: Hourglass,
      accent: "accent",
    },
    {
      name: "NitiPath™",
      tagline: "A personalized financial roadmap.",
      body: "Prioritized, time-bound steps tuned to your income, goals and risk. No filler tasks. No generic advice.",
      to: "/recommendations",
      icon: RouteIcon,
      accent: "secondary",
    },
    {
      name: "NitiGuide™",
      tagline: "AI that explains, never decides.",
      body: "Every recommendation comes with the reason, the logic, the assumptions, and the math. You stay in control.",
      to: "/ai-coach",
      icon: Brain,
      accent: "primary",
    },
    {
      name: "NitiSim™",
      tagline: "Simulate any future, before you commit.",
      body: "Switch jobs, buy a home, take a sabbatical - see the 20-year impact on your wealth before you act.",
      to: "/simulator",
      icon: Sparkles,
      accent: "accent",
    },
  ];



  return (
    <section className="container-page py-16 md:py-24">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            The NitiVitt Intelligence Suite
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Five tools. <span className="font-editorial italic font-normal text-primary">One</span> financial brain.
          </h2>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          Each module is a deterministic engine - built on pure math, designed
          to be explained line-by-line. No black boxes, no influencer picks.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-6">
        {/* Featured large card */}
        <SuiteCard item={suite[0]} large />
        <SuiteCard item={suite[1]} />
        <SuiteCard item={suite[2]} />
        <SuiteCard item={suite[3]} />
        <SuiteCard item={suite[4]} large />
      </div>
    </section>
  );
}

function SuiteCard({
  item,
  large = false,
}: {
  item: {
    name: string;
    tagline: string;
    body: string;
    icon: typeof Gauge;
    accent: string;
    to: string;
  };
  large?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to="/auth"
      search={{ mode: "signin", redirect: item.to }}
      aria-label={`Explore ${item.name}`}
      className={`group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated ${
        large ? "md:col-span-3" : "md:col-span-2"
      }`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: `var(--color-${item.accent})` }}
        aria-hidden
      />
      <div className="relative">
        <div
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in oklab, var(--color-${item.accent}) 12%, transparent)`,
            color: `var(--color-${item.accent})`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">
          {item.name}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground/80">
          {item.tagline}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {item.body}
        </p>
        <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Explore {item.name} <ArrowRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </Link>
  );
}


/* ---------------- HOW IT WORKS ---------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: GraduationCap,
      title: "Tell us about yourself.",
      body: "A 5-minute guided profile - income, goals, dependents, risk appetite.",
    },
    {
      n: "02",
      icon: Calculator,
      title: "We analyze your finances.",
      body: "Six pillars, deterministic math, transparent assumptions. No black boxes.",
    },
    {
      n: "03",
      icon: Sparkles,
      title: "Receive recommendations.",
      body: "Prioritized, audit-ready next steps with the exact calculation behind each.",
    },
    {
      n: "04",
      icon: TrendingUp,
      title: "Build long-term confidence.",
      body: "Track your NitiScore, simulate decisions, and grow with NitiGuide.",
    },
  ];
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            How it works
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            From confusion to clarity, in four steps.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl font-semibold text-primary/30">
                  {s.n}
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              {i < steps.length - 1 && (
                <ArrowRight
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border md:block"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- WHY NITIVITT ---------------- */

function WhyNitiVitt() {
  const items = [
    { label: "What", body: "The exact recommendation - in simple language." },
    { label: "Why", body: "The financial reason it matters for your situation." },
    { label: "Logic", body: "The principle and rule it follows." },
    { label: "Assumptions", body: "Every input we used, listed openly." },
    { label: "Calculation", body: "The arithmetic, shown - never hidden." },
    { label: "Next Step", body: "The concrete action you can take today." },
  ];
  return (
    <section className="container-page py-16 md:py-24">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Why NitiVitt
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Every recommendation,{" "}
            <span className="font-editorial italic font-normal text-primary">
              fully
            </span>{" "}
            explained.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            We believe finance should be auditable. If we can't explain it
            line-by-line, we don't suggest it. You'll never see a vague
            "buy this fund" again.
          </p>
          <p className="mt-8 font-editorial text-2xl italic text-muted-foreground">
            "AI assists. Mathematics decides."
          </p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2">
          {items.map((x, i) => (
            <li
              key={x.label}
              className="rounded-xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft font-mono text-[11px] font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {x.label}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {x.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- FINANCIAL JOURNEY ---------------- */

function FinancialJourney() {
  const stops = [
    { icon: Briefcase, label: "Starting Career" },
    { icon: ShieldCheck, label: "Emergency Fund" },
    { icon: Heart, label: "Insurance" },
    { icon: LineChart, label: "Investments" },
    { icon: Home, label: "House" },
    { icon: Baby, label: "Children" },
    { icon: PiggyBank, label: "Retirement" },
    { icon: Sun, label: "Financial Freedom" },
  ];
  return (
    <section className="border-y border-border bg-primary text-primary-foreground">
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            The financial journey
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            One platform.{" "}
            <span className="font-editorial italic font-normal text-accent">
              Every
            </span>{" "}
            life stage.
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/70">
            NitiVitt grows with you - from your first salary to your retirement
            corpus.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {stops.map((s, i) => (
            <div
              key={s.label}
              className="relative rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 backdrop-blur"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <s.icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-medium">{s.label}</p>
              <span className="absolute right-3 top-3 font-mono text-[10px] text-primary-foreground/40">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- COMPARISON ---------------- */

function Comparison() {
  const traditional = [
    "Track investments",
    "Sell financial products",
    "Show raw data",
    "Multiple disconnected apps",
    "Commission-driven advice",
  ];
  const nitivitt = [
    "Explain financial decisions",
    "Personalized roadmap",
    "Financial education built-in",
    "AI guidance with full math",
    "One unified platform",
  ];
  return (
    <section className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          NitiVitt vs. Traditional apps
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          We don't sell products. We sell{" "}
          <span className="font-editorial italic font-normal text-primary">
            clarity.
          </span>
        </h2>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <X className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              Traditional finance apps
            </h3>
          </div>
          <ul className="mt-5 space-y-2.5 text-sm">
            {traditional.map((t) => (
              <li
                key={t}
                className="flex items-center gap-3 text-muted-foreground"
              >
                <Minus className="h-3.5 w-3.5 text-destructive" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-secondary/30 bg-secondary-soft p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-secondary/30 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Check className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              NitiVitt
            </h3>
          </div>
          <ul className="relative mt-5 space-y-2.5 text-sm">
            {nitivitt.map((t) => (
              <li key={t} className="flex items-center gap-3 text-foreground">
                <Plus className="h-3.5 w-3.5 text-secondary" />
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- TESTIMONIALS ---------------- */

function Testimonials() {
  const t = [
    {
      quote:
        "For the first time, I understand exactly why I'm saving what I'm saving. NitiVitt feels like a CA who actually has time to explain.",
      name: "Priya M.",
      role: "Product Manager, Bengaluru",
    },
    {
      quote:
        "The NitiScore made our financial blind spots painfully obvious - and then showed us the exact path to fix them.",
      name: "Rohan & Anjali S.",
      role: "Newly married, Pune",
    },
    {
      quote:
        "No tips, no noise. Just the math behind every decision. This is what Indian fintech has been missing.",
      name: "Vikram T.",
      role: "Senior Engineer, Hyderabad",
    },
  ];
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            What early users say
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Trusted by Indians who think{" "}
            <span className="font-editorial italic font-normal text-primary">
              long-term.
            </span>
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {t.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                "{q.quote}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
                  {q.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {q.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{q.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  const faqs = [
    {
      q: "Is NitiVitt a stockbroker or mutual fund distributor?",
      a: "No. NitiVitt is a financial guidance and education platform. We do not sell financial products, take commissions, or execute trades. We help you make better decisions - you act on them through your existing accounts.",
    },
    {
      q: "How is the NitiScore™ calculated?",
      a: "Your NitiScore is a weighted score across six measurable pillars — Savings (20%), Emergency Fund (15%), Insurance (15%), Investments (20%), Debt (15%), and Retirement (15%). Every pillar score, assumption, and calculation is visible in your dashboard.",
    },
    {
      q: "Will NitiVitt sell my financial data?",
      a: "Never. Your data is yours. We do not sell it, share it with advertisers, or use it to push commissioned products. Read our principles for the full commitment.",
    },
    {
      q: "Do you give specific stock or mutual fund tips?",
      a: "No. NitiVitt focuses on financial planning — how much to save, where to allocate, when to insure, how to retire. Product selection is your decision, made on your platform of choice.",
    },
    {
      q: "Is it really free?",
      a: "Yes — the full NitiScore and core planning tools are free today. A premium tier and expert consultations are planned for the future. We will never run on commissions.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="container-page py-16 md:py-24">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Questions, answered{" "}
            <span className="font-editorial italic font-normal text-primary">
              honestly.
            </span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Don't see your question? Reach out - we respond personally to every
            early user.
          </p>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-foreground md:text-base">
                    {f.q}
                  </span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface transition-transform ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5 text-foreground" />
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Pricing removed — pricing will live inside individual services in future milestones. */

/* ---------------- FINAL CTA ---------------- */

function FinalCTA() {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-primary p-10 text-center text-primary-foreground shadow-elevated md:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(closest-side at 30% 20%, var(--color-accent) 0%, transparent 60%), radial-gradient(closest-side at 80% 80%, var(--color-secondary) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Five minutes. One answer.
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-6xl">
            <span className="font-editorial italic font-normal">"</span>Am I
            financially on track
            <span className="font-editorial italic font-normal">?"</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80">
            Get your NitiScore, see the math, and take the first step toward
            wise wealth.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-sm font-semibold text-accent-foreground shadow-glow transition-all hover:opacity-95"
            >
              Get My NitiScore™ <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/principles"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-primary-foreground/20 px-6 text-sm font-semibold text-primary-foreground/90 hover:bg-primary-foreground/10"
            >
              Read our principles
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
