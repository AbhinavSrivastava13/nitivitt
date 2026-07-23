/**
 * MFAPI.in provider — free public India mutual fund NAV / metadata.
 * Endpoint: https://api.mfapi.in/mf/search?q=NAME  and /mf/SCHEME_CODE
 * We use it only for classification — never for advice.
 */
import type { AssetClass, HoldingEnrichment } from "../types";
import type { MarketDataProvider, MarketDataQuery } from "./provider";

const SUPPORTED: AssetClass[] = ["equity_mf", "debt_mf", "hybrid_mf", "index_fund"];

export const mfapiProvider: MarketDataProvider = {
  id: "mfapi",
  supports: (a) => SUPPORTED.includes(a),
  async enrich({ name, identifier, assetClass }: MarketDataQuery): Promise<HoldingEnrichment | null> {
    const query = (identifier ?? name).trim();
    if (!query) return null;
    try {
      let schemeCode = /^\d{4,7}$/.test(query) ? query : null;
      let matchedName = "";
      if (!schemeCode) {
        const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
        if (!searchRes.ok) return null;
        const list = (await searchRes.json()) as { schemeCode: number; schemeName: string }[];
        if (!Array.isArray(list) || list.length === 0) return null;
        schemeCode = String(list[0].schemeCode);
        matchedName = list[0].schemeName ?? "";
      }
      const detailRes = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as {
        meta?: { scheme_category?: string; scheme_type?: string; fund_house?: string; scheme_name?: string };
      };
      const category = detail.meta?.scheme_category ?? null;
      const fundHouse = detail.meta?.fund_house ?? null;
      const schemeName = detail.meta?.scheme_name ?? matchedName ?? name;
      const basis = `${category ?? ""} ${schemeName}`;
      return {
        fundCategory: category,
        fundHouse,
        amc: fundHouse,
        marketCap: guessMarketCap(basis),
        marketCapBias: guessMarketCapBias(basis),
        investmentStyle: guessStyle(basis, assetClass),
        benchmark: guessBenchmark(basis, assetClass),
        riskCategory: guessRisk(basis, assetClass),
        investmentPhilosophy: guessPhilosophy(basis, assetClass),
        fundObjective: guessObjective(basis, assetClass),
      };
    } catch {
      return null;
    }
  },
};

function guessMarketCap(text: string): HoldingEnrichment["marketCap"] {
  const t = text.toLowerCase();
  if (t.includes("small")) return "small";
  if (t.includes("mid")) return "mid";
  if (t.includes("large")) return "large";
  if (t.includes("flexi") || t.includes("multi") || t.includes("focused")) return "multi";
  return "unknown";
}

function guessMarketCapBias(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("small")) return "Small-cap tilt";
  if (t.includes("mid")) return "Mid-cap tilt";
  if (t.includes("large & mid") || t.includes("large and mid")) return "Large & mid blend";
  if (t.includes("large")) return "Large-cap tilt";
  if (t.includes("flexi") || t.includes("multi")) return "Across market caps";
  if (t.includes("focused")) return "High-conviction, cap-agnostic";
  if (t.includes("hybrid") || t.includes("balanced")) return "Equity + debt blend";
  return null;
}

function guessStyle(text: string, ac: AssetClass): string | null {
  const t = text.toLowerCase();
  if (ac === "index_fund" || t.includes("index") || t.includes("nifty") || t.includes("sensex")) return "Passive · Index";
  if (t.includes("etf")) return "Passive · ETF";
  if (t.includes("value")) return "Active · Value";
  if (t.includes("contra")) return "Active · Contra";
  if (t.includes("focused")) return "Active · Focused";
  if (t.includes("dividend") || t.includes("yield")) return "Active · Dividend yield";
  if (t.includes("elss") || t.includes("tax")) return "Active · ELSS";
  if (t.includes("balanced") || t.includes("hybrid") || t.includes("aggressive hybrid") || t.includes("conservative hybrid")) return "Hybrid · Balanced";
  if (ac === "debt_mf" || t.includes("debt") || t.includes("bond") || t.includes("gilt") || t.includes("liquid")) return "Fixed income";
  if (ac === "equity_mf") return "Active · Diversified equity";
  return null;
}

function guessBenchmark(text: string, ac: AssetClass): string | null {
  const t = text.toLowerCase();
  if (t.includes("nifty next 50")) return "Nifty Next 50 TRI";
  if (t.includes("nifty 50") || t.includes("nifty50")) return "Nifty 50 TRI";
  if (t.includes("sensex")) return "BSE Sensex TRI";
  if (t.includes("midcap") || t.includes("mid cap") || t.includes("mid-cap")) return "Nifty Midcap 150 TRI";
  if (t.includes("smallcap") || t.includes("small cap") || t.includes("small-cap")) return "Nifty Smallcap 250 TRI";
  if (t.includes("flexi") || t.includes("multi") || t.includes("focused")) return "Nifty 500 TRI";
  if (t.includes("large")) return "Nifty 100 TRI";
  if (ac === "debt_mf" || t.includes("liquid") || t.includes("gilt") || t.includes("debt")) return "Crisil debt index";
  if (t.includes("hybrid") || t.includes("balanced")) return "Crisil Hybrid 65+35";
  return null;
}

function guessRisk(text: string, ac: AssetClass): string | null {
  const t = text.toLowerCase();
  if (t.includes("small")) return "Very High";
  if (t.includes("mid")) return "High";
  if (ac === "equity_mf" || ac === "index_fund" || t.includes("flexi") || t.includes("large")) return "Moderately High";
  if (t.includes("hybrid") || t.includes("balanced")) return "Moderate";
  if (ac === "debt_mf" || t.includes("liquid")) return "Low to Moderate";
  return null;
}

function guessPhilosophy(text: string, ac: AssetClass): string | null {
  const t = text.toLowerCase();
  if (t.includes("index") || t.includes("nifty") || t.includes("sensex")) return "Tracks a broad index at low cost. Returns mirror the benchmark rather than beat it.";
  if (t.includes("etf")) return "Exchange-traded, passively managed vehicle designed for low-cost market exposure.";
  if (t.includes("elss")) return "Equity fund with a 3-year lock-in that also offers tax deduction under 80C.";
  if (t.includes("flexi") || t.includes("multi")) return "Invests across large, mid and small caps — the fund manager decides the mix.";
  if (t.includes("focused")) return "A concentrated equity fund holding a small number of high-conviction names.";
  if (t.includes("value")) return "Buys companies trading below intrinsic worth — patience-driven strategy.";
  if (t.includes("contra")) return "Takes deliberate contrarian bets against prevailing market sentiment.";
  if (t.includes("hybrid") || t.includes("balanced")) return "Blends equity and debt in a single fund to smoothen the return path.";
  if (t.includes("liquid")) return "Parks money in very short-term instruments — used as a cash alternative.";
  if (t.includes("gilt")) return "Invests only in government securities — carries interest-rate risk, not credit risk.";
  if (ac === "debt_mf" || t.includes("debt") || t.includes("bond")) return "Fixed-income fund focused on interest accrual rather than capital appreciation.";
  if (ac === "equity_mf") return "Actively managed equity fund aiming to outperform its benchmark over full market cycles.";
  return null;
}

function guessObjective(text: string, ac: AssetClass): string | null {
  const t = text.toLowerCase();
  if (t.includes("index") || t.includes("nifty") || t.includes("sensex")) return "Long-term wealth creation by mirroring a broad market index at minimal cost.";
  if (t.includes("small")) return "High long-term growth from small emerging companies — high volatility, 7+ year horizon.";
  if (t.includes("mid")) return "Growth from mid-sized companies moving toward large-cap status — 5-7 year horizon.";
  if (t.includes("large")) return "Steady long-term compounding through India's largest, most established businesses.";
  if (t.includes("flexi") || t.includes("multi")) return "Long-term capital growth by dynamically shifting across market caps as opportunities change.";
  if (t.includes("elss")) return "Long-term equity growth with a 3-year lock-in and tax benefits under Section 80C.";
  if (t.includes("hybrid") || t.includes("balanced")) return "Balanced growth and stability by holding equity and debt within a single fund.";
  if (t.includes("liquid")) return "Preserve capital and offer better-than-savings returns for money needed within weeks.";
  if (t.includes("gilt")) return "Preserve capital and earn income from government securities.";
  if (ac === "debt_mf") return "Regular income and capital preservation through fixed-income instruments.";
  if (ac === "equity_mf") return "Long-term wealth creation through active equity investing.";
  return null;
}
