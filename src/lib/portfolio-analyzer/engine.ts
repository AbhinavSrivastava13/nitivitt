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
  const equityForCap = cleaned.filter((h) => bucketOf(h.assetClass) === "equity");
  const byMarketCap = groupBy<string>(
    equityForCap.map((h) => {
      const c: MarketCap = h.enrichment?.marketCap ?? "unknown";
      if (c === "unknown") return ["Diversified equity", valueOf(h)];
      if (c === "multi") return ["Flexi / Multi cap", valueOf(h)];
      return [`${c[0].toUpperCase()}${c.slice(1)} cap`, valueOf(h)];
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

  // ─────────────── V2: Snapshot, risk meter, goal alignment, intelligence, executive summary ───────────────
  const mfShare = pct(
    cleaned.filter((h) => ["equity_mf", "index_fund", "debt_mf", "hybrid_mf"].includes(h.assetClass)).reduce((a, h) => a + valueOf(h), 0),
    totalValue,
  );
  const indexShare = pct(
    cleaned.filter((h) => h.assetClass === "index_fund" || h.assetClass === "etf").reduce((a, h) => a + valueOf(h), 0),
    totalValue,
  );

  let styleParts: string[] = [];
  if (mfShare >= 60) styleParts.push("Mutual-fund led");
  else if (stockPct >= 50) styleParts.push("Direct-equity led");
  else if (equityHoldings.length > 0) styleParts.push("Mixed equity");
  else styleParts.push("Non-equity portfolio");
  if (indexShare >= 40) styleParts.push("Index / passive tilt");
  const midCapSlice = capBuckets.find((c) => c.label === "mid")?.pct ?? 0;
  const largeCapSlice = capBuckets.find((c) => c.label === "large")?.pct ?? 0;
  const multiCapSlice = capBuckets.find((c) => c.label === "multi")?.pct ?? 0;
  if (multiCapSlice >= 40) styleParts.push("Multi-cap tilt");
  else if (largeCapSlice >= 55) styleParts.push("Large-cap heavy");
  else if (midCapSlice + smallCapSlice >= 55) styleParts.push("Growth-cap tilt");

  const diversificationBand =
    diversificationScore >= 75 ? "Well diversified"
      : diversificationScore >= 55 ? "Reasonably diversified"
        : diversificationScore >= 35 ? "Moderately concentrated"
          : "Concentrated";

  const riskLevel: import("./types").RiskLevel =
    equityPct >= 85 ? "aggressive"
      : equityPct >= 65 ? "growth"
        : equityPct >= 40 ? "balanced"
          : "conservative";
  const riskLevelLabel =
    riskLevel === "aggressive" ? "Aggressive"
      : riskLevel === "growth" ? "Growth-oriented"
        : riskLevel === "balanced" ? "Balanced"
          : "Conservative";

  const behaviourBits: string[] = [];
  if (input.monthlyInvestments > 0 && input.monthlyIncome > 0) {
    const sipPct = Math.round((input.monthlyInvestments * 100) / Math.max(1, input.monthlyIncome));
    if (sipPct >= 25) behaviourBits.push("Aggressive SIP investor");
    else if (sipPct >= 15) behaviourBits.push("Disciplined SIP investor");
    else if (sipPct > 0) behaviourBits.push("Emerging SIP habit");
  }
  if (indexShare >= 30) behaviourBits.push("Prefers low-cost passive vehicles");
  if (stockPct >= 40) behaviourBits.push("Comfortable with direct-stock risk");
  if (goldPct >= 5) behaviourBits.push("Uses gold as a hedge");
  const investmentBehaviour = behaviourBits.length ? behaviourBits.join(" · ") : "Portfolio building in progress";

  const snapshot: import("./types").PortfolioSnapshot = {
    valueLabel: inr(totalValue),
    holdingsLabel: `${cleaned.length} holding${cleaned.length === 1 ? "" : "s"}`,
    style: styleParts.join(" · "),
    diversificationBand,
    riskLevel,
    riskLevelLabel,
    largestHolding: topHolding?.name ?? "—",
    largestHoldingPct: topPct,
    investmentBehaviour,
  };

  const drift = Math.round(equityPct - targetEquityClamped);
  const riskMeter: import("./types").RiskMeter = {
    level: riskLevel,
    label: riskLevelLabel,
    equityPct,
    targetEquityPct: targetEquityClamped,
    drift,
  };

  let goalAlignment: import("./types").GoalAlignment;
  if (totalValue === 0) {
    goalAlignment = { status: "insufficient_data", label: "Not enough data", note: "Add holdings to assess alignment with your long-term goals." };
  } else if (Math.abs(drift) <= 8) {
    goalAlignment = { status: "aligned", label: "Aligned with your horizon", note: "Your equity mix sits close to what fits your age, risk profile, and life stage." };
  } else if (drift < 0) {
    goalAlignment = { status: "under_allocated", label: "Under-allocated to growth", note: "You are under-invested in equity for your horizon. Compounding is being left on the table." };
  } else {
    goalAlignment = { status: "over_allocated", label: "Above your growth target", note: "Equity exposure sits above the level typically appropriate for your horizon. Volatility could hurt near-term goals." };
  }

  // Positive intelligence — celebrate genuine strengths.
  const positives: PortfolioFinding[] = [...strengths];
  if (mfShare >= 60 && cleaned.length >= 4) {
    positives.push({
      id: "quality-vehicles",
      severity: "strength",
      title: "Portfolio built through structured vehicles",
      detail: "Most of your money is deployed through mutual funds rather than ad-hoc stock picks — a durable base to build on.",
    });
  }
  if (indexShare >= 25) {
    positives.push({
      id: "low-cost-tilt",
      severity: "strength",
      title: "Meaningful low-cost / passive allocation",
      detail: "Index and ETF exposure reduces long-term drag from fund expenses and manager risk.",
    });
  }
  if (diversificationScore >= 70) {
    positives.push({
      id: "healthy-diversification",
      severity: "strength",
      title: "Diversification is doing its job",
      detail: "Value is spread across asset classes such that no single bucket dominates the outcome.",
    });
  }
  if (goldPct >= 5 && goldPct <= 15) {
    positives.push({
      id: "gold-hedge",
      severity: "strength",
      title: "Sensible gold allocation",
      detail: "A 5-15% gold slice historically cushions equity drawdowns during macro stress.",
    });
  }
  if (emergencyOk) {
    positives.push({
      id: "liquidity-foundation",
      severity: "strength",
      title: "Emergency fund is in place",
      detail: "Your investments can compound without doubling as a rainy-day safety net.",
    });
  }

  // Educational insights — neither strength nor a hard risk, but worth understanding.
  const insights: PortfolioFinding[] = [...observations];
  insights.push({
    id: "asset-class-hierarchy",
    severity: "observation",
    title: `${styleParts.join(" · ")}`,
    detail: `Your current mix reads as ${equityPct}% equity, ${debtPct}% debt and ${goldPct}% gold — the shape of the portfolio your risk and horizon are being built on.`,
  });
  if (cleaned.length >= 12 && mfShare >= 40) {
    insights.push({
      id: "fund-overlap-note",
      severity: "observation",
      title: `${cleaned.length} holdings across the portfolio`,
      detail: "Beyond about 6-8 well-chosen funds, extra schemes usually add tracking effort without meaningfully improving diversification.",
    });
  }

  const intelligence: import("./types").PortfolioIntelligence = { positives, insights };

  // Executive summary — deterministic, personalised, CFP-style opener.
  let executiveSummary: string;
  if (totalValue === 0) {
    executiveSummary = "There is not enough portfolio data yet to draw meaningful conclusions. Add your holdings so NitiInvest™ can evaluate structure, risk and alignment.";
  } else if (!emergencyOk) {
    executiveSummary = "Your portfolio has real building blocks, but the bigger lever right now sits outside investments — a fuller emergency cushion would let this money compound without being pulled prematurely.";
  } else if (!protectionOk && context.hasDependents) {
    executiveSummary = "Your investments are moving in a healthy direction. The biggest risk to this portfolio today is not the market — it is the protection gap for your dependents, which could force premature liquidation.";
  } else if (topPct >= 25) {
    executiveSummary = `The portfolio is fundamentally sound, but a single holding accounts for a disproportionate share of it — the biggest opportunity is reducing concentration rather than changing fund selection.`;
  } else if (drift <= -12) {
    executiveSummary = "Your investments are diversified, but the equity allocation is meaningfully below what fits your life stage. The biggest lever here is asset allocation, not which fund you pick next.";
  } else if (drift >= 12) {
    executiveSummary = "Your portfolio leans aggressive for the goal horizon. Fund selection looks reasonable — the priority is measured rebalancing so market swings do not derail near-term goals.";
  } else if (diversificationScore >= 70 && Math.abs(drift) <= 8) {
    executiveSummary = "This is a well-built portfolio for your stage of life. The priority now is discipline and periodic review — not restructuring.";
  } else {
    executiveSummary = "The foundations of your portfolio are in place. A few structural refinements, rather than wholesale changes, will compound meaningfully over time.";
  }

  // ─────────────── V3: Hero, allocation comparison, similar-investor comparison ───────────────
  const targetDebt = Math.max(5, Math.min(70, 100 - targetEquityClamped - 10));
  const targetGold = 10;
  const allocationComparison: import("./types").AllocationComparisonRow[] = totalValue > 0 ? [
    { label: "Equity", you: equityPct, recommended: targetEquityClamped },
    { label: "Debt", you: debtPct, recommended: targetDebt },
    { label: "Gold", you: goldPct, recommended: targetGold },
  ] : [];

  const lifeStageLabel = {
    early_career: "Early career (18-29)",
    family_building: "Family building (30-44)",
    peak_earning: "Peak earning (45-54)",
    pre_retirement: "Pre-retirement (55-64)",
    retirement: "Retirement (65+)",
  }[context.lifeStage];
  const riskProfileLabel = (input.riskProfile ?? "moderate").replace(/^./, (c) => c.toUpperCase());
  const ageBandStart = Math.max(18, Math.floor(input.ageYears / 5) * 5);
  const ageBand = `${ageBandStart}-${ageBandStart + 4}`;
  const typicalEquity = targetEquityClamped;
  const typicalDebt = targetDebt;
  const typicalDiversification = 70;
  const typicalConcentration = 12;
  const similarInvestor: import("./types").SimilarInvestor = {
    ageBand,
    riskProfile: riskProfileLabel,
    lifeStage: lifeStageLabel,
    metrics: [
      { label: "Equity allocation", you: `${equityPct}%`, typical: `${typicalEquity}%` },
      { label: "Debt allocation", you: `${debtPct}%`, typical: `${typicalDebt}%` },
      { label: "Diversification score", you: `${diversificationScore}/100`, typical: `${typicalDiversification}/100` },
      { label: "Largest holding share", you: `${topPct}%`, typical: `≤ ${typicalConcentration}%` },
    ],
  };

  // Hero — verdict + three CFP-style headline insights.
  const heroInsights: string[] = [];
  if (mfShare >= 60 && cleaned.length >= 3) heroInsights.push("Your fund selection looks reasonable — the story here is structure, not picks.");
  else if (stockPct >= 40) heroInsights.push("You are comfortable running a direct-equity book, which increases the importance of position sizing.");
  if (topPct >= 25) heroInsights.push(`A single holding (${topHolding?.name}) drives a large share of the outcome.`);
  else if (topPct >= 15) heroInsights.push("Concentration is moderate — the largest position still moves the portfolio meaningfully.");
  else if (topPct > 0) heroInsights.push("No single holding dominates the portfolio.");
  if (Math.abs(drift) <= 8 && totalValue > 0) heroInsights.push("Equity mix is well-aligned with your life stage and risk profile.");
  else if (drift < -8) heroInsights.push("Equity share is below what typically fits your horizon — compounding is being left on the table.");
  else if (drift > 8) heroInsights.push("Equity share sits above your horizon-appropriate target — market swings will hurt more.");
  if (!emergencyOk) heroInsights.push("The biggest lever is outside investments today — the emergency cushion needs to catch up.");
  else if (!protectionOk && context.hasDependents) heroInsights.push("Protection gaps could force you to liquidate this portfolio at the worst time.");
  else if (diversificationScore >= 70) heroInsights.push("Diversification is doing its job across asset classes.");
  const keyInsights = heroInsights.slice(0, 3);

  let verdict: string;
  if (totalValue === 0) verdict = "Not enough portfolio data yet.";
  else if (portfolioScore >= 80) verdict = "You have built a well-structured portfolio.";
  else if (portfolioScore >= 65 && mfShare >= 60) verdict = "Your fund selection is good — the next step is improving portfolio construction.";
  else if (portfolioScore >= 65) verdict = "Solid foundation — a few structural refinements will compound over time.";
  else if (topPct >= 25) verdict = "The portfolio is working, but concentration is the single biggest lever to fix.";
  else if (Math.abs(drift) >= 12) verdict = "Fund choices look reasonable — the priority is asset allocation, not what to buy next.";
  else verdict = "The building blocks are here — the biggest lever is structure, not more holdings.";

  const hero: import("./types").PortfolioHero = { verdict, keyInsights };

  // ─────────────── Portfolio Quality — holistic quality read ───────────────
  const portfolioQuality: import("./types").PortfolioQualityFinding[] = [];
  if (totalValue > 0) {
    // Fund selection quality
    if (mfShare >= 60 && cleaned.length >= 3) {
      portfolioQuality.push({
        id: "pq-structured",
        tone: "positive",
        title: "Good quality fund selection",
        detail: "Most of your capital is deployed through structured vehicles rather than opportunistic bets — a durable foundation.",
      });
    }
    if (indexShare >= 25) {
      portfolioQuality.push({
        id: "pq-low-cost",
        tone: "positive",
        title: "Low-cost investing approach",
        detail: `~${indexShare}% of the portfolio sits in index or ETF vehicles, keeping long-term expense drag low.`,
      });
    }
    if (diversificationScore >= 70 && Math.abs(drift) <= 10) {
      portfolioQuality.push({
        id: "pq-diversified",
        tone: "positive",
        title: "Appropriate diversification",
        detail: "Capital is spread across asset classes in a way that fits your horizon — no single bucket dominates the outcome.",
      });
    }
    // Watch signals
    const thematicClasses: AssetClass[] = ["equity_stock"];
    const thematicShare = pct(
      cleaned.filter((h) => thematicClasses.includes(h.assetClass)).reduce((a, h) => a + valueOf(h), 0),
      totalValue,
    );
    if (stockPct >= 40 && cleaned.filter((h) => h.assetClass === "equity_stock").length <= 5) {
      portfolioQuality.push({
        id: "pq-thematic",
        tone: "watch",
        title: "Concentrated thematic exposure",
        detail: `Direct stocks are ${thematicShare}% of the portfolio across a small number of names — outcomes swing on a handful of decisions.`,
      });
    }
    if (cash > 0 && pct(cash, totalValue) >= 20) {
      portfolioQuality.push({
        id: "pq-cash",
        tone: "watch",
        title: "Excess cash drag",
        detail: `${pct(cash, totalValue)}% sits in cash / liquid. Beyond a 3-6 month buffer, idle cash loses to inflation.`,
      });
    }
    const mfCount = cleaned.filter((h) => ["equity_mf","index_fund","hybrid_mf","debt_mf"].includes(h.assetClass)).length;
    if (mfCount >= 10) {
      portfolioQuality.push({
        id: "pq-overlap",
        tone: "watch",
        title: "Too many overlapping funds",
        detail: `${mfCount} funds usually overlap heavily. 5-8 well-chosen schemes typically cover the same ground with less tracking effort.`,
      });
    }
    if (cleaned.length >= 15) {
      portfolioQuality.push({
        id: "pq-complexity",
        tone: "watch",
        title: "Portfolio complexity",
        detail: `${cleaned.length} holdings is more than most investors can meaningfully monitor. Consolidation would reduce noise without reducing diversification.`,
      });
    }
    // Neutral — always add a structural read
    portfolioQuality.push({
      id: "pq-shape",
      tone: "neutral",
      title: `${equityPct}% equity · ${debtPct}% debt · ${goldPct}% gold`,
      detail: `The overall asset shape suits a ${riskLevelLabel.toLowerCase()} investor at your life stage.`,
    });
  }

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
    executiveSummary,
    snapshot,
    riskMeter,
    goalAlignment,
    intelligence,
    hero,
    allocationComparison,
    similarInvestor,
    portfolioQuality,
  };
}



export { inr as formatInr };
export const NITI_CORE_CONFIG_REF = NITI_CORE_CONFIG; // keep import used in case of future tuning
