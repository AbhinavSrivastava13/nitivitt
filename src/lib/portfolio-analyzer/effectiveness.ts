/**
 * NitiInvest™ — Portfolio Effectiveness (derived, deterministic).
 *
 * Nothing here changes a NitiCore™ calculation. Every number is derived from
 * data the engine already produced: the projection basis, the deterministic
 * diagnostics, and the allocation the analyzer resolved.
 *
 * Effectiveness answers one question: "how far does today's plan get you,
 * relative to the NitiCore™ reference plan for the same horizon — and is the
 * portfolio structurally sound enough to get there?"
 *
 *   effectiveness = 65% funding progress + 35% structural health
 *
 * Funding progress  = projected corpus ÷ reference corpus (capped at 100%)
 * Reference plan    = your portfolio + NitiCore's suggested contribution uplift,
 *                     at the blended expected return, over the same horizon.
 * Structural health = mean of the deterministic NitiCore™ diagnostics.
 */
import { projectValue } from "./projection";
import type { PortfolioDiagnostic, ProjectionBasis } from "./types";

export type ScenarioKey = "conservative" | "base" | "optimistic";

export const SCENARIOS: { key: ScenarioKey; label: string; delta: number }[] = [
  { key: "conservative", label: "Conservative", delta: -2 },
  { key: "base", label: "Base", delta: 0 },
  { key: "optimistic", label: "Optimistic", delta: 2 },
];

/** Scenario returns are the blended expected return ± 2pp — a stated assumption, not a forecast. */
export function scenarioReturn(baseReturnPct: number, scenario: ScenarioKey): number {
  const delta = SCENARIOS.find((s) => s.key === scenario)?.delta ?? 0;
  return Math.max(3, Math.round((baseReturnPct + delta) * 10) / 10);
}

export function structuralScore(diagnostics: PortfolioDiagnostic[]): number {
  if (diagnostics.length === 0) return 60;
  return Math.round(diagnostics.reduce((a, d) => a + d.score, 0) / diagnostics.length);
}

export interface PlanInput {
  monthlySip: number;
  stepUpPct: number;
  years: number;
  scenario: ScenarioKey;
}

export interface EffectivenessResult {
  score: number;
  projected: number;
  reference: number;
  fundingPct: number;
  structure: number;
  returnPct: number;
  contributed: number;
}

export function computeEffectiveness(
  basis: ProjectionBasis,
  diagnostics: PortfolioDiagnostic[],
  plan: PlanInput,
): EffectivenessResult {
  const returnPct = scenarioReturn(basis.expectedReturnPct, plan.scenario);
  const projected = projectValue({
    currentValue: basis.currentValue,
    monthlySip: plan.monthlySip,
    annualReturnPct: returnPct,
    years: plan.years,
    annualStepUpPct: plan.stepUpPct,
  });
  const reference = Math.max(
    1,
    projectValue({
      currentValue: basis.currentValue,
      monthlySip: basis.monthlySip + basis.suggestedSipUplift,
      annualReturnPct: basis.expectedReturnPct,
      years: plan.years,
    }),
  );
  const fundingPct = Math.min(100, Math.round((projected / reference) * 100));
  const structure = structuralScore(diagnostics);
  const score = Math.max(0, Math.min(100, Math.round(fundingPct * 0.65 + structure * 0.35)));

  // Rough sum of contributions with the annual step-up applied.
  let contributed = 0;
  for (let y = 0; y < Math.round(plan.years); y++) {
    contributed += plan.monthlySip * 12 * Math.pow(1 + plan.stepUpPct / 100, y);
  }

  return { score, projected, reference, fundingPct, structure, returnPct, contributed: Math.round(contributed) };
}

export const STEP_UP_ROWS = [0, 5, 10, 15];

export interface HeatCell {
  stepUp: number;
  scenario: ScenarioKey;
  score: number;
  projected: number;
}

export function effectivenessGrid(
  basis: ProjectionBasis,
  diagnostics: PortfolioDiagnostic[],
  plan: Omit<PlanInput, "stepUpPct" | "scenario">,
): HeatCell[] {
  const out: HeatCell[] = [];
  for (const stepUp of STEP_UP_ROWS) {
    for (const s of SCENARIOS) {
      const r = computeEffectiveness(basis, diagnostics, { ...plan, stepUp: 0, stepUpPct: stepUp, scenario: s.key } as PlanInput);
      out.push({ stepUp, scenario: s.key, score: r.score, projected: r.projected });
    }
  }
  return out;
}

/**
 * Which lever moves the outcome more — contributing more, or assuming a higher
 * return? Derived by comparing the two edges of the grid, never asserted.
 */
export function highestImpactLever(grid: HeatCell[]): string {
  const at = (stepUp: number, scenario: ScenarioKey) =>
    grid.find((c) => c.stepUp === stepUp && c.scenario === scenario)?.projected ?? 0;
  const base = at(0, "base");
  if (base <= 0) return "";
  const contributionGain = at(15, "base") - base;
  const returnGain = at(0, "optimistic") - base;
  if (contributionGain <= 0 && returnGain <= 0) return "";
  return contributionGain >= returnGain
    ? "Highest-impact lever: raising your annual contribution moves the outcome more than assuming a higher return — and it is the one you actually control."
    : "Highest-impact lever: at this contribution level the return assumption dominates the outcome, which is exactly the part of the plan you cannot control. Raising contributions is the more reliable route.";
}

/* ─────────────── Overlap intelligence ─────────────── */

export interface OverlapFinding {
  label: string;
  pct: number;
  members: { name: string; pct: number }[];
  severity: "High" | "Moderate";
}

/** Only reports overlap the exposure grouping actually found — never estimated. */
export function detectOverlap(
  groups: { label: string; pct: number; members: { name: string; pct: number }[] }[],
): OverlapFinding | null {
  const candidates = groups
    .filter((g) => g.members.length >= 2 && g.pct >= 25)
    .sort((a, b) => b.pct - a.pct);
  const g = candidates[0];
  if (!g) return null;
  return {
    label: g.label,
    pct: Math.round(g.pct * 10) / 10,
    members: g.members.slice(0, 4),
    severity: g.pct >= 40 ? "High" : "Moderate",
  };
}

/* ─────────────── Cost intelligence ─────────────── */

/** Reads the blended cost only when the engine actually measured it. */
export function blendedCostFromDiagnostics(diagnostics: PortfolioDiagnostic[]): number | null {
  const d = diagnostics.find((x) => x.id === "cost");
  if (!d) return null;
  const m = /~?([\d.]+)%\s*blended cost/i.exec(d.valueLabel);
  return m ? Number(m[1]) : null;
}

export function costDrag(
  basis: ProjectionBasis,
  blendedCostPct: number,
  benchmarkCostPct: number,
  years: number,
): { withCost: number; lowerCost: number; difference: number } | null {
  if (blendedCostPct <= benchmarkCostPct) return null;
  const common = { currentValue: basis.currentValue, monthlySip: basis.monthlySip, years };
  const withCost = projectValue({ ...common, annualReturnPct: basis.expectedReturnPct });
  const lowerCost = projectValue({
    ...common,
    annualReturnPct: basis.expectedReturnPct + (blendedCostPct - benchmarkCostPct),
  });
  return { withCost, lowerCost, difference: lowerCost - withCost };
}

/* ─────────────── Stress testing ─────────────── */

export interface StressScenario {
  label: string;
  detail: string;
  impact: number;
  after: number;
  pctOfPortfolio: number;
}

export function stressScenarios(totalValue: number, equityValue: number): StressScenario[] {
  const rows: { label: string; detail: string; base: number; drop: number }[] = [
    { label: "Broad market −10%", detail: "A routine correction — these happen most years.", base: totalValue, drop: 0.1 },
    { label: "Equity −20%", detail: "A cyclical bear market affecting your equity sleeve.", base: equityValue, drop: 0.2 },
    { label: "Equity −30%", detail: "A severe drawdown, comparable with 2008 or March 2020.", base: equityValue, drop: 0.3 },
  ];
  return rows.map((r) => {
    const impact = Math.round(r.base * r.drop);
    return {
      label: r.label,
      detail: r.detail,
      impact,
      after: Math.max(0, totalValue - impact),
      pctOfPortfolio: totalValue > 0 ? Math.round((impact / totalValue) * 1000) / 10 : 0,
    };
  });
}
