/**
 * Yahoo Finance provider — quote endpoint for listed securities.
 *
 * We treat this as *directional* only. If the endpoint fails (rate limit,
 * change of schema, etc.) we return null and the engine falls back to
 * user-supplied values. Never used for advice — only classification.
 */
import type { AssetClass, HoldingEnrichment, MarketCap } from "../types";
import type { MarketDataProvider, MarketDataQuery } from "./provider";

const SUPPORTED: AssetClass[] = ["equity_stock", "etf", "gold_etf", "reit", "invit"];

export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  supports: (a) => SUPPORTED.includes(a),
  async enrich({ identifier, name }: MarketDataQuery): Promise<HoldingEnrichment | null> {
    const symbol = normalizeSymbol(identifier ?? name);
    if (!symbol) return null;
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 NitiVitt" } });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        quoteResponse?: { result?: { sector?: string; industry?: string; marketCap?: number }[] };
      };
      const q = json.quoteResponse?.result?.[0];
      if (!q) return null;
      return {
        sector: q.sector ?? null,
        industry: q.industry ?? null,
        marketCap: capBucket(q.marketCap),
      };
    } catch {
      return null;
    }
  },
};

function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s.includes(".")) return s;
  // Default to NSE listing when the user gave us a plain ticker.
  return `${s}.NS`;
}

function capBucket(marketCap?: number): MarketCap {
  if (!marketCap || !Number.isFinite(marketCap)) return "unknown";
  // Approx SEBI thresholds in INR: top-100 large, 101-250 mid, else small.
  if (marketCap >= 200_000_000_000) return "large"; // ≥ ₹20,000 Cr proxy
  if (marketCap >= 50_000_000_000) return "mid";
  return "small";
}
