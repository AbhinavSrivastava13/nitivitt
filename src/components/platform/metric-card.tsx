import { type ComponentType, type ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./status-badge";

/**
 * MetricCard — canonical "number tile" used on the dashboard, health report
 * and analyzer summary. Consistent height, padding and hierarchy.
 */
interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: { label: string; tone?: StatusTone };
  footer?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  badge,
  footer,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-soft ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold text-foreground md:text-4xl">
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {hint && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        )}
        {badge && (
          <div className="mt-3">
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
        )}
      </div>
      {footer && <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
