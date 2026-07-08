import { Link } from "@tanstack/react-router";
import { Logo } from "./brand/logo";

const COLS = [
  {
    title: "Product",
    links: [
      { to: "/how-it-works", label: "How it works" },
      { to: "/dashboard", label: "Your NitiScore" },
      { to: "/goals", label: "Goal planning" },
      { to: "/retirement", label: "Retirement" },
      { to: "/insurance", label: "Insurance" },
      { to: "/emergency-fund", label: "Emergency fund" },
    ],
  },
  {
    title: "Trust",
    links: [
      { to: "/principles", label: "Our principles" },
      { to: "/about", label: "About NitiVitt" },
      { to: "/knowledge", label: "Knowledge Hub" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            NitiVitt is a financial guidance platform. We help you make better decisions -
            we are not a broker, distributor or advisor.
          </p>
          <p className="mt-6 font-display text-2xl text-foreground">
            Know Better. Plan Better. Grow Better.
          </p>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {col.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} NitiVitt. Wise wealth, for every Indian.</p>
          <p className="max-w-2xl text-balance md:text-right">
            NitiVitt provides educational financial guidance only. We do not sell financial
            products, take commissions or guarantee returns. Always verify with a SEBI-registered
            advisor before acting.
          </p>
        </div>
      </div>
    </footer>
  );
}
