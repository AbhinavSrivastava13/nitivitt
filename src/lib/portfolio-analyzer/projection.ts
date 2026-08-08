/**
 * NitiInvest™ V3 — Portfolio Projection.
 *
 * Deterministic. Zero AI. The projection starts from the user's ACTUAL
 * portfolio value and their existing monthly contribution (from NitiCore™),
 * never from a blank SIP calculator.
 *
 * Nothing here predicts markets. It compounds a stated assumption, which is
 * why every surface labels the output as an illustrative scenario.
 */
import type { ProjectionBasis, ProjectionPoint } from "./types";

export interface ProjectionArgs {
  currentValue: number;
  monthlySip: number;
  annualReturnPct: number;
  years: number;
  /** Annual step-up applied to the monthly contribution (e.g. 10 = +10% a year). */
  annualStepUpPct?: number;
}

/** Future value of a lump sum plus a monthly contribution (SIP due at month start). */
export function projectValue({ currentValue, monthlySip, annualReturnPct, years, annualStepUpPct = 0 }: ProjectionArgs): number {
  const r = annualReturnPct / 100;
  const m = r / 12;
  const wholeYears = Math.max(0, Math.round(years));
  const lump = currentValue * Math.pow(1 + r, years);

  if (monthlySip <= 0) return Math.round(lump);

  // Year-by-year so an annual step-up compounds exactly, with no step-up
  // reducing to the standard SIP-due formula.
  let sipValue = 0;
  for (let y = 0; y < wholeYears; y++) {
    const contribution = monthlySip * Math.pow(1 + annualStepUpPct / 100, y);
    const yearEnd =
      m === 0
        ? contribution * 12
        : contribution * ((Math.pow(1 + m, 12) - 1) / m) * (1 + m);
    sipValue = sipValue * (1 + r) + yearEnd;
  }
  return Math.round(lump + sipValue);
}

/** Year-by-year series for two or three scenarios so the chart draws smoothly. */
export function buildProjectionSeries(
  base: ProjectionArgs,
  alternative: ProjectionArgs,
  third?: ProjectionArgs,
): ProjectionPoint[] {
  const years = Math.max(base.years, alternative.years, third?.years ?? 0);
  const out: ProjectionPoint[] = [];
  for (let y = 0; y <= years; y++) {
    out.push({
      year: y,
      base: projectValue({ ...base, years: y }),
      alternative: projectValue({ ...alternative, years: y }),
      ...(third ? { third: projectValue({ ...third, years: y }) } : {}),
    });
  }
  return out;
}

/** Blended expected return implied by the portfolio's own asset mix. */
export function blendedExpectedReturn(mix: {
  equityPct: number;
  debtPct: number;
  goldPct: number;
  cashPct: number;
}): number {
  const other = Math.max(0, 100 - mix.equityPct - mix.debtPct - mix.goldPct - mix.cashPct);
  const weighted =
    mix.equityPct * 12 + mix.debtPct * 7 + mix.goldPct * 7.5 + mix.cashPct * 4 + other * 9.5;
  const total = mix.equityPct + mix.debtPct + mix.goldPct + mix.cashPct + other;
  if (total <= 0) return 10;
  return Math.round((weighted / total) * 10) / 10;
}

export function inrShort(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * NitiCore™ contextual guidance for the projection — plain sentences, no new
 * score, no rating. Purely derived from the deterministic basis.
 */
export function projectionGuidance(basis: ProjectionBasis, horizonYears: number): string[] {
  const out: string[] = [];
  const baseFv = projectValue({
    currentValue: basis.currentValue,
    monthlySip: basis.monthlySip,
    annualReturnPct: basis.expectedReturnPct,
    years: horizonYears,
  });

  if (basis.monthlySip > 0) {
    out.push(
      `At your current contribution of ₹${basis.monthlySip.toLocaleString("en-IN")} a month, this portfolio is on track to reach approximately ${inrShort(baseFv)} over ${horizonYears} years, assuming a ${basis.expectedReturnPct}% annual return.`,
    );
  } else {
    out.push(
      `With no recurring contribution recorded, this portfolio compounds only on its existing ${inrShort(basis.currentValue)}, reaching roughly ${inrShort(baseFv)} in ${horizonYears} years at a ${basis.expectedReturnPct}% annual return.`,
    );
  }

  const upliftFv = projectValue({
    currentValue: basis.currentValue,
    monthlySip: basis.monthlySip + basis.suggestedSipUplift,
    annualReturnPct: basis.expectedReturnPct,
    years: horizonYears,
  });
  out.push(
    `Increasing your monthly investment by ₹${basis.suggestedSipUplift.toLocaleString("en-IN")} could lift the projected outcome to about ${inrShort(upliftFv)} — a difference of roughly ${inrShort(upliftFv - baseFv)} that comes purely from contribution, not from market luck.`,
  );

  const longerFv = projectValue({
    currentValue: basis.currentValue,
    monthlySip: basis.monthlySip,
    annualReturnPct: basis.expectedReturnPct,
    years: horizonYears + 5,
  });
  out.push(
    `Staying invested five years longer, changing nothing else, takes the same plan to around ${inrShort(longerFv)}. Time in the market is the one lever that costs you nothing to pull.`,
  );

  out.push(
    `The return assumption is the least reliable input here. A one-point change in it moves the outcome materially, which is why NitiCore™ treats these as illustrative scenarios rather than forecasts.`,
  );

  return out;
}
