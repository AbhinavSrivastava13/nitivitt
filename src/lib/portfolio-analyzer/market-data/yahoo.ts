/**
 * Yahoo Finance provider — resolves listed Indian securities to a sector,
 * industry and market-cap band.
 *
 * Two steps:
 *   1. Resolve a symbol. Use the visible identifier when present, otherwise
 *      search Yahoo by the holding's name (broker screenshots rarely show a
 *      ticker).
 *   2. Pull assetProfile + price for sector / industry / market cap.
 *
 * Classification only. Never used for valuation or advice. Any failure
 * returns null so the deterministic engine simply marks the field
 * unavailable rather than guessing.
 */
import type { AssetClass, HoldingEnrichment, MarketCap } from "../types";
import type { MarketDataProvider, MarketDataQuery } from "./provider";

const SUPPORTED: AssetClass[] = ["equity_stock", "etf", "gold_etf", "reit", "invit"];

const UA = { "User-Agent": "Mozilla/5.0 (compatible; NitiVitt/1.0)" };

export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  supports: (a) => SUPPORTED.includes(a),
  async enrich({ identifier, name, assetClass }: MarketDataQuery): Promise<HoldingEnrichment | null> {
    const symbol = (await resolveSymbol(identifier, name)) ?? null;
    if (!symbol) return null;
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        quoteSummary?: {
          result?: {
            assetProfile?: { sector?: string; industry?: string; longBusinessSummary?: string };
            price?: { marketCap?: { raw?: number }; quoteType?: string; longName?: string };
          }[];
        };
      };
      const r = json.quoteSummary?.result?.[0];
      if (!r) return null;
      const profile = r.assetProfile ?? {};
      const cap = r.price?.marketCap?.raw;
      const quoteType = r.price?.quoteType;
      const enrichment: HoldingEnrichment = {
        sector: profile.sector ?? null,
        industry: profile.industry ?? null,
        marketCap: capBucket(cap),
        instrumentType: instrumentLabel(quoteType, assetClass),
        description: profile.longBusinessSummary ? profile.longBusinessSummary.slice(0, 320) : null,
      };
      const useful = enrichment.sector || enrichment.industry || enrichment.marketCap !== "unknown";
      return useful ? enrichment : null;
    } catch {
      return null;
    }
  },
};

async function resolveSymbol(identifier: string | null, name: string): Promise<string | null> {
  const direct = normalizeSymbol(identifier ?? "");
  if (direct) return direct;
  const query = name.replace(/\b(ltd|limited|the)\b/gi, "").trim();
  if (query.length < 3) return null;
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    const json = (await res.json()) as { quotes?: { symbol?: string; exchange?: string }[] };
    const quotes = json.quotes ?? [];
    const indian = quotes.find((q) => q.symbol?.endsWith(".NS")) ?? quotes.find((q) => q.symbol?.endsWith(".BO"));
    return indian?.symbol ?? null;
  } catch {
    return null;
  }
}

function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  // ISINs are not Yahoo symbols.
  if (/^IN[A-Z0-9]{10}$/.test(s)) return null;
  if (s.includes(".")) return s;
  if (!/^[A-Z0-9&-]{2,12}$/.test(s)) return null;
  return `${s}.NS`;
}

function instrumentLabel(quoteType: string | undefined, assetClass: AssetClass): string | null {
  if (quoteType === "ETF") return "Exchange-traded fund";
  if (quoteType === "EQUITY") return "Listed equity share";
  if (assetClass === "equity_stock") return "Listed equity share";
  if (assetClass === "etf" || assetClass === "gold_etf") return "Exchange-traded fund";
  if (assetClass === "reit") return "Real-estate investment trust";
  if (assetClass === "invit") return "Infrastructure investment trust";
  return null;
}

function capBucket(marketCap?: number): MarketCap {
  if (!marketCap || !Number.isFinite(marketCap)) return "unknown";
  // Approx SEBI thresholds in INR: top-100 large, 101-250 mid, else small.
  if (marketCap >= 200_000_000_000) return "large"; // ≥ ₹20,000 Cr proxy
  if (marketCap >= 50_000_000_000) return "mid";
  return "small";
}
