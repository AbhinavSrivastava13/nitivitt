import { type ReactNode } from "react";

/**
 * SectionHeader — canonical eyebrow + title + lede + actions row.
 * Used at the top of every dashboard / analyzer / knowledge section so that
 * spacing, typography scale and hierarchy remain identical across the app.
 */
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "start" | "center";
  actions?: ReactNode;
  /** Emphasise a single word inside the title using the editorial serif italic. */
  emphasis?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "start",
  actions,
  emphasis,
}: SectionHeaderProps) {
  const alignCls = align === "center" ? "items-center text-center" : "items-start";
  const titleNode = emphasis && title.includes(emphasis) ? (
    <>
      {title.split(emphasis)[0]}
      <span className="font-editorial italic font-normal text-primary">{emphasis}</span>
      {title.split(emphasis)[1]}
    </>
  ) : title;

  return (
    <div className={`flex flex-col gap-6 md:flex-row md:items-end md:justify-between`}>
      <div className={`flex max-w-2xl flex-col gap-3 ${alignCls}`}>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          {titleNode}
        </h2>
        {lede && (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {lede}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
