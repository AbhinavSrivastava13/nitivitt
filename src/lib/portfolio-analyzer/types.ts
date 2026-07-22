/**
 * NitiInvest™ — Portfolio Analyzer V1 types.
 *
 * Extraction never invents values. Deterministic analysis lives in engine.ts.
 * Market enrichment lives behind the MarketDataProvider interface.
 */

export type AssetClass =
  | "equity_stock"
  | "equity_mf"
  | "index_fund"
  | "etf"
  | "debt_mf"
  | "hybrid_mf"
  | "gold_etf"
  | "sgb"
  | "reit"
  | "invit"
  | "bond"
  | "fd"
  | "cash"
  | "other";

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity_stock: "Equity Stock",
  equity_mf: "Equity Mutual Fund",
  index_fund: "Index Fund",
  etf: "ETF",
  debt_mf: "Debt Mutual Fund",
  hybrid_mf: "Hybrid Mutual Fund",
  gold_etf: "Gold ETF",
  sgb: "Sovereign Gold Bond",
  reit: "REIT",
  invit: "InvIT",
  bond: "Bond",
  fd: "Fixed Deposit",
  cash: "Cash / Liquid",
  other: "Other",
};

export type MarketCap = "large" | "mid" | "small" | "multi" | "unknown";

export interface Holding {
  /** User-visible name as it appears on the broker screenshot. */
  name: string;
  assetClass: AssetClass;
  /** ISIN / scheme code / ticker if visible — helps enrichment. */
  identifier: string | null;
  units: number | null;
  averageCost: number | null;
  currentPrice: number | null;
  /** Current market value in INR. If null, engine derives units × price. */
  currentValue: number | null;
  /** Optional gain% straight from the screenshot. */
  pnlPct: number | null;
  /** Free-form platform tag: groww / zerodha / indmoney / … */
  platform: string | null;
  /** Enriched market data — engine + market provider may populate. */
  enrichment?: HoldingEnrichment;
  lowConfidenceFields?: string[];
}

export interface HoldingEnrichment {
  sector?: string | null;
  industry?: string | null;
  marketCap?: MarketCap;
  fundCategory?: string | null;
  fundHouse?: string | null;
  investmentStyle?: string | null;
  benchmark?: string | null;
  riskCategory?: string | null;
  investmentPhilosophy?: string | null;
  description?: string | null;
  expenseRatio?: number | null;
  oneYearReturnPct?: number | null;
  threeYearReturnPct?: number | null;
  fiveYearReturnPct?: number | null;
  peerContext?: string | null;
  source?: string; // "mfapi" | "yahoo" | "gemini" | …
}


export function emptyHolding(): Holding {
  return {
    name: "",
    assetClass: "equity_mf",
    identifier: null,
    units: null,
    averageCost: null,
    currentPrice: null,
    currentValue: null,
    pnlPct: null,
    platform: null,
    lowConfidenceFields: [],
  };
}

export type FindingSeverity = "strength" | "observation" | "gap" | "risk";
export interface PortfolioFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface PortfolioRecommendation {
  id: string;
  title: string;
  priority: RecommendationPriority;
  reason: string;
  expectedBenefit: string;
  tradeOffs: string[];
  opportunityCost?: string;
  crossPillarNote?: string;
}

export interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}

export type RiskLevel = "conservative" | "balanced" | "growth" | "aggressive";

export interface PortfolioSnapshot {
  valueLabel: string;
  holdingsLabel: string;
  style: string;               // e.g. "Mutual-fund led · Multi-cap tilt"
  diversificationBand: string; // e.g. "Well diversified"
  riskLevel: RiskLevel;
  riskLevelLabel: string;
  largestHolding: string;
  largestHoldingPct: number;
  investmentBehaviour: string; // e.g. "Disciplined SIP investor"
}

export interface RiskMeter {
  level: RiskLevel;
  label: string;
  equityPct: number;
  targetEquityPct: number;
  drift: number; // + over, - under
}

export interface GoalAlignment {
  status: "aligned" | "under_allocated" | "over_allocated" | "insufficient_data";
  label: string;
  note: string;
}

export interface PortfolioIntelligence {
  positives: PortfolioFinding[];
  insights: PortfolioFinding[];
}

export interface PortfolioReport {
  portfolioScore: number; // 0-100 deterministic
  scoreLabel: string;
  totalValue: number;
  holdingCount: number;
  allocation: {
    byAssetClass: AllocationSlice[];
    byMarketCap: AllocationSlice[];
    bySector: AllocationSlice[];
  };
  diversificationScore: number;
  concentrationScore: number; // higher = more concentrated (bad)
  topHoldings: { name: string; pct: number; assetClass: AssetClass }[];
  strengths: PortfolioFinding[];
  gaps: PortfolioFinding[];
  observations: PortfolioFinding[];
  recommendations: PortfolioRecommendation[];
  contextSummary: string;
  mentorSummary?: string;
  // V2 additions — all optional so older saved reports still render.
  executiveSummary?: string;
  snapshot?: PortfolioSnapshot;
  riskMeter?: RiskMeter;
  goalAlignment?: GoalAlignment;
  intelligence?: PortfolioIntelligence;
}

