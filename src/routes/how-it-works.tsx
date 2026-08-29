import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Gauge,
  Route as RouteIcon,
  Compass,
  Shield,
  Target,
  PieChart,
  Umbrella,
  Landmark,
  Receipt,
  Sunset,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SectionHeader } from "@/components/platform/section-header";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How NitiVitt works - from your numbers to your next move" },
      {
        name: "description",
        content:
          "See how NitiVitt turns your complete financial picture into a measurable NitiScore, a prioritized NitiPath, and plain-language guidance for every decision.",
      },
      { property: "og:title", content: "How NitiVitt works - from your numbers to your next move" },
      {
        property: "og:description",
        content:
          "See how NitiVitt turns your complete financial picture into a measurable NitiScore, a prioritized NitiPath, and plain-language guidance for every decision.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Build your financial profile",
    body: "Tell us about your income, expenses, savings, investments, loans, insurance and goals. It takes a few minutes, and we never ask for anything we don't use in a calculation.",
    you: "You share your complete financial picture.",
  },
  {
    n: "02",
    icon: Gauge,
    title: "We compute your NitiScore™",
    body: "Six pillars - Savings, Emergency, Insurance, Investments, Debt and Retirement - each scored 0-100 from a fixed formula, then combined into one 0-1000 score you can trace point by point.",
    you: "You get a measurable view of your financial health.",
  },
  {
    n: "03",
    icon: RouteIcon,
    title: "We generate your NitiPath™",
    body: "Your findings become a prioritized roadmap - which gap to close first, which move has the biggest impact next month, and the calculation behind every recommendation.",
    you: "You receive a clear, ordered plan of action.",
  },
  {
    n: "04",
    icon: Compass,
    title: "You decide. We coach.",
    body: "NitiGuide™ explains any number in plain language, simulators let you test 'what if' scenarios, and the Knowledge Hub teaches the why - so every decision stays yours.",
    you: "You act with confidence, at your own pace.",
  },
];

const TOOLKIT = [
  { icon: Gauge, label: "NitiScore™", name: "Financial Health", body: "Understand your overall financial health on one 0-1000 scale." },
  { icon: Sparkles, label: "NitiAge™", name: "Financial Age", body: "See whether your financial habits run ahead of or behind your actual age." },
  { icon: Target, label: "", name: "Goal Planning", body: "See what it takes to fund the goals that matter to you." },
  { icon: PieChart, label: "NitiInvest™", name: "Portfolio Analysis", body: "Understand portfolio structure, concentration and diversification - and what to improve." },
  { icon: Umbrella, label: "NitiSure™", name: "Insurance Analysis", body: "Understand the gaps in your family's protection." },
  { icon: Landmark, label: "NitiLoan™", name: "Loan Analysis", body: "Understand your debt and the real impact of every repayment choice." },
  { icon: Receipt, label: "NitiTax™", name: "Tax Planning", body: "Plan and understand your tax implications before the year ends." },
  { icon: Sunset, label: "", name: "Retirement Planning", body: "Understand whether your current path supports the retirement you want." },
  { icon: RouteIcon, label: "Your prioritized roadmap", name: "NitiPath™", body: "Bring every finding together into prioritized next steps." },
  { icon: MessagesSquare, label: "Plain-language guidance", name: "NitiGuide™", body: "Explain the numbers and decisions in plain language, whenever you need it." },
];

const PILLARS = [
  { name: "Savings", weight: 20, target: "Save 30% of monthly income." },
  { name: "Emergency Fund", weight: 15, target: "Hold 6 months of essential expenses." },
  { name: "Insurance", weight: 15, target: "Term + health insurance in place." },
  { name: "Investments", weight: 20, target: "Invest 20% of income monthly." },
  { name: "Debt", weight: 15, target: "EMIs under 20% of income." },
  { name: "Retirement", weight: 15, target: "On track for 25× annual expenses by 60." },
];

function HowItWorks() {
  return (
    <PageShell
      eyebrow="How it works"
      title="The math behind every screen."
      lede="NitiVitt takes your complete financial picture, turns it into measurable financial health, and then helps you decide what to do next - with every calculation shown, never hidden behind a black box."
    >
      {/* ── The journey ─────────────────────────────────────────── */}
      <SectionHeader
        eyebrow="Your journey"
        title="From your numbers to your next move."
        lede="Four steps. You always know what we calculated, why it matters, and what it means for you."
      />

      <div className="relative mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* connector line */}
        <div
          className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
          aria-hidden
        />
        {STEPS.map((s) => (
          <div key={s.n} className="group relative flex flex-col">
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-soft transition-shadow group-hover:shadow-md">
              <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <span className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              Step {s.n}
            </span>
            <h3 className="mt-2 font-display text-xl text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            <p className="mt-4 border-l-2 border-primary/40 pl-3 text-sm font-medium text-foreground">
              {s.you}
            </p>
          </div>
        ))}
      </div>

      {/* ── What you can do ─────────────────────────────────────── */}
      <div className="mt-24">
        <SectionHeader
          eyebrow="One connected picture"
          title="What you can do with NitiVitt."
          lede="These aren't separate products. Every tool reads the same financial picture, so an insight in one place sharpens the answer everywhere else."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TOOLKIT.map((t) => (
          <div
            key={t.name}
            className="rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-md"
          >
            <t.icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
            <span
              className={`block text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary ${
                t.label ? "mt-3" : "hidden"
              }`}
            >
              {t.label}
            </span>
            <h3 className={`text-sm font-semibold text-foreground ${t.label ? "mt-1" : "mt-3"}`}>
              {t.name}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          One financial picture powers everything. Update your numbers once, and every insight stays
          connected.
        </p>
      </div>

      {/* ── Six pillars ─────────────────────────────────────────── */}
      <div className="mt-24">
        <SectionHeader
          eyebrow="The NitiScore™ framework"
          title="Six pillars. Every point explained."
          lede="Each pillar scores 0-100 from a fixed formula. Your NitiScore is their weighted sum - and you can always see exactly where every point came from."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  {p.weight}%
                </span>
              </div>
              <div
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                aria-hidden
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${p.weight * 4}%` }} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Healthy:</span> {p.target}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-border bg-surface p-6">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-secondary" strokeWidth={1.75} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">No black boxes.</span> Two people with
            the same numbers always get the same score. Every recommendation in your Financial
            Health Report shows the formula and the inputs behind it - so you can question it,
            verify it, and trust it on your own terms.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
