/**
 * RecommendationCard — canonical NitiVitt recommendation surface.
 *
 * Per Master Bible §1 Recommendation Philosophy: every recommendation must
 * disclose Recommendation · Reason · Logic · Assumptions · Calculation · Action
 * · Confidence · Priority · Impact · Time Horizon · Risk.
 *
 * This component is the single source of truth for how a recommendation is
 * rendered across the product. AI never composes one — math produces it, this
 * component displays it.
 */
import { type ReactNode } from "react";

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationConfidence = "high" | "medium" | "low";

export interface Recommendation {
  title: string;
  reason: string;
  logic: string;
  assumptions?: string[];
  calculation: string;
  action: string;
  confidence: RecommendationConfidence;
  priority: RecommendationPriority;
  impact?: string;
  timeHorizon?: string;
  risk?: string;
}

const PRIORITY_STYLES: Record<RecommendationPriority, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-accent/15 text-accent-foreground",
  low: "bg-muted text-muted-foreground",
};

const CONFIDENCE_LABEL: Record<RecommendationConfidence, string> = {
  high: "High · deterministic",
  medium: "Medium · model-based",
  low: "Low · directional",
};

export function RecommendationCard({ rec, footer }: { rec: Recommendation; footer?: ReactNode }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-soft md:p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${PRIORITY_STYLES[rec.priority]}`}
        >
          {rec.priority} priority
        </span>
        <span className="text-xs text-muted-foreground">
          Confidence — {CONFIDENCE_LABEL[rec.confidence]}
        </span>
      </header>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{rec.title}</h3>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Reason">{rec.reason}</Field>
        <Field label="Logic">{rec.logic}</Field>
        <Field label="Calculation" mono>
          {rec.calculation}
        </Field>
        <Field label="Action">{rec.action}</Field>
        {rec.impact && <Field label="Impact">{rec.impact}</Field>}
        {rec.timeHorizon && <Field label="Time horizon">{rec.timeHorizon}</Field>}
        {rec.risk && <Field label="Risk">{rec.risk}</Field>}
      </dl>

      {rec.assumptions && rec.assumptions.length > 0 && (
        <details className="mt-5 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Assumptions ({rec.assumptions.length})
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-foreground">
            {rec.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      {footer && <div className="mt-5 border-t border-border pt-4">{footer}</div>}
    </article>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-foreground ${mono ? "font-mono text-[13px]" : ""}`}>
        {children}
      </dd>
    </div>
  );
}
