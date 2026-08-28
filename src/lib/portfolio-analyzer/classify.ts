/**
 * NitiInvest™ V3 - AI classification fallback.
 *
 * ENRICHMENT ONLY. This layer never calculates a value, allocation, score,
 * rating or recommendation. It answers one narrow question for holdings that
 * deterministic market-data providers could not identify:
 *
 *   "What sector, industry, market-cap band and instrument type is this?"
 *
 * The model is instructed to return null rather than guess. Anything it is
 * unsure about stays unavailable in the report - we never invent data.
 */
import { callAiChat } from "@/lib/ai-gateway";
import type { Holding, MarketCap } from "./types";

const CLASSIFIABLE = new Set(["equity_stock", "etf", "gold_etf", "reit", "invit", "bond", "sgb"]);
const VALID_CAPS: MarketCap[] = ["large", "mid", "small", "multi", "unknown"];

interface AiClassification {
  i?: number;
  sector?: string | null;
  industry?: string | null;
  marketCap?: string | null;
  instrumentType?: string | null;
  confident?: boolean;
}

function needsClassification(h: Holding): boolean {
  if (!CLASSIFIABLE.has(h.assetClass)) return false;
  const e = h.enrichment;
  return !e?.sector || !e?.marketCap || e.marketCap === "unknown";
}

/**
 * Fills sector / industry / market-cap / instrument type for holdings that
 * deterministic providers could not identify. Mutates in place; failures are
 * silent so the report degrades gracefully.
 */
export async function classifyUnidentifiedHoldings(holdings: Holding[]): Promise<void> {
  const targets = holdings.map((h, i) => ({ h, i })).filter(({ h }) => needsClassification(h)).slice(0, 25);
  if (targets.length === 0) return;

  const system = `You classify Indian listed securities for a portfolio report. You are a reference-data lookup, not an analyst.

Rules:
- Only classify instruments you genuinely recognise as listed in India (NSE/BSE).
- Never estimate, never guess, never infer from a similar-sounding name. If you are not confident, set "confident": false and leave every field null.
- Never output prices, valuations, returns, opinions, ratings or advice.
- marketCap must be one of "large", "mid", "small" or null, using SEBI convention (top 100 by market cap = large, 101-250 = mid, rest = small).
- sector should be a broad sector such as "Financial Services", "Information Technology", "Energy", "Healthcare", "Consumer Staples".
- instrumentType examples: "Listed equity share", "Exchange-traded fund", "Gold ETF", "Sovereign gold bond", "REIT".

Return strict JSON only: {"items":[{"i":number,"sector":string|null,"industry":string|null,"marketCap":string|null,"instrumentType":string|null,"confident":boolean}]}`;

  const payload = targets.map(({ h, i }) => ({
    i,
    name: h.name,
    identifier: h.identifier,
    assetClass: h.assetClass,
  }));

  try {
    const res = await callAiChat({
      temperature: 0,
      jsonMode: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = safeParse(res?.text ?? "");
    for (const item of parsed) {
      if (item.confident === false) continue;
      const idx = typeof item.i === "number" ? item.i : -1;
      const target = holdings[idx];
      if (!target) continue;
      const cap = normalizeCap(item.marketCap);
      const sector = clean(item.sector);
      const industry = clean(item.industry);
      const instrumentType = clean(item.instrumentType);
      if (!sector && !industry && !instrumentType && !cap) continue;
      target.enrichment = {
        ...(target.enrichment ?? {}),
        sector: target.enrichment?.sector ?? sector,
        industry: target.enrichment?.industry ?? industry,
        instrumentType: target.enrichment?.instrumentType ?? instrumentType,
        marketCap:
          target.enrichment?.marketCap && target.enrichment.marketCap !== "unknown"
            ? target.enrichment.marketCap
            : (cap ?? "unknown"),
        source: target.enrichment?.source ?? "ai-classification",
      };
    }
  } catch (err) {
    console.warn("[niti-invest] AI classification failed", err);
  }
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(unknown|n\/?a|not available|null)$/i.test(t)) return null;
  return t.slice(0, 60);
}

function normalizeCap(v: unknown): MarketCap | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(/\s*cap$/, "").trim() as MarketCap;
  return VALID_CAPS.includes(s) && s !== "unknown" ? s : null;
}

function safeParse(text: string): AiClassification[] {
  if (!text) return [];
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const attempt = (s: string): AiClassification[] => {
    const parsed = JSON.parse(s) as { items?: AiClassification[] };
    return Array.isArray(parsed?.items) ? parsed.items : [];
  };
  try {
    return attempt(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return attempt(cleaned.slice(s, e + 1)); } catch { return []; }
    }
    return [];
  }
}
