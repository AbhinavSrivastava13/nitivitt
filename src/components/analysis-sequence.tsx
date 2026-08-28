import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Full-screen premium analysis sequence.
 * Represents the NitiCore™ deterministic engine processing a user's profile.
 * Not a generic spinner — a narrated, deterministic-feeling progression.
 */
export interface AnalysisStep {
  id: string;
  label: string;
}

export const DEFAULT_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "income", label: "Reviewing income" },
  { id: "expenses", label: "Reviewing expenses" },
  { id: "assets", label: "Evaluating assets" },
  { id: "liabilities", label: "Checking liabilities" },
  { id: "insurance", label: "Assessing insurance" },
  { id: "score", label: "Calculating NitiScore™" },
  { id: "age", label: "Calculating NitiAge™" },
  { id: "emergency", label: "Evaluating emergency fund" },
  { id: "retirement", label: "Assessing retirement readiness" },
  { id: "path", label: "Building NitiPath™" },
  { id: "dashboard", label: "Preparing your dashboard" },
];

interface Props {
  steps?: AnalysisStep[];
  onComplete: () => void;
  /** Milliseconds per step. Default 420ms feels premium without being slow. */
  stepDurationMs?: number;
  title?: string;
  subtitle?: string;
  /**
   * When true, the sequence never auto-finishes: it walks through the steps and
   * then holds on the final step (with reassuring context) until the parent
   * unmounts it because the real work returned. No fake percentage is shown.
   */
  awaitCompletion?: boolean;
  /** Contextual messages rotated while the final step is still running. */
  reassurances?: string[];
}

const DEFAULT_REASSURANCES = [
  "Still working — market data for some holdings is taking a little longer.",
  "Cross-checking every holding against your NitiCore™ context.",
  "Almost there — assembling the final report exactly once, so it opens complete.",
];

export function AnalysisSequence({
  steps = DEFAULT_ANALYSIS_STEPS,
  onComplete,
  stepDurationMs = 420,
  title = "Analyzing your financial profile",
  subtitle = "The NitiCore™ engine is running deterministic math across every dimension of your finances.",
  awaitCompletion = false,
  reassurances = DEFAULT_REASSURANCES,
}: Props) {
  const [active, setActive] = useState(0);
  const [waitingMs, setWaitingMs] = useState(0);

  const lastIndex = steps.length - 1;
  const holding = awaitCompletion && active >= lastIndex;

  useEffect(() => {
    if (awaitCompletion) {
      if (active >= lastIndex) return;
      const t = setTimeout(() => setActive((v) => v + 1), stepDurationMs);
      return () => clearTimeout(t);
    }
    if (active >= steps.length) {
      const t = setTimeout(onComplete, 260);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActive((v) => v + 1), stepDurationMs);
    return () => clearTimeout(t);
  }, [active, steps.length, lastIndex, stepDurationMs, onComplete, awaitCompletion]);

  useEffect(() => {
    if (!holding) return;
    const i = setInterval(() => setWaitingMs((v) => v + 1000), 1000);
    return () => clearInterval(i);
  }, [holding]);

  const pct = Math.min(100, Math.round((active / steps.length) * 100));
  const reassurance =
    holding && waitingMs >= 4000 && reassurances.length > 0
      ? reassurances[Math.min(reassurances.length - 1, Math.floor(waitingMs / 8000))]
      : null;


  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--color-primary) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-7 shadow-elevated md:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          NitiCore™ engine
        </p>
        <h2 className="mt-2 font-display text-2xl text-foreground md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        {awaitCompletion ? (
          <>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 animate-pulse rounded-full bg-primary/80" />
            </div>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">
              Step {Math.min(active + 1, steps.length)} of {steps.length} ·{" "}
              {steps[Math.min(active, lastIndex)]?.label}
            </p>
            {reassurance && (
              <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {reassurance}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">{pct}% complete</p>
          </>
        )}


        <ul className="mt-6 space-y-2.5">
          {steps.map((s, i) => {
            const done = i < active;
            const running = i === active;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                  done
                    ? "border-secondary/30 bg-secondary-soft/40 text-foreground"
                    : running
                      ? "border-primary/40 bg-primary-soft/50 text-foreground"
                      : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  {done ? (
                    <Check className="h-4 w-4 text-secondary" />
                  ) : running ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span className="font-medium">{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
