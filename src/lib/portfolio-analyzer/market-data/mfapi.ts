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
      return {
        fundCategory: category,
        fundHouse,
        marketCap: guessMarketCap(category ?? schemeName),
        investmentStyle: guessStyle(category ?? schemeName, assetClass),
        benchmark: guessBenchmark(category ?? schemeName, assetClass),
        riskCategory: guessRisk(category ?? schemeName, assetClass),
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
