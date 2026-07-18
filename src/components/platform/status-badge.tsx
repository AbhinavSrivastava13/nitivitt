import { type ReactNode } from "react";

export type StatusTone =
  | "success"
  | "warning"
  | "critical"
  | "info"
  | "neutral"
  | "accent";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-secondary-soft text-secondary",
  warning: "bg-accent/15 text-accent-foreground",
  critical: "bg-destructive/10 text-destructive",
  info: "bg-primary-soft text-primary",
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent/15 text-accent-foreground",
};

interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * StatusBadge — single source of truth for scoring/priority/status pills
 * (Grade A, High priority, Needs attention, Stable, etc.).
 */
export function StatusBadge({
  tone = "neutral",
  children,
  icon,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${TONE_STYLES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
