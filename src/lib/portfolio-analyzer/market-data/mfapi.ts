/**
 * MFAPI.in provider — free public India mutual fund NAV / metadata.
 * Endpoint: https://api.mfapi.in/mf/search?q=NAME  and /mf/SCHEME_CODE
 * We use it only for classification (fund_category) — never for advice.
 */
import type { AssetClass, HoldingEnrichment } from "../types";
import type { MarketDataProvider, MarketDataQuery } from "./provider";

const SUPPORTED: AssetClass[] = ["equity_mf", "debt_mf", "hybrid_mf", "index_fund"];

export const mfapiProvider: MarketDataProvider = {
  id: "mfapi",
  supports: (a) => SUPPORTED.includes(a),
  async enrich({ name, identifier }: MarketDataQuery): Promise<HoldingEnrichment | null> {
    const query = (identifier ?? name).trim();
    if (!query) return null;
    try {
      let schemeCode = /^\d{4,7}$/.test(query) ? query : null;
      if (!schemeCode) {
        const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
        if (!searchRes.ok) return null;
        const list = (await searchRes.json()) as { schemeCode: number; schemeName: string }[];
        if (!Array.isArray(list) || list.length === 0) return null;
        schemeCode = String(list[0].schemeCode);
      }
      const detailRes = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as {
        meta?: { scheme_category?: string; scheme_type?: string; fund_house?: string };
      };
      const category = detail.meta?.scheme_category ?? null;
      return {
        fundCategory: category,
        marketCap: guessMarketCap(category ?? name),
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
