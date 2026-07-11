/**
 * Financial Journey computation.
 *
 * Pure, deterministic. Given the current NitiCore-computed metrics and the
 * user's most recent previous snapshot, produces:
 *   - deltas (score, netWorth, emergency, debt, savings, retirement, nitiAge)
 *   - human-readable "since last review" lines
 *   - milestone achievements (genuine, boolean-gated)
 *
 * No AI, no I/O — safe to import from client or server code.
 */
import { formatINR } from "@/lib/finance/core";

export interface CurrentMetricsForJourney {
  nitiScore: number;
  nitiScoreGrade: string;
  nitiAge: number;
  actualAge: number;
  netWorth: number;
  totalLiabilities: number;
  savingsRatePct: number;
  emergencyMonths: number;
  debtRatioPct: number;
  retirementStatus: string;
  hasTermInsurance: boolean;
  hasHealthInsurance: boolean;
}

export interface PreviousSnapshotForJourney {
  taken_at?: string | null;
  niti_score?: number | null;
  niti_score_grade?: string | null;
  niti_age?: number | null;
  net_worth?: number | null;
  total_liabilities?: number | null;
  savings_rate?: number | null;
  emergency_months?: number | null;
  debt_ratio?: number | null;
  retirement_status?: string | null;
}

export interface JourneyDelta {
  label: string;
  current: string;
  previous: string;
  direction: "up" | "down" | "flat";
  /** true when the direction represents an improvement */
  positive: boolean;
  deltaText: string;
  /** Human sentence for "Since your last review" list. */
  narrative: string;
}

export interface JourneyMilestone {
  key: string;
  label: string;
}

export interface JourneyResult {
  hasHistory: boolean;
  previousTakenAt: string | null;
  deltas: JourneyDelta[];
  milestones: JourneyMilestone[];
  /** Short bullet list summarising positive changes. */
  sinceLastReview: string[];
}

function fmtMonths(v: number) {
  const rounded = Math.round(v * 10) / 10;
  return `${rounded} month${Math.abs(rounded - 1) < 0.05 ? "" : "s"}`;
}
function fmtPct(v: number) {
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

export function computeJourney(
  current: CurrentMetricsForJourney,
  previous: PreviousSnapshotForJourney | null,
): JourneyResult {
  const milestones = deriveMilestones(current);
  if (!previous) {
    return { hasHistory: false, previousTakenAt: null, deltas: [], milestones, sinceLastReview: [] };
  }

  const deltas: JourneyDelta[] = [];
  const sinceLastReview: string[] = [];

  // NitiScore — higher is better
  if (typeof previous.niti_score === "number") {
    const diff = current.nitiScore - previous.niti_score;
    if (Math.abs(diff) >= 1) {
      const dir = diff > 0 ? "up" : "down";
      const positive = diff > 0;
      const narrative = positive
        ? `Your NitiScore has risen from ${previous.niti_score} to ${current.nitiScore}, a meaningful ${diff}-point improvement in overall financial health.`
        : `Your NitiScore has moved from ${previous.niti_score} to ${current.nitiScore}. Small dips are normal; the priority is staying with the plan.`;
      deltas.push({
        label: "NitiScore",
        current: String(current.nitiScore),
        previous: String(previous.niti_score),
        direction: dir,
        positive,
        deltaText: `${diff > 0 ? "+" : ""}${diff} pts`,
        narrative,
      });
      if (positive) sinceLastReview.push(`NitiScore increased by ${diff} points`);
    }
  }

  // NitiAge — lower is better
  if (typeof previous.niti_age === "number") {
    const diff = current.nitiAge - previous.niti_age;
    if (Math.abs(diff) >= 1) {
      const positive = diff < 0;
      const narrative = positive
        ? `Your NitiAge has come down from ${previous.niti_age} to ${current.nitiAge}, meaning your finances are behaving more like someone younger and better prepared.`
        : `Your NitiAge has risen from ${previous.niti_age} to ${current.nitiAge}. That usually signals slower saving or new liabilities worth reviewing.`;
      deltas.push({
        label: "NitiAge",
        current: `${current.nitiAge} yrs`,
        previous: `${previous.niti_age} yrs`,
        direction: diff < 0 ? "down" : "up",
        positive,
        deltaText: `${diff > 0 ? "+" : ""}${diff} yrs`,
        narrative,
      });
      if (positive) sinceLastReview.push(`NitiAge reduced by ${Math.abs(diff)} year${Math.abs(diff) === 1 ? "" : "s"}`);
    }
  }

  // Net worth — higher better
  if (typeof previous.net_worth === "number") {
    const diff = current.netWorth - previous.net_worth;
    if (Math.abs(diff) >= 1) {
      const positive = diff > 0;
      const narrative = positive
        ? `Your net worth has grown by ${formatINR(diff)} since your last review, from ${formatINR(previous.net_worth)} to ${formatINR(current.netWorth)}. Wealth built patiently tends to stay.`
        : `Your net worth has moved from ${formatINR(previous.net_worth)} to ${formatINR(current.netWorth)}. Worth reviewing which liabilities or asset drawdowns caused the change.`;
      deltas.push({
        label: "Net Worth",
        current: formatINR(current.netWorth),
        previous: formatINR(previous.net_worth),
        direction: diff > 0 ? "up" : "down",
        positive,
        deltaText: `${diff > 0 ? "+" : "-"}${formatINR(Math.abs(diff))}`,
        narrative,
      });
      if (positive) sinceLastReview.push(`Net Worth grew by ${formatINR(diff)}`);
    }
  }

  // Emergency months — higher better
  if (typeof previous.emergency_months === "number") {
    const diff = current.emergencyMonths - previous.emergency_months;
    if (Math.abs(diff) >= 0.2) {
      const positive = diff > 0;
      const narrative = positive
        ? `Your emergency fund has increased from ${fmtMonths(previous.emergency_months)} to ${fmtMonths(current.emergencyMonths)}. This gives you significantly better resilience against unexpected events.`
        : `Your emergency buffer has slipped from ${fmtMonths(previous.emergency_months)} to ${fmtMonths(current.emergencyMonths)}. Rebuilding it usually takes precedence over new investments.`;
      deltas.push({
        label: "Emergency Fund",
        current: fmtMonths(current.emergencyMonths),
        previous: fmtMonths(previous.emergency_months),
        direction: diff > 0 ? "up" : "down",
        positive,
        deltaText: `${diff > 0 ? "+" : ""}${(Math.round(diff * 10) / 10).toFixed(1)} months`,
        narrative,
      });
      if (positive) sinceLastReview.push(`Emergency Fund improved by ${(Math.round(diff * 10) / 10).toFixed(1)} months`);
    }
  }

  // Debt (total liabilities) — lower better
  if (typeof previous.total_liabilities === "number") {
    const diff = current.totalLiabilities - previous.total_liabilities;
    if (Math.abs(diff) >= 1) {
      const positive = diff < 0;
      const narrative = positive
        ? `You have reduced total debt by ${formatINR(Math.abs(diff))} since your last review. Every rupee of interest saved compounds into future wealth.`
        : `Your total debt has grown by ${formatINR(diff)}. New debt is fine when it is productive; worth checking the interest cost against expected returns.`;
      deltas.push({
        label: "Debt",
        current: formatINR(current.totalLiabilities),
        previous: formatINR(previous.total_liabilities),
        direction: diff < 0 ? "down" : "up",
        positive,
        deltaText: `${diff < 0 ? "-" : "+"}${formatINR(Math.abs(diff))}`,
        narrative,
      });
      if (positive) sinceLastReview.push(`Debt reduced by ${formatINR(Math.abs(diff))}`);
    }
  }

  // Savings rate — higher better
  if (typeof previous.savings_rate === "number") {
    const diff = current.savingsRatePct - previous.savings_rate;
    if (Math.abs(diff) >= 0.5) {
      const positive = diff > 0;
      const narrative = positive
        ? `Your savings rate has climbed from ${fmtPct(previous.savings_rate)} to ${fmtPct(current.savingsRatePct)}. Small habit shifts compound quietly over years.`
        : `Your savings rate has slipped from ${fmtPct(previous.savings_rate)} to ${fmtPct(current.savingsRatePct)}. Often a lifestyle-creep signal worth a look.`;
      deltas.push({
        label: "Savings Rate",
        current: fmtPct(current.savingsRatePct),
        previous: fmtPct(previous.savings_rate),
        direction: diff > 0 ? "up" : "down",
        positive,
        deltaText: `${diff > 0 ? "+" : ""}${(Math.round(diff * 10) / 10).toFixed(1)}%`,
        narrative,
      });
      if (positive) sinceLastReview.push(`Savings rate improved by ${(Math.round(diff * 10) / 10).toFixed(1)}%`);
    }
  }

  // Retirement status — categorical improvement
  if (previous.retirement_status && previous.retirement_status !== current.retirementStatus) {
    const order = ["not_available", "critical", "needs_attention", "on_track"];
    const prevIdx = order.indexOf(previous.retirement_status);
    const curIdx = order.indexOf(current.retirementStatus);
    if (prevIdx >= 0 && curIdx >= 0 && curIdx > prevIdx) {
      sinceLastReview.push("Retirement readiness improved");
    }
  }

  return {
    hasHistory: true,
    previousTakenAt: previous.taken_at ?? null,
    deltas,
    milestones,
    sinceLastReview,
  };
}

function deriveMilestones(m: CurrentMetricsForJourney): JourneyMilestone[] {
  const out: JourneyMilestone[] = [];
  if (m.emergencyMonths >= 6) out.push({ key: "emergency-6m", label: "Built a 6-month emergency fund" });
  if (m.debtRatioPct > 0 && m.debtRatioPct < 30) out.push({ key: "debt-under-30", label: "Kept debt below 30% of income" });
  if (["A", "B"].includes(m.nitiScoreGrade)) out.push({ key: "grade-b-plus", label: `Reached Grade ${m.nitiScoreGrade}` });
  if (m.netWorth > 0) out.push({ key: "positive-networth", label: "Achieved positive net worth" });
  if (m.retirementStatus === "on_track" || m.retirementStatus === "needs_attention") {
    out.push({ key: "retirement-started", label: "Started retirement planning" });
  }
  if (m.hasTermInsurance && m.hasHealthInsurance) out.push({ key: "insured", label: "Covered by both term and health insurance" });
  if (m.savingsRatePct >= 20) out.push({ key: "savings-20", label: "Saving 20%+ of income" });
  return out;
}
