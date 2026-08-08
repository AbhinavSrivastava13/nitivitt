/**
 * NitiInvest™ V2 — Portfolio Intelligence layer.
 *
 * Deterministic. Zero AI. Builds on top of the existing engine's computed
 * aggregates and turns them into: diagnostics, per-holding intelligence,
 * a real peer benchmark, and actionable insights (why / impact / action).
 *
 * Gemini may later attach `aiSummary` strings onto holding intelligence —
 * it never changes a number or a recommendation.
 */
import type { FinancialContext, NitiCoreInput } from "@/lib/niti-core";
import {
  ASSET_CLASS_LABEL,
  type AllocationSlice,
  type AssetClass,
  type Holding,
  type HoldingIntelligence,
  type PeerBenchmark,
  type PeerBenchmarkRow,
  type PortfolioDiagnostic,
  type PortfolioInsight,
} from "./types";

export interface IntelligenceInput {
  holdings: Holding[];
  totalValue: number;
  equityPct: number;
  debtPct: number;
  goldPct: number;
  cashPct: number;
  targetEquityPct: number;
  diversificationScore: number;
  concentrationScore: number;
  topPct: number;
  topName: string | null;
  indexShare: number;
  bySector: AllocationSlice[];
  input: NitiCoreInput;
  context: FinancialContext;
}

const FUND_CLASSES: AssetClass[] = ["equity_mf", "debt_mf", "hybrid_mf", "index_fund", "etf", "gold_etf"];

function valueOf(h: Holding): number {
  if (h.currentValue != null) return Number(h.currentValue) || 0;
  if (h.units != null && h.currentPrice != null) return Number(h.units) * Number(h.currentPrice);
  return 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function statusOf(score: number): PortfolioDiagnostic["status"] {
  if (score >= 70) return "good";
  if (score >= 45) return "watch";
  return "action";
}

/* ─────────────────────────── DIAGNOSTICS ─────────────────────────── */

export function buildDiagnostics(a: IntelligenceInput): PortfolioDiagnostic[] {
  const out: PortfolioDiagnostic[] = [];
  if (a.totalValue <= 0) return out;

  // 1. Diversification
  out.push({
    id: "diversification",
    label: "Diversification",
    score: a.diversificationScore,
    status: statusOf(a.diversificationScore),
    valueLabel: `${a.diversificationScore}/100`,
    targetLabel: "70+ is healthy",
    detail:
      a.diversificationScore >= 70
        ? "Capital is spread across enough asset classes that no single bucket decides the outcome."
        : "A large share of the portfolio sits inside one or two buckets, so their behaviour becomes your behaviour.",
  });

  // 2. Concentration
  const concScore = Math.max(0, Math.round(100 - a.topPct * 3));
  out.push({
    id: "concentration",
    label: "Concentration",
    score: concScore,
    status: statusOf(concScore),
    valueLabel: `${a.topPct}% in largest holding`,
    targetLabel: "Under 15% preferred",
    detail:
      a.topPct >= 25
        ? `${a.topName ?? "One holding"} carries an outsized share of the outcome. One bad cycle there moves the entire portfolio.`
        : a.topPct >= 15
          ? "The largest position still moves the portfolio meaningfully, but not dangerously."
          : "No single position dominates. Diversification math is working as intended.",
  });

  // 3. Asset allocation
  const drift = Math.abs(a.equityPct - a.targetEquityPct);
  const allocScore = Math.max(0, Math.round(100 - drift * 2.5));
  out.push({
    id: "allocation",
    label: "Asset allocation",
    score: allocScore,
    status: statusOf(allocScore),
    valueLabel: `${a.equityPct}% equity`,
    targetLabel: `Target ~${a.targetEquityPct}%`,
    detail:
      drift <= 8
        ? "Equity exposure fits your age, horizon and stated risk appetite."
        : a.equityPct > a.targetEquityPct
          ? "Equity sits above the level your horizon justifies, so drawdowns will feel sharper than they need to."
          : "Equity sits below your horizon-appropriate level, which quietly slows long-term compounding.",
  });

  // 4. Cost efficiency
  const rated = a.holdings.filter((h) => h.enrichment?.expenseRatio != null);
  const weighted =
    rated.length > 0
      ? rated.reduce((s, h) => s + (h.enrichment!.expenseRatio as number) * valueOf(h), 0) /
        Math.max(1, rated.reduce((s, h) => s + valueOf(h), 0))
      : null;
  const costProxy = weighted ?? (a.indexShare >= 40 ? 0.6 : a.indexShare >= 20 ? 1.0 : 1.4);
  const costScore = Math.max(0, Math.round(100 - (costProxy - 0.3) * 55));
  out.push({
    id: "cost",
    label: "Cost efficiency",
    score: costScore,
    status: statusOf(costScore),
    valueLabel: weighted ? `~${round1(weighted)}% blended cost` : `${a.indexShare}% passive`,
    targetLabel: "Lower drag compounds",
    detail:
      costScore >= 70
        ? "Expense drag on this portfolio is low, so more of the gross return actually reaches you."
        : "A meaningful share sits in higher-cost active vehicles. Over 20 years, 1% of annual cost can consume a fifth of the final corpus.",
  });

  // 5. Goal alignment
  const goalScore = Math.max(0, Math.round(100 - drift * 2 - (a.context.liquidityHealth === "critical" ? 25 : 0)));
  out.push({
    id: "goal",
    label: "Goal alignment",
    score: goalScore,
    status: statusOf(goalScore),
    valueLabel: a.context.lifeStage.replace(/_/g, " "),
    targetLabel: "Fit to life stage",
    detail:
      goalScore >= 70
        ? "The shape of this portfolio matches the stage of life it is meant to fund."
        : "The portfolio's risk shape and your current life stage are drifting apart. Structure matters more than fund selection here.",
  });

  // 6. Liquidity
  const liquidPct = round1(a.cashPct + a.debtPct);
  const liquidityScore =
    a.context.liquidityHealth === "excess" || a.context.liquidityHealth === "adequate"
      ? Math.min(100, 70 + Math.round(liquidPct / 2))
      : Math.max(10, Math.round(liquidPct * 3));
  out.push({
    id: "liquidity",
    label: "Liquidity",
    score: Math.min(100, liquidityScore),
    status: statusOf(Math.min(100, liquidityScore)),
    valueLabel: `${liquidPct}% in debt / cash`,
    targetLabel: "Emergency fund first",
    detail:
      a.context.liquidityHealth === "adequate" || a.context.liquidityHealth === "excess"
        ? "You have accessible money outside this portfolio, so investments will not be sold at the wrong moment."
        : "Without a funded emergency cushion, a short cash crunch turns into a forced sale of long-term assets.",
  });

  return out;
}

/* ────────────────────── FUND & STOCK INTELLIGENCE ────────────────────── */

export function buildHoldingIntelligence(a: IntelligenceInput): HoldingIntelligence[] {
  if (a.totalValue <= 0) return [];
  const sorted = [...a.holdings].sort((x, y) => valueOf(y) - valueOf(x)).slice(0, 12);

  return sorted.map((h) => {
    const value = valueOf(h);
    const pct = Math.round((value / a.totalValue) * 1000) / 10;
    const e = h.enrichment ?? {};
    const kind: HoldingIntelligence["kind"] = FUND_CLASSES.includes(h.assetClass)
      ? "fund"
      : h.assetClass === "equity_stock"
        ? "stock"
        : "other";

    const facts: { label: string; value: string }[] = [];
    if (kind === "fund") {
      facts.push({ label: "Category", value: e.fundCategory ?? ASSET_CLASS_LABEL[h.assetClass] });
      if (e.instrumentType) facts.push({ label: "Instrument", value: e.instrumentType });
      if (e.amc ?? e.fundHouse) facts.push({ label: "AMC", value: (e.amc ?? e.fundHouse) as string });
      facts.push({ label: "Expense ratio", value: e.expenseRatio != null ? `${round1(e.expenseRatio)}%` : "Not published" });
      if (e.riskCategory) facts.push({ label: "Risk level", value: e.riskCategory });
      if (e.benchmark) facts.push({ label: "Benchmark", value: e.benchmark });
      if (e.investmentStyle) facts.push({ label: "Style", value: e.investmentStyle });
      if (e.marketCapBias) facts.push({ label: "Cap bias", value: e.marketCapBias });
    } else if (kind === "stock") {
      facts.push({ label: "Sector", value: e.sector ?? "Not available" });
      if (e.industry) facts.push({ label: "Industry", value: e.industry });
      facts.push({ label: "Instrument", value: e.instrumentType ?? "Listed equity share" });
      facts.push({
        label: "Market cap",
        value: e.marketCap && e.marketCap !== "unknown" ? `${e.marketCap[0].toUpperCase()}${e.marketCap.slice(1)} cap` : "Not available",
      });
    } else {
      facts.push({ label: "Asset class", value: ASSET_CLASS_LABEL[h.assetClass] });
      if (e.instrumentType) facts.push({ label: "Instrument", value: e.instrumentType });
      if (e.sector) facts.push({ label: "Sector", value: e.sector });
    }
    facts.push({ label: "Share of portfolio", value: `${pct}%` });


    return {
      name: h.name,
      assetClass: h.assetClass,
      kind,
      pct,
      value,
      facts,
      objective: e.fundObjective ?? e.investmentPhilosophy ?? null,
      strengths: strengthsFor(h, kind, pct),
      risks: risksFor(h, kind, pct),
      suggestedRole: roleFor(h, kind, pct, a),
      aiSummary: null,
    };
  });
}

function strengthsFor(h: Holding, kind: HoldingIntelligence["kind"], pct: number): string[] {
  const out: string[] = [];
  const e = h.enrichment ?? {};
  if (h.assetClass === "index_fund" || h.assetClass === "etf") out.push("Low-cost, rules-based exposure with no manager risk.");
  if (kind === "fund" && e.fundCategory) out.push(`Professionally managed ${e.fundCategory.toLowerCase()} exposure.`);
  if (kind === "stock" && e.marketCap === "large") out.push("Large-cap businesses tend to survive full market cycles.");
  if (pct > 0 && pct <= 12) out.push("Position size is small enough that a single bad outcome will not derail the portfolio.");
  if (["debt_mf", "bond", "fd", "cash"].includes(h.assetClass)) out.push("Adds stability and gives you something to sell that is not equity.");
  if (["gold_etf", "sgb"].includes(h.assetClass)) out.push("Behaves differently from equity during macro stress.");
  return out.slice(0, 3);
}

function risksFor(h: Holding, kind: HoldingIntelligence["kind"], pct: number): string[] {
  const out: string[] = [];
  const e = h.enrichment ?? {};
  if (pct >= 25) out.push(`At ${pct}% of the portfolio, this single holding drives your overall result.`);
  else if (pct >= 15) out.push("Large enough that its bad years will be visible in your total portfolio.");
  if (e.marketCap === "small") out.push("Small-cap exposure can fall 50-70% in a bear market and stay down for years.");
  if (e.marketCap === "mid") out.push("Mid-caps are more volatile than the index and need a 5-7 year horizon.");
  if (kind === "stock") out.push("A single company carries business risk that no amount of holding period removes.");
  if (h.assetClass === "cash" && pct >= 15) out.push("Idle cash steadily loses purchasing power to inflation.");
  if (e.expenseRatio != null && e.expenseRatio >= 1.5) out.push("A high expense ratio compounds against you every single year.");
  return out.slice(0, 3);
}

function roleFor(h: Holding, kind: HoldingIntelligence["kind"], pct: number, a: IntelligenceInput): string {
  const e = h.enrichment ?? {};
  if (h.assetClass === "index_fund" || h.assetClass === "etf") return "Core holding — this should be the largest, most boring part of the portfolio.";
  if (e.marketCap === "large" || e.marketCapBias?.toLowerCase().includes("large")) return "Core holding — stability and compounding.";
  if (e.marketCap === "multi" || e.marketCapBias?.toLowerCase().includes("across")) return "Core holding — one fund covering the whole market.";
  if (e.marketCap === "small" || e.marketCap === "mid") return "Satellite holding — keep it a minority slice of equity, not the base.";
  if (["debt_mf", "bond", "fd"].includes(h.assetClass)) return "Stabiliser — funds near-term goals and cushions equity drawdowns.";
  if (["gold_etf", "sgb"].includes(h.assetClass)) return "Hedge — a 5-10% slice, not a growth engine.";
  if (h.assetClass === "cash") return "Liquidity buffer — useful up to your emergency-fund need, a drag beyond it.";
  if (kind === "stock") return pct >= 10 ? "Satellite — consider trimming toward a single-digit share." : "Satellite — a conviction position sized sensibly.";
  return a.equityPct < a.targetEquityPct ? "Supporting holding — growth exposure is what this portfolio is short of." : "Supporting holding.";
}

/* ─────────────────────────── PEER BENCHMARK ─────────────────────────── */

export function buildPeerBenchmark(a: IntelligenceInput): PeerBenchmark {
  const age = a.input.ageYears;
  const bandStart = Math.max(18, Math.floor(age / 5) * 5);
  const annual = Math.max(0, a.input.monthlyIncome * 12);
  const incomeBand =
    annual >= 5_000_000 ? "₹50L+" :
    annual >= 2_500_000 ? "₹25-50L" :
    annual >= 1_500_000 ? "₹15-25L" :
    annual >= 1_000_000 ? "₹10-15L" :
    annual >= 500_000 ? "₹5-10L" : "Under ₹5L";
  const risk = (a.input.riskProfile ?? "moderate").replace(/^./, (c) => c.toUpperCase());
  const stage = a.context.lifeStage.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  const typicalEquity = a.targetEquityPct;
  const typicalDebt = Math.max(5, Math.min(70, 100 - typicalEquity - 10));
  const typicalGold = 8;
  const typicalCash = 5;
  const typicalDiv = 70;
  const typicalConc = 15;
  const typicalCost = 0.9;

  const rated = a.holdings.filter((h) => h.enrichment?.expenseRatio != null);
  const blendedCost =
    rated.length > 0
      ? round1(
          rated.reduce((s, h) => s + (h.enrichment!.expenseRatio as number) * valueOf(h), 0) /
            Math.max(1, rated.reduce((s, h) => s + valueOf(h), 0)),
        )
      : a.indexShare >= 40 ? 0.6 : a.indexShare >= 20 ? 1.0 : 1.4;

  const row = (label: string, you: number, typical: number, unit: string, note: string): PeerBenchmarkRow => {
    const gap = you - typical;
    const tolerance = unit === "%" ? 8 : 10;
    const verdict =
      Math.abs(gap) <= tolerance
        ? "In line with peers"
        : gap > 0
          ? `Above typical range — ${note}`
          : `Below typical range — ${note}`;
    return { label, you: round1(you), typical: round1(typical), unit, verdict };
  };

  const rows: PeerBenchmarkRow[] = [
    row("Equity allocation", a.equityPct, typicalEquity, "%", "growth exposure differs from what your horizon usually calls for"),
    row("Debt allocation", a.debtPct, typicalDebt, "%", "the debt sleeve is what steadies the portfolio"),
    row("Gold allocation", a.goldPct, typicalGold, "%", "gold is the usual hedge against macro stress"),
    row("Cash allocation", a.cashPct, typicalCash, "%", "idle cash behaves differently from invested capital"),
    row("Diversification", a.diversificationScore, typicalDiv, "/100", "spread across asset classes"),
    row("Largest holding", a.topPct, typicalConc, "%", "concentration decides how bumpy the ride is"),
    row("Blended cost", blendedCost, typicalCost, "%", "cost is the one return input you fully control"),
  ];

  return {
    cohort: `Age ${bandStart}-${bandStart + 4} · ${incomeBand} income · ${risk} risk · ${stage}`,
    rows,
    note: "Peer values are modelled from NitiCore™ allocation norms for your cohort — an educational reference point, not a ranking. Being different from peers is not automatically worse; it only matters when it conflicts with your own horizon.",
  };

}

/* ─────────────────────────── INSIGHTS ─────────────────────────── */

export function buildInsights(a: IntelligenceInput): PortfolioInsight[] {
  const out: PortfolioInsight[] = [];
  if (a.totalValue <= 0) return out;

  const equityFunds = a.holdings.filter((h) => ["equity_mf", "index_fund"].includes(h.assetClass));
  const capOf = (h: Holding) => h.enrichment?.marketCap ?? "unknown";

  // Fund overlap / duplicate exposure
  const capGroups = new Map<string, Holding[]>();
  for (const h of equityFunds) {
    const key = String(capOf(h));
    capGroups.set(key, [...(capGroups.get(key) ?? []), h]);
  }
  for (const [cap, group] of capGroups) {
    if (cap === "unknown" || group.length < 3) continue;
    out.push({
      id: `overlap-${cap}`,
      severity: "gap",
      title: `${group.length} funds competing for the same ${cap}-cap space`,
      whyItMatters: "Funds in the same category buy from the same universe of stocks, so their underlying holdings overlap heavily. You end up owning the same companies through different wrappers.",
      impact: "You pay several expense ratios and track several NAVs for what is effectively one exposure, without any extra diversification.",
      action: `Keep one or two ${cap}-cap funds you believe in and redirect future contributions there instead of spreading them thinner.`,
    });
  }

  // Duplicate AMC exposure
  const amcCounts = new Map<string, number>();
  for (const h of a.holdings) {
    const amc = h.enrichment?.amc ?? h.enrichment?.fundHouse;
    if (amc) amcCounts.set(amc, (amcCounts.get(amc) ?? 0) + 1);
  }
  for (const [amc, count] of amcCounts) {
    if (count >= 4) {
      out.push({
        id: `amc-${amc}`,
        severity: "observation",
        title: `${count} schemes from ${amc}`,
        whyItMatters: "A single fund house tends to share research, house views and portfolio managers across its schemes.",
        impact: "Your outcomes become correlated with one investment process rather than several independent ones.",
        action: "Spread new investments across a second fund house to reduce process concentration.",
      });
      break;
    }
  }

  // Over-concentration
  if (a.topPct >= 25) {
    out.push({
      id: "over-concentration",
      severity: "risk",
      title: `${a.topName ?? "One holding"} controls ${a.topPct}% of the portfolio`,
      whyItMatters: "Beyond roughly a quarter of the portfolio, one holding stops being a position and becomes the portfolio.",
      impact: "A 40% fall in that one name would take the whole portfolio down about " + Math.round(a.topPct * 0.4) + "%, regardless of how well everything else performs.",
      action: "Trim gradually toward a 10-15% share, using new contributions elsewhere first so you avoid unnecessary capital-gains tax.",
    });
  }

  // Style drift
  const smallMid = equityFunds.filter((h) => ["small", "mid"].includes(String(capOf(h)))).reduce((s, h) => s + valueOf(h), 0);
  const equityValue = a.holdings.filter((h) => ["equity_mf", "index_fund", "equity_stock", "etf"].includes(h.assetClass)).reduce((s, h) => s + valueOf(h), 0);
  const smallMidPct = equityValue > 0 ? Math.round((smallMid / equityValue) * 100) : 0;
  if (smallMidPct >= 40 && (a.input.riskProfile ?? "moderate") !== "aggressive") {
    out.push({
      id: "style-drift",
      severity: "risk",
      title: `Small and mid caps are ${smallMidPct}% of your equity`,
      whyItMatters: `You describe yourself as a ${(a.input.riskProfile ?? "moderate")} investor, but the portfolio is positioned more aggressively than that.`,
      impact: "In a sharp correction this book can fall considerably harder than the index, which is exactly when most investors abandon their plan.",
      action: "Bring small and mid caps back toward a third of equity by directing new SIPs into large-cap or index funds.",
    });
  }

  // Missing asset classes
  const missing: string[] = [];
  if (a.debtPct < 5) missing.push("debt");
  if (a.goldPct < 3) missing.push("gold");
  if (missing.length > 0 && a.equityPct >= 60) {
    out.push({
      id: "missing-classes",
      severity: "gap",
      title: `No meaningful ${missing.join(" or ")} allocation`,
      whyItMatters: "Asset classes exist to behave differently from each other. A portfolio made of one behaviour has no internal shock absorber.",
      impact: "Every rupee moves together, so drawdowns are deeper and rebalancing opportunities never appear.",
      action: `Add a small ${missing[0]} sleeve through new contributions rather than by selling equity.`,
    });
  }

  // Sector concentration
  if (a.bySector.length > 0 && a.bySector[0].pct >= 35) {
    out.push({
      id: "sector-concentration",
      severity: "risk",
      title: `${a.bySector[0].label} is ${a.bySector[0].pct}% of identified holdings`,
      whyItMatters: "Sector cycles in India can last several years. Owning many names inside one sector is a single bet wearing a diversified costume.",
      impact: "A regulatory or cyclical shock to that sector hits most of the portfolio at once.",
      action: "Cap any single sector near a quarter of equity and use broad-market funds to fill the rest.",
    });
  }

  // Cost inefficiency
  const rated = a.holdings.filter((h) => h.enrichment?.expenseRatio != null);
  const blended =
    rated.length > 0
      ? rated.reduce((s, h) => s + (h.enrichment!.expenseRatio as number) * valueOf(h), 0) /
        Math.max(1, rated.reduce((s, h) => s + valueOf(h), 0))
      : null;
  if ((blended != null && blended >= 1.2) || (blended == null && a.indexShare < 15 && a.holdings.length >= 5)) {
    out.push({
      id: "cost-drag",
      severity: "gap",
      title: "Expense drag is higher than it needs to be",
      whyItMatters: "Cost is the only component of future return that is known in advance and entirely within your control.",
      impact: "Roughly 1% of extra annual cost can consume close to a fifth of the final corpus over a 20-year holding period.",
      action: "Move part of the core allocation into low-cost index funds and keep active funds for genuinely differentiated mandates.",
    });
  }

  // Rebalancing opportunity
  const drift = a.equityPct - a.targetEquityPct;
  if (Math.abs(drift) >= 10) {
    out.push({
      id: "rebalance",
      severity: "observation",
      title: drift > 0 ? "The portfolio has drifted risk-on" : "The portfolio has drifted risk-off",
      whyItMatters: "Rebalancing is the one mechanical discipline that forces you to sell what has run and buy what has lagged.",
      impact: `Left alone, the equity share is about ${Math.abs(Math.round(drift))} points away from the mix your horizon calls for.`,
      action: "Set one fixed review date a year and rebalance with fresh contributions first, selling only when contributions cannot close the gap.",
    });
  }

  // Complexity
  if (a.holdings.length >= 12) {
    out.push({
      id: "complexity",
      severity: "observation",
      title: `${a.holdings.length} holdings to monitor`,
      whyItMatters: "Beyond roughly eight well-chosen holdings, extra positions add admin rather than diversification.",
      impact: "Reviews get skipped, laggards go unnoticed, and the portfolio drifts by default rather than by decision.",
      action: "Consolidate the smallest positions into your highest-conviction core holdings over time.",
    });
  }

  return out;
}
