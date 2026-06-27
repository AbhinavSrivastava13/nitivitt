import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NitiVitt — Your Personal Financial Guide" },
      {
        name: "description",
        content:
          "Know your NitiScore in five minutes. India's financial guidance platform — transparent math, zero commissions, every recommendation explained.",
      },
      { property: "og:title", content: "NitiVitt — Wise Wealth" },
      {
        property: "og:description",
        content: "Know Better. Plan Better. Grow Better. Get your NitiScore in five minutes.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <TrustBar />
        <Pillars />
        <NitiScorePreview />
        <Philosophy />
        <FrameworkSection />
        <NotWhatYouThink />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-soft" aria-hidden />
      <div className="container-page relative pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            India's financial guidance platform
          </div>

          <h1 className="mt-6 text-balance text-5xl leading-[1.05] tracking-tight text-foreground md:text-7xl">
            <span className="font-editorial italic text-primary">Wise</span>{" "}
            <span className="font-semibold">wealth, for every Indian.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
            Most platforms tell you <em className="font-editorial">what</em> to invest in.
            NitiVitt teaches you <em className="font-editorial">why</em> — with math, transparency,
            and zero commissions.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-95 active:scale-[0.98]"
            >
              Get your NitiScore — free
              <span aria-hidden>→</span>
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface-elevated px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              How it works
            </Link>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Takes 5 minutes · No card required · We never sell products
          </p>
        </div>

        <ScorePreviewCard />
      </div>
    </section>
  );
}

function ScorePreviewCard() {
  // Static illustrative preview (real data lives behind auth).
  const pillars = [
    { name: "Savings", score: 82 },
    { name: "Emergency Fund", score: 65 },
    { name: "Insurance", score: 50 },
    { name: "Investments", score: 74 },
    { name: "Debt", score: 88 },
    { name: "Retirement", score: 41 },
  ];
  const overall = 67;

  return (
    <div className="mx-auto mt-16 max-w-4xl">
      <div className="rounded-3xl border border-border bg-surface-elevated p-2 shadow-elevated">
        <div className="rounded-2xl bg-card p-6 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Your NitiScore™
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-7xl text-foreground">{overall}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <span className="ml-2 rounded-full bg-secondary-soft px-2.5 py-1 text-xs font-semibold text-secondary">
                  Stable
                </span>
              </div>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                You're financially stable. Two pillars need attention to move you to{" "}
                <span className="font-semibold text-foreground">Strong</span>.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">NitiAge™</p>
              <p className="font-display text-3xl text-foreground">34</p>
              <p className="text-xs text-muted-foreground">vs. your real age 29</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.score}</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${p.score}%`,
                      backgroundColor:
                        p.score >= 75
                          ? "var(--color-secondary)"
                          : p.score >= 50
                            ? "var(--color-primary)"
                            : "var(--color-warning)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBar() {
  const items = [
    "No commissions",
    "No stock tips",
    "No hidden fees",
    "Math, not opinions",
    "Every assumption disclosed",
  ];
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {items.map((i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {i}
          </span>
        ))}
      </div>
    </section>
  );
}

function Pillars() {
  const pillars = [
    {
      eyebrow: "Diagnose",
      title: "Know exactly where you stand.",
      body: "Your NitiScore breaks financial health into six measurable pillars — savings, emergency fund, insurance, investments, debt, and retirement.",
      to: "/dashboard",
      cta: "See your dashboard",
    },
    {
      eyebrow: "Plan",
      title: "A roadmap built on your numbers.",
      body: "NitiPath turns your situation into a prioritized, time-bound plan. Every step shows the math behind it — never a black box.",
      to: "/how-it-works",
      cta: "See the math",
    },
    {
      eyebrow: "Decide",
      title: "Recommendations you can audit.",
      body: "Every recommendation shows the reason, logic, assumptions, calculation, action, and confidence. If we can't explain it, we don't suggest it.",
      to: "/principles",
      cta: "Read our principles",
    },
  ];

  return (
    <section className="container-page py-24 md:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          A different kind of financial platform
        </p>
        <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
          We don't sell products. We sell clarity.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Groww, Zerodha, INDmoney help you <em>invest</em>. NitiVitt helps you{" "}
          <em>decide</em>.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {pillars.map((p) => (
          <article
            key={p.title}
            className="group flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {p.eyebrow}
            </p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{p.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            <Link
              to={p.to}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:opacity-80"
            >
              {p.cta} <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function NitiScorePreview() {
  const example = {
    title: "Increase your emergency fund",
    reason: "Your liquid savings cover only 2.1 months of essential expenses.",
    logic: "A 6-month buffer protects you from income shocks without selling investments.",
    calc: "Monthly essentials ₹40,000 × 6 = ₹2.4L target. You hold ₹84,000.",
    action: "Save ₹12,000/month for 13 months in a liquid fund.",
  };
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-page py-24 md:py-32">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Every recommendation, explained
            </p>
            <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
              No black boxes. Ever.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              You'll never see a vague "buy this fund." You'll see the reason, the logic, the
              assumptions, the calculation, and the exact action — so you stay in control.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-foreground">
              {["Reason", "Logic", "Assumptions", "Calculation", "Action", "Confidence"].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-soft text-[10px] font-bold text-secondary">
                    ✓
                  </span>
                  <span className="font-medium">{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7 shadow-elevated">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                High priority
              </span>
              <span className="text-xs text-muted-foreground">Confidence 92%</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground">{example.title}</h3>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Reason", example.reason],
                ["Logic", example.logic],
                ["Calculation", example.calc],
                ["Action", example.action],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function Philosophy() {
  const lines = [
    "Education before recommendation.",
    "Logic before opinion.",
    "Transparency before conversion.",
    "Trust before revenue.",
    "Long-term wealth over short-term returns.",
  ];
  return (
    <section className="container-page py-24 md:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Our principles
        </p>
        <h2 className="mt-4 font-display text-4xl text-foreground md:text-5xl">
          What we believe.
        </h2>
      </div>
      <ul className="mx-auto mt-12 max-w-2xl space-y-3">
        {lines.map((line, i) => (
          <li
            key={line}
            className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-soft"
          >
            <span className="font-display text-2xl text-primary">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-base font-medium text-foreground">{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-12 text-center font-editorial text-3xl italic text-muted-foreground">
        "AI assists. Mathematics decides."
      </p>
    </section>
  );
}

function FrameworkSection() {
  const items = [
    { name: "NitiScore™", desc: "Your overall financial health, 0–100." },
    { name: "NitiAge™", desc: "How old your finances actually feel." },
    { name: "NitiPath™", desc: "Your prioritized, time-bound roadmap." },
    { name: "NitiGuide™", desc: "An AI coach that explains, never decides." },
    { name: "NitiSim™", desc: "Simulate any 'what if' before you act." },
  ];
  return (
    <section className="border-y border-border bg-primary text-primary-foreground">
      <div className="container-page py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            The NitiVitt framework
          </p>
          <h2 className="mt-4 font-display text-4xl md:text-5xl">
            Five tools. One financial brain.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <div
              key={i.name}
              className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 backdrop-blur"
            >
              <p className="font-display text-xl">{i.name}</p>
              <p className="mt-2 text-sm text-primary-foreground/75">{i.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotWhatYouThink() {
  return (
    <section className="container-page py-24 md:py-32">
      <div className="grid gap-12 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
            What NitiVitt is NOT
          </h3>
          <ul className="mt-5 space-y-2.5 text-base text-foreground">
            {["Stock tips", "Intraday calls", "A trading platform", "A brokerage", "A mutual fund distributor", "Portfolio management"].map(
              (x) => (
                <li key={x} className="flex items-center gap-3">
                  <span className="text-destructive">✕</span> {x}
                </li>
              ),
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-secondary/30 bg-secondary-soft p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            What NitiVitt IS
          </h3>
          <ul className="mt-5 space-y-2.5 text-base text-foreground">
            {[
              "A financial guidance platform",
              "A goal-planning system",
              "A financial health tracker",
              "An AI financial coach",
              "A financial education hub",
              "Your second financial brain",
            ].map((x) => (
              <li key={x} className="flex items-center gap-3">
                <span className="text-secondary">✓</span> {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="container-page pb-24 md:pb-32">
      <div className="overflow-hidden rounded-3xl border border-border bg-surface-elevated p-10 text-center shadow-elevated md:p-16">
        <h2 className="mx-auto max-w-2xl font-display text-4xl text-foreground md:text-6xl">
          Five minutes. One question answered.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          <em className="font-editorial">"Am I financially on track?"</em>
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-95"
          >
            Get your NitiScore <span aria-hidden>→</span>
          </Link>
          <Link
            to="/principles"
            className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Read our principles
          </Link>
        </div>
      </div>
    </section>
  );
}
