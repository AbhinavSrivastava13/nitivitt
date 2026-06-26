import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About NitiVitt — Wise Wealth" },
      {
        name: "description",
        content:
          "NitiVitt — niti (wisdom) + vitt (wealth). We're building India's most trusted financial guidance platform.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <PageShell
      eyebrow="About"
      title="Niti. Vitt. Wise wealth."
      lede="NitiVitt comes from two Sanskrit words — niti, meaning wisdom and right direction, and vitt, meaning wealth. Together they describe what we are building: a platform that turns knowledge into financial confidence."
    >
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl text-foreground">Why we exist</h2>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            Indians have never had more financial products — and never been more confused. Apps tell
            you to invest. YouTube tells you to trade. Advisors tell you what earns them the highest
            commission. Spreadsheets tell you nothing at all.
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            NitiVitt is the answer to a different question: <em className="font-display">Am I on
            track?</em> Five minutes in, you should know exactly where you stand and what to do
            next — with math you can see and trust.
          </p>
        </div>
        <div>
          <h2 className="font-display text-3xl text-foreground">What we're building</h2>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            A financial operating system for India. One platform that diagnoses your health,
            plans your goals, protects against risk, and teaches the why behind every decision.
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            We don't sell financial products. We don't take commissions. We make money the same
            way Notion or Apple Health do — by being so useful you choose to upgrade.
          </p>
        </div>
      </div>

      <div className="mt-20 rounded-3xl border border-border bg-primary p-10 text-primary-foreground md:p-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Our motto</p>
        <p className="mt-4 font-display text-5xl md:text-7xl">
          Know Better.<br />Plan Better.<br />Grow Better.
        </p>
      </div>
    </PageShell>
  );
}
