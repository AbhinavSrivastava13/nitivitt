/**
 * Presentation-only rating helpers.
 *
 * NitiScore™ remains the single master financial score. Individual analyzers
 * translate their deterministic 0-100 score into a human tier + letter grade
 * so each surface carries its own identity rather than "another score".
 *
 * Nothing here changes math. Same input → same tier.
 */

export type RatingTone = "success" | "primary" | "accent" | "warning" | "danger";

export interface Rating {
  label: string;
  grade: "A+" | "A" | "B+" | "B" | "C" | "D";
  tone: RatingTone;
  score: number;
}

function portfolioGrade(score: number): Rating["grade"] {
  if (score >= 85) return "A+";
  if (score >= 72) return "A";
  if (score >= 60) return "B+";
  if (score >= 50) return "B";
  if (score >= 38) return "C";
  return "D";
}

function debtGrade(score: number): Rating["grade"] {
  if (score >= 85) return "A+";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

const TONE_TW: Record<RatingTone, { bg: string; text: string; ring: string; solid: string }> = {
  success: { bg: "bg-success-soft", text: "text-success", ring: "ring-success/30", solid: "bg-success text-success-foreground" },
  primary: { bg: "bg-primary-soft", text: "text-primary", ring: "ring-primary/30", solid: "bg-primary text-primary-foreground" },
  accent:  { bg: "bg-accent/15",   text: "text-accent-foreground", ring: "ring-accent/40", solid: "bg-accent text-accent-foreground" },
  warning: { bg: "bg-warning-soft", text: "text-warning", ring: "ring-warning/30", solid: "bg-warning text-warning-foreground" },
  danger:  { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/30", solid: "bg-destructive text-destructive-foreground" },
};

export function ratingClasses(tone: RatingTone) {
  return TONE_TW[tone];
}

/** Portfolio Rating (NitiInvest™) - six-tier grade system with descriptive labels. */
export function derivePortfolioRating(score: number): Rating {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const g = portfolioGrade(s);
  if (s >= 85) return { label: "Exceptional",       grade: g, tone: "success", score: s };
  if (s >= 72) return { label: "Strong",            grade: g, tone: "primary", score: s };
  if (s >= 60) return { label: "Well Balanced",     grade: g, tone: "accent",  score: s };
  if (s >= 50) return { label: "Well Balanced",     grade: g, tone: "accent",  score: s };
  if (s >= 38) return { label: "Needs Improvement", grade: g, tone: "warning", score: s };
  return       { label: "High Risk",                grade: g, tone: "danger",  score: s };
}

/** Debt Health Rating (NitiLoan™) - five tiers. */
export function deriveDebtHealthRating(score: number): Rating {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const g = debtGrade(s);
  if (s >= 85) return { label: "Healthy",   grade: g, tone: "success", score: s };
  if (s >= 70) return { label: "Stable",    grade: g, tone: "primary", score: s };
  if (s >= 55) return { label: "Watchlist", grade: g, tone: "accent",  score: s };
  if (s >= 40) return { label: "Stressed",  grade: g, tone: "warning", score: s };
  return       { label: "Critical",         grade: g, tone: "danger",  score: s };
}
