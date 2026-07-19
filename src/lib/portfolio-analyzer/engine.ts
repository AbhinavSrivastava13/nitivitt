/**
 * NitiInvest™ — deterministic Portfolio Intelligence engine.
 *
 * Zero AI. Same input → same output. Uses NitiCore™ FinancialContext to
 * ground recommendations in the user's whole financial life (dependents,
 * emergency fund, insurance posture, debt, life stage), not the portfolio
 * in isolation.
 */
import { NITI_CORE_CONFIG } from "@/lib/niti-core";
import type { FinancialContext, NitiCoreInput } from "@/lib/niti-core";
import {
  ASSET_CLASS_LABEL,
  type AllocationSlice,
  type AssetClass,
  type Holding,
  type MarketCap,
  type PortfolioFinding,
  type PortfolioRecommendation,
  type PortfolioReport,
} from "./types";

interface EngineInput {
  holdings: Holding[];
  input: NitiCoreInput;
  context: FinancialContext;
}

const EQUITY_CLASSES: AssetClass[] = ["equity_stock", "equity_mf", "index_fund"];
const DEBT_CLASSES: AssetClass[] = ["debt_mf", "bond", "fd", "cash"];
const GOLD_CLASSES: AssetClass[] = ["gold_etf", "sgb"];

function scoreLabel(score: number): string {
  if (score >= 85) return "Well-balanced portfolio";
  if (score >= 70) return "Solid, minor rebalance opportunities";
  if (score >= 50) return "Working but structurally imbalanced";
  if (score >= 30) return "Significant concentration or gaps";
  return "High-risk composition — needs rework";
}

function inr(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "₹0";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function valueOf(h: Holding): number {
  if (h.currentValue != null) return Number(h.currentValue) || 0;
  if (h.units != null && h.currentPrice != null) return Number(h.units) * Number(h.currentPrice);
  return 0;
}

function bucketOf(a: AssetClass): "equity" | "debt" | "gold" | "alt" | "cash" {
  if (EQUITY_CLASSES.includes(a) || a === "etf") return "equity";
  if (DEBT_CLASSES.includes(a)) return a === "cash" ? "cash" : "debt";
  if (GOLD_CLASSES.includes(a)) return "gold";
  return "alt";
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function groupBy<T extends string>(entries: [T, number][]): AllocationSlice[] {
  const map = new Map<T, number>();
  for (const [k, v] of entries) map.set(k, (map.get(k) ?? 0) + v);
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value, pct: pct(value, total) }))
    .sort((a, b) => b.value - a.value);
}

export function analyzePortfolio({ holdings, input, context }: EngineInput): PortfolioReport {
  const cleaned = holdings.filter((h) => h.name.trim().length > 0);
  const totalValue = cleaned.reduce((a, h) => a + valueOf(h), 0);
  const strengths: PortfolioFinding[] = [];
  const gaps: PortfolioFinding[] = [];
  const observations: PortfolioFinding[] = [];
  const recommendations: PortfolioRecommendation[] = [];

  const byAssetClass = groupBy<string>(
    cleaned.map((h) => [ASSET_CLASS_LABEL[h.assetClass], valueOf(h)]),
  );
  const byMarketCap = groupBy<string>(
    cleaned.map((h) => {
      const c: MarketCap = h.enrichment?.marketCap ?? "unknown";
      return [c === "unknown" ? "Unknown / N/A" : `${c[0].toUpperCase()}${c.slice(1)} cap`, valueOf(h)];
    }),
  );
  const bySector = groupBy<string>(
    cleaned
      .filter((h) => h.enrichment?.sector)
      .map((h) => [h.enrichment!.sector as string, valueOf(h)]),
  );

  // Bucket totals
  const equity = cleaned.filter((h) => bucketOf(h.assetClass) === "equity").reduce((a, h) => a + valueOf(h), 0);
  const debt = cleaned.filter((h) => bucketOf(h.assetClass) === "debt").reduce((a, h) => a + valueOf(h), 0);
  const gold = cleaned.filter((h) => bucketOf(h.assetClass) === "gold").reduce((a, h) => a + valueOf(h), 0);
  const cash = cleaned.filter((h) => bucketOf(h.assetClass) === "cash").reduce((a, h) => a + valueOf(h), 0);

  const equityPct = pct(equity, totalValue);
  const debtPct = pct(debt, totalValue);
  const goldPct = pct(gold, totalValue);

  // Target equity per NitiCore asset allocation heuristic
  const targetEquity = Math.max(20, Math.min(90, 100 - input.ageYears)) +
    (input.riskProfile === "aggressive" ? 10 : input.riskProfile === "conservative" ? -10 : 0);
  const targetEquityClamped = Math.max(10, Math.min(95, targetEquity));

  // 1. Asset allocation drift
  if (totalValue > 0) {
    const drift = Math.abs(equityPct - targetEquityClamped);
    if (drift <= 8) {
      strengths.push({
        id: "allocation-aligned",
        severity: "strength",
        title: `Equity mix (${equityPct}%) sits close to NitiCore's target of ${targetEquityClamped}%`,
        detail: `For your age (${input.ageYears}) and risk profile, the recommended equity share is ~${targetEquityClamped}%. You're within ${drift.toFixed(0)}% of that band.`,
      });
    } else if (equityPct > targetEquityClamped + 8) {
      gaps.push({
        id: "over-equity",
        severity: "risk",
        title: `Equity allocation is ${equityPct}% — above the ${targetEquityClamped}% target`,
        detail: `Higher equity magnifies drawdowns near goal dates. Consider rebalancing ${Math.round(equity - (totalValue * targetEquityClamped) / 100).toLocaleString("en-IN")} into debt / hybrid vehicles.`,
      });
      recommendations.push({
        id: "rebalance-equity-down",
        title: `Rebalance ~${(equityPct - targetEquityClamped).toFixed(0)}% from equity into debt`,
        priority: "medium",
        reason: `Your current equity exposure exceeds NitiCore's age- and risk-adjusted target by ${(equityPct - targetEquityClamped).toFixed(0)}%.`,
        expectedBenefit: "Reduces sequence-of-return risk near medium-term goals; smoother portfolio path.",
        tradeOffs: ["Lower expected long-term return.", "Potential capital-gains tax on rebalancing."],
      });
    } else {
      gaps.push({
        id: "under-equity",
        severity: "gap",
        title: `Equity allocation is ${equityPct}% — below the ${targetEquityClamped}% target`,
        detail: `A lower equity share slows long-term compounding. Consider redirecting new investments to equity mutual funds or index funds.`,
      });
      recommendations.push({
        id: "rebalance-equity-up",
        title: `Grow equity share to ~${targetEquityClamped}%`,
        priority: "medium",
        reason: "Under-allocation to equity for your horizon slows compounding.",
        expectedBenefit: "Higher expected real return over 10+ years.",
        tradeOffs: ["Higher interim volatility.", "Requires discipline during drawdowns."],
      });
    }
  }

  // 2. Concentration risk — top holding share
  const topSorted = [...cleaned].sort((a, b) => valueOf(b) - valueOf(a));
  const topHolding = topSorted[0];
  const topPct = topHolding ? pct(valueOf(topHolding), totalValue) : 0;
  const top5Pct = topSorted.slice(0, 5).reduce((a, h) => a + valueOf(h), 0);
  const top5Share = pct(top5Pct, totalValue);

  if (topPct >= 25) {
    gaps.push({
      id: "single-name-concentration",
      severity: "risk",
      title: `${topHolding!.name} is ${topPct}% of the portfolio`,
      detail: "A single holding above 25% ties your outcomes to one entity's fortunes. Diversification math starts to break down.",
    });
    recommendations.push({
      id: "trim-top-holding",
      title: `Trim ${topHolding!.name} toward a 10-15% share`,
      priority: "high",
      reason: `Concentration risk: one holding = ${topPct}% of total value.`,
      expectedBenefit: "Reduces idiosyncratic risk; a bad year for one name won't devastate the portfolio.",
      tradeOffs: ["Capital-gains tax on exit.", "May miss further upside if the holding continues to outperform."],
    });
  }
  if (top5Share >= 75 && cleaned.length > 5) {
    observations.push({
      id: "top5-concentration",
      severity: "observation",
      title: `Top 5 holdings = ${top5Share}% of portfolio`,
      detail: "The tail contributes little. Either consolidate the tail into higher-conviction positions or diversify further.",
    });
  }

  // 3. Market-cap balance (equity slice only)
  const equityHoldings = cleaned.filter((h) => bucketOf(h.assetClass) === "equity");
  const capBuckets = groupBy<MarketCap>(
    equityHoldings.map((h) => [(h.enrichment?.marketCap ?? "unknown") as MarketCap, valueOf(h)]),
  );
  const smallCapSlice = capBuckets.find((c) => c.label === "small")?.pct ?? 0;
  if (smallCapSlice > 35) {
    gaps.push({
      id: "smallcap-heavy",
      severity: "gap",
      title: `Small-cap share of equity is ${smallCapSlice}%`,
      detail: "Small-caps can drawdown 50-70% in bear markets. A share above 30-35% adds volatility that most retail investors underestimate.",
    });
  }

  // 4. Sector concentration
  if (bySector.length > 0) {
    const topSector = bySector[0];
    if (topSector.pct >= 40) {
      gaps.push({
        id: "sector-concentration",
        severity: "risk",
        title: `${topSector.label} = ${topSector.pct}% of tracked holdings`,
        detail: "Single-sector exposure above 40% behaves like a bet rather than a diversified investment.",
      });
    }
  }

  // 5. Gold / debt hygiene
  if (totalValue > 0 && goldPct < 5 && equityPct >= 60) {
    observations.push({
      id: "no-gold",
      severity: "observation",
      title: "No meaningful gold allocation",
      detail: "5-10% in gold (SGB or gold ETF) historically dampens equity drawdowns during macro stress.",
    });
  }
  if (totalValue > 0 && debtPct < 10 && input.ageYears >= 40) {
    observations.push({
      id: "low-debt",
      severity: "observation",
      title: `Debt allocation is only ${debtPct}%`,
      detail: "Debt smooths returns as goal dates approach. Below 10% is thin for someone above 40.",
    });
  }

  // 6. Diversification (Herfindahl-ish across asset classes)
  const acShares = byAssetClass.map((a) => a.pct / 100);
  const hhi = acShares.reduce((s, x) => s + x * x, 0); // 0..1, lower is better
  const diversificationScore = Math.max(0, Math.round((1 - hhi) * 100));
  const concentrationScore = Math.round(hhi * 100);

  // 7. Cross-pillar context — respect the financial hierarchy
  const emergencyOk = context.liquidityHealth === "adequate" || context.liquidityHealth === "excess";
  const protectionOk = context.protectionPosture === "protected";
  const debtHeavy = context.flags.includes("debt_overload") || context.flags.includes("debt_elevated");

  if (!emergencyOk) {
    gaps.push({
      id: "no-emergency-fund",
      severity: "risk",
      title: "Emergency fund is below NitiCore's floor",
      detail: "Portfolio quality is secondary until 6 months of essentials sit in a liquid fund. A market drawdown could otherwise force you to sell equity at a loss.",
    });
    recommendations.push({
      id: "prioritise-emergency-fund",
      title: "Build the emergency fund before adding more equity SIPs",
      priority: "high",
      reason: "NitiCore's hierarchy: Emergency > Insurance > Debt > Investments.",
      expectedBenefit: "Prevents forced equity sales at market lows.",
      tradeOffs: ["Slower near-term investment growth."],
      crossPillarNote: "This is a Financial Health priority, not a portfolio one.",
    });
  }
  if (!protectionOk && context.hasDependents) {
    gaps.push({
      id: "insurance-before-investing",
      severity: "risk",
      title: "Term / health cover is inadequate for your dependents",
      detail: "Without adequate protection, a single event forces your family to liquidate this very portfolio at a loss.",
    });
    recommendations.push({
      id: "close-term-gap",
      title: "Close the protection gap before growing equity risk",
      priority: "high",
      reason: "Protection sits above investment in NitiCore's hierarchy.",
      expectedBenefit: "Portfolio can compound without doubling as your family's safety net.",
      tradeOffs: ["Additional annual premium."],
      crossPillarNote: "Insurance Analyzer will size the exact top-up.",
    });
  }
  if (debtHeavy) {
    observations.push({
      id: "debt-vs-invest",
      severity: "observation",
      title: `EMI-to-income ratio is ${context.debtRatioPct}%`,
      detail: "Post-tax loan rates above ~9% often beat expected equity SIP returns. Consider partial pre-payment before adding new investments.",
    });
  }

  // 8. Retirement / goal alignment
  if (input.monthlyInvestments > 0 && totalValue > 0) {
    const monthlyInvestPct = Math.round((input.monthlyInvestments * 12 * 100) / Math.max(1, input.monthlyIncome * 12));
    if (monthlyInvestPct >= 20) {
      strengths.push({
        id: "sip-discipline",
        severity: "strength",
        title: `Investing ${monthlyInvestPct}% of income monthly`,
        detail: "Consistent SIP behaviour is the single biggest driver of long-term wealth. Keep automating it.",
      });
    }
  }

  // 9. Behaviour flags — direct equity vs mutual-fund heavy
  const stockPct = pct(cleaned.filter((h) => h.assetClass === "equity_stock").reduce((a, h) => a + valueOf(h), 0), totalValue);
  if (stockPct >= 50 && cleaned.filter((h) => h.assetClass === "equity_stock").length >= 10) {
    observations.push({
      id: "diy-stock-portfolio",
      severity: "observation",
      title: `Direct stocks = ${stockPct}% of portfolio across many names`,
      detail: "Actively managing a broad stock portfolio consistently beats a low-cost index fund only for a small minority. Compare your 3-year XIRR against a simple Nifty index fund honestly.",
    });
  }

  // Portfolio Score — weighted composite
  const allocationScore = totalValue > 0 ? 100 - Math.min(50, Math.abs(equityPct - targetEquityClamped) * 2) : 50;
  const concentrationSubscore = 100 - Math.min(70, topPct * 2);
  const contextPenalty =
    (!emergencyOk ? 15 : 0) +
    (!protectionOk && context.hasDependents ? 10 : 0) +
    (debtHeavy ? 8 : 0);
  const rawScore =
    diversificationScore * 0.30 +
    allocationScore * 0.30 +
    concentrationSubscore * 0.25 +
    (equityHoldings.length > 0 ? 100 - Math.min(80, smallCapSlice) : 100) * 0.15;
  const portfolioScore = Math.max(0, Math.min(100, Math.round(rawScore - contextPenalty)));

  return {
    portfolioScore,
    scoreLabel: scoreLabel(portfolioScore),
    totalValue,
    holdingCount: cleaned.length,
    allocation: { byAssetClass, byMarketCap, bySector },
    diversificationScore,
    concentrationScore,
    topHoldings: topSorted.slice(0, 5).map((h) => ({
      name: h.name,
      pct: pct(valueOf(h), totalValue),
      assetClass: h.assetClass,
    })),
    strengths,
    gaps,
    observations,
    recommendations,
    contextSummary: `${context.lifeStage} · ${context.protectionPosture} · ${context.liquidityHealth} · equity target ${targetEquityClamped}% (age ${input.ageYears}, risk ${input.riskProfile ?? "moderate"})`,
  };
}

export { inr as formatInr };
export const NITI_CORE_CONFIG_REF = NITI_CORE_CONFIG; // keep import used in case of future tuning
