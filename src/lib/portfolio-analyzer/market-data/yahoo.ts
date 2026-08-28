/**
 * Yahoo Finance provider - resolves listed Indian securities to a sector,
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
    // Step 1 - resolve. The search endpoint already carries sector / industry
    // for listed equities and needs no session crumb, so it is the primary
    // classification source. quoteSummary is a best-effort enhancement.
    const match = await resolveSecurity(identifier, name);
    const symbol = match?.symbol ?? null;

    let sector = match?.sector ?? null;
    let industry = match?.industry ?? null;
    let marketCap: MarketCap = "unknown";
    let quoteType = match?.quoteType;
    let description: string | null = null;

    if (symbol) {
      const detail = await fetchProfile(symbol);
      if (detail) {
        sector = detail.sector ?? sector;
        industry = detail.industry ?? industry;
        marketCap = detail.marketCap;
        quoteType = detail.quoteType ?? quoteType;
        description = detail.description;
      }
    }

    // Step 2 - index / gold ETFs carry no company sector. Classify them by the
    // instrument they track rather than dropping them out of the sector view.
    if (!sector) {
      const fallback = passiveSector(name, identifier, assetClass, quoteType);
      if (fallback) sector = fallback;
    }

    const enrichment: HoldingEnrichment = {
      sector,
      industry,
      marketCap,
      instrumentType: instrumentLabel(quoteType, assetClass),
      description,
    };
    const useful = enrichment.sector || enrichment.industry || enrichment.marketCap !== "unknown";
    return useful ? enrichment : null;
  },
};

interface SearchMatch {
  symbol: string;
  sector: string | null;
  industry: string | null;
  quoteType?: string;
}

async function resolveSecurity(identifier: string | null, name: string): Promise<SearchMatch | null> {
  const queries: string[] = [];
  const direct = normalizeSymbol(identifier ?? "");
  if (direct) queries.push(direct.replace(/\.(NS|BO)$/i, ""));
  const cleanedName = name.replace(/\b(ltd|limited|the)\b/gi, "").trim();
  if (cleanedName.length >= 3) queries.push(cleanedName);

  for (const q of queries) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        quotes?: {
          symbol?: string;
          quoteType?: string;
          sectorDisp?: string;
          sector?: string;
          industryDisp?: string;
          industry?: string;
        }[];
      };
      const quotes = (json.quotes ?? []).filter((x) => x.symbol);
      const indian =
        quotes.find((x) => x.symbol!.endsWith(".NS") && (x.sectorDisp || x.sector)) ??
        quotes.find((x) => x.symbol!.endsWith(".BO") && (x.sectorDisp || x.sector)) ??
        quotes.find((x) => x.symbol!.endsWith(".NS")) ??
        quotes.find((x) => x.symbol!.endsWith(".BO"));
      if (indian) {
        return {
          symbol: indian.symbol!,
          sector: indian.sectorDisp ?? indian.sector ?? null,
          industry: indian.industryDisp ?? indian.industry ?? null,
          quoteType: indian.quoteType,
        };
      }
    } catch {
      // try the next query form
    }
  }
  return direct ? { symbol: direct, sector: null, industry: null } : null;
}

async function fetchProfile(symbol: string): Promise<
  { sector: string | null; industry: string | null; marketCap: MarketCap; quoteType?: string; description: string | null } | null
> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quoteSummary?: {
        result?: {
          assetProfile?: { sector?: string; industry?: string; longBusinessSummary?: string };
          price?: { marketCap?: { raw?: number }; quoteType?: string };
        }[];
      };
    };
    const r = json.quoteSummary?.result?.[0];
    if (!r) return null;
    return {
      sector: r.assetProfile?.sector ?? null,
      industry: r.assetProfile?.industry ?? null,
      marketCap: capBucket(r.price?.marketCap?.raw),
      quoteType: r.price?.quoteType,
      description: r.assetProfile?.longBusinessSummary ? r.assetProfile.longBusinessSummary.slice(0, 320) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Index and commodity ETFs have no company sector. They still represent a real,
 * known exposure, so classify them by the basket they track instead of hiding
 * them from the sector view. Nothing here is estimated - each label is a fact
 * about the instrument itself.
 */
function passiveSector(
  name: string,
  identifier: string | null,
  assetClass: AssetClass,
  quoteType?: string,
): string | null {
  const t = `${name} ${identifier ?? ""}`.toLowerCase();
  if (assetClass === "gold_etf" || /\bgold\b|goldbees|gold etf/.test(t)) return "Gold (commodity)";
  if (/silver/.test(t)) return "Silver (commodity)";
  if (/\bbank\b.*(bees|etf|index|nifty)|banknifty|bankbees/.test(t)) return "Banking index";
  if (/\bit\b.*(bees|etf|index)|itbees/.test(t)) return "Technology index";
  if (/psu|pharma|consum|infra|auto|energy/.test(t) && /(bees|etf|index)/.test(t)) return "Thematic index";
  if (/liquid|gilt|bond|debt/.test(t) && /(bees|etf|fund)/.test(t)) return "Debt index";
  if (
    /niftybees|nifty|sensex|junior|midcap|smallcap|next ?50|index/.test(t) ||
    assetClass === "etf" ||
    quoteType === "ETF"
  ) {
    return "Broad market index";
  }
  return null;
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
