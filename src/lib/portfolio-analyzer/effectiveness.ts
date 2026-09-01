/**
 * NitiInvest™ - Portfolio Effectiveness (derived, deterministic).
 *
 * Nothing here changes a NitiCore™ calculation. Every number is derived from
 * data the engine already produced: the projection basis, the deterministic
 * diagnostics, and the allocation the analyzer resolved.
 *
 * Effectiveness answers one question: "how far does today's plan get you,
 * relative to the NitiCore™ reference plan for the same horizon - and is the
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

/** Scenario returns are the blended expected return ± 2pp - a stated assumption, not a forecast. */
export function scenarioReturn(baseReturnPct: number, scenario: ScenarioKey): number {
  const delta = SCENARIOS.find((s) => s.key === scenario)?.delta ?? 0;
  return Math.max(3, Math.round((baseReturnPct + delta) * 10) / 10);
}

export function structuralScore(diagnostics: PortfolioDiagnostic[]): number {
  if (diagnostics.length === 0) return 60;
  return Math.round(diagnostics.reduce((a, d) => a + d.score, 0) / diagnostics.length);
}

/**
 * The contribution the "current plan" is measured from. When the profile has no
 * recorded SIP we fall back to the NitiCore™ suggested starting contribution so
 * the plan, the sliders, the reference path and the matrix all agree - and the
 * UI states which of the two it is using.
 */
export function baselineSip(basis: ProjectionBasis): number {
  return basis.monthlySip > 0 ? basis.monthlySip : basis.suggestedSipUplift;
}

/**
 * Horizon actually shown. Older stored analyses bucketed the horizon (20/15/10)
 * while the stated basis quoted the true runway; when the basis text carries a
 * runway, that is the number both the copy and the maths use.
 */
export function resolveHorizon(basis: ProjectionBasis): number {
  const m = /about\s+(\d{1,2})\s+years/i.exec(basis.horizonBasis ?? "");
  const stated = m ? Number(m[1]) : NaN;
  return Number.isFinite(stated) && stated >= 3 && stated <= 40 ? stated : basis.defaultHorizonYears;
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
  // The reference is a fixed target: the NitiCore™ plan (your contribution plus
  // its suggested uplift) run over your actual runway to retirement. It does not
  // move when you drag a slider, so readiness always means the same thing.
  const reference = Math.max(
    1,
    projectValue({
      currentValue: basis.currentValue,
      monthlySip: baselineSip(basis) + basis.suggestedSipUplift,
      annualReturnPct: basis.expectedReturnPct,
      years: resolveHorizon(basis),
    }),
  );
  const fundingPct = Math.max(0, Math.round((projected / reference) * 100));
  const structure = structuralScore(diagnostics);
  const score = Math.max(
    0,
    Math.min(100, Math.round(Math.min(100, fundingPct) * 0.65 + structure * 0.35)),
  );


  // Rough sum of contributions with the annual step-up applied.
  let contributed = 0;
  for (let y = 0; y < Math.round(plan.years); y++) {
    contributed += plan.monthlySip * 12 * Math.pow(1 + plan.stepUpPct / 100, y);
  }

  return {
    score,
    projected,
    reference,
    fundingPct,
    structure,
    returnPct,
    contributed: Math.round(contributed),
  };
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
      const r = computeEffectiveness(basis, diagnostics, {
        ...plan,
        stepUpPct: stepUp,
        scenario: s.key,
      });
      out.push({ stepUp, scenario: s.key, score: r.score, projected: r.projected });
    }
  }
  return out;
}

/**
 * Which lever moves the outcome more - contributing more, or assuming a higher
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
    ? "Highest-impact lever: raising your annual contribution moves the outcome more than assuming a higher return - and it is the one you actually control."
    : "Highest-impact lever: at this contribution level the return assumption dominates the outcome, which is exactly the part of the plan you cannot control. Raising contributions is the more reliable route.";
}

/* ─────────────── Overlap intelligence ─────────────── */

export interface OverlapFinding {
  label: string;
  pct: number;
  members: { name: string; pct: number }[];
  severity: "High" | "Moderate";
}

/** Only reports overlap the exposure grouping actually found - never estimated. */
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
    {
      label: "Broad market −10%",
      detail: "A routine correction - these happen most years.",
      base: totalValue,
      drop: 0.1,
    },
    {
      label: "Equity −20%",
      detail: "A cyclical bear market affecting your equity sleeve.",
      base: equityValue,
      drop: 0.2,
    },
    {
      label: "Equity −30%",
      detail: "A severe drawdown, comparable with 2008 or March 2020.",
      base: equityValue,
      drop: 0.3,
    },
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

/* ─────────────── Personalised (exposure-weighted) stress ─────────────── */

/**
 * A single illustrative shock applied per exposure family. Rates are stated
 * NitiCore™ exposure assumptions - they are not forecasts, and they are only
 * applied to families the analyzer actually identified.
 */
const FAMILY_SHOCK: { test: RegExp; shock: number; basis: string }[] = [
  { test: /gold/i, shock: 5, basis: "Gold usually cushions equity falls rather than amplifying them." },
  { test: /debt|cash/i, shock: 2, basis: "Debt and cash barely move in an equity drawdown." },
  { test: /hybrid/i, shock: 15, basis: "Hybrid funds hold a debt sleeve that absorbs part of the fall." },
  { test: /mid\s*&?\s*small|small\s*cap|midcap|mid-cap/i, shock: 38, basis: "Mid and small caps historically fall far harder than the index." },
  { test: /bank/i, shock: 32, basis: "A single-sector index concentrates the drawdown into one part of the economy." },
  { test: /nifty\s?50|large-cap index/i, shock: 25, basis: "Broad large-cap index exposure falls roughly with the market." },
  { test: /direct equity/i, shock: 35, basis: "Individual companies carry business risk on top of market risk." },
  { test: /active equity/i, shock: 30, basis: "Active equity funds move with the market, with manager risk on top." },
  { test: /real assets|reit|invit/i, shock: 25, basis: "Listed real-asset vehicles trade like equity in a sell-off." },
  { test: /index/i, shock: 27, basis: "Index exposure falls broadly with the market it tracks." },
];

export interface StressLeg {
  label: string;
  pct: number;
  value: number;
  shockPct: number;
  loss: number;
  basis: string;
  classified: boolean;
}

export interface PersonalisedStress {
  label: string;
  impactPct: number;
  loss: number;
  after: number;
  total: number;
  explanation: string;
  legs: StressLeg[];
  unclassifiedPct: number;
}

/**
 * Builds one portfolio-specific illustrative drawdown by applying a stated
 * shock to each identified exposure family, so a riskier mix produces a larger
 * impact. Nothing is invented for families the analyzer could not classify -
 * those are reported separately and excluded from the shock.
 */
export function personalisedStress(
  groups: { label: string; pct: number; value: number }[],
  totalValue: number,
): PersonalisedStress | null {
  if (totalValue <= 0 || groups.length === 0) return null;
  const legs: StressLeg[] = [];
  let unclassifiedPct = 0;
  for (const g of groups) {
    const match = FAMILY_SHOCK.find((f) => f.test.test(g.label));
    if (!match) {
      unclassifiedPct += g.pct;
      continue;
    }
    legs.push({
      label: g.label,
      pct: Math.round(g.pct * 10) / 10,
      value: g.value,
      shockPct: match.shock,
      loss: Math.round((g.value * match.shock) / 100),
      basis: match.basis,
      classified: true,
    });
  }
  if (legs.length === 0) return null;
  legs.sort((a, b) => b.loss - a.loss);
  const loss = legs.reduce((a, l) => a + l.loss, 0);
  const impactPct = Math.round((loss / totalValue) * 1000) / 10;
  const driver = legs[0];
  const equityHeavy = impactPct >= 22;
  const explanation = `${driver.label} is the largest single contributor to this fall, taking about ${Math.round((driver.loss / Math.max(1, loss)) * 100)}% of the total impact. ${
    equityHeavy
      ? "Your mix is weighted towards growth exposure, so a market-wide correction lands close to full force."
      : "Your defensive and non-equity holdings absorb a meaningful part of the fall, which is why the impact is below a pure-equity portfolio."
  }`;
  return {
    label: "Broad equity correction, weighted to your actual exposure",
    impactPct,
    loss,
    after: Math.max(0, totalValue - loss),
    total: totalValue,
    explanation,
    legs,
    unclassifiedPct: Math.round(unclassifiedPct * 10) / 10,
  };
}
