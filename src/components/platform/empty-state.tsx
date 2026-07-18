import { type ComponentType, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

/**
 * EmptyState — canonical "nothing here yet" surface for lists, analyzers
 * and reports. Standardises padding, iconography and CTA layout.
 */
interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Sparkles,
  eyebrow,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      {eyebrow && (
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          {eyebrow}
        </p>
      )}
      <h3 className="mt-2 font-display text-lg text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
