import { type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

interface PageShellProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}

export function PageShell({ eyebrow, title, lede, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-grid-soft" aria-hidden />
          <div className="container-page relative py-20 md:py-28">
            <div className="max-w-3xl">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-3 text-balance font-display text-5xl text-foreground md:text-6xl">
                {title}
              </h1>
              {lede && (
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {lede}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="container-page py-16 md:py-20">{children}</section>
      </main>
      <SiteFooter />
    </div>
  );
}

interface ComingSoonProps {
  module: string;
  description: string;
  features: string[];
}

export function ModulePlaceholder({ module, description, features }: ComingSoonProps) {
  return (
    <div className="grid gap-12 md:grid-cols-[2fr_1fr]">
      <div>
        <p className="text-base leading-relaxed text-foreground">{description}</p>
        <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          What this module will do
        </h2>
        <ul className="mt-4 space-y-3">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-[10px] font-bold text-secondary">
                ✓
              </span>
              <span className="text-sm text-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          In active development
        </p>
        <p className="mt-3 font-display text-2xl text-foreground">{module}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We're shipping this module with the same discipline as the rest of NitiVitt - every
          calculation transparent, every recommendation auditable.
        </p>
      </aside>
    </div>
  );
}
