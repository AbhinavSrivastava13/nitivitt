/**
 * Market Data Provider layer.
 *
 * A thin, provider-agnostic contract so NitiInvest™ can be re-pointed at any
 * source (MFAPI, Yahoo, an internal Supabase cache, a paid API) without
 * rewriting the analyzer. Every provider returns the same enrichment shape.
 */
import type { AssetClass, HoldingEnrichment } from "../types";

export interface MarketDataQuery {
  name: string;
  identifier: string | null;
  assetClass: AssetClass;
}

export interface MarketDataProvider {
  readonly id: string;
  supports(assetClass: AssetClass): boolean;
  enrich(query: MarketDataQuery): Promise<HoldingEnrichment | null>;
}

export class MarketDataRegistry {
  private providers: MarketDataProvider[] = [];

  register(p: MarketDataProvider) {
    this.providers.push(p);
  }

  async enrich(query: MarketDataQuery): Promise<HoldingEnrichment | null> {
    for (const p of this.providers) {
      if (!p.supports(query.assetClass)) continue;
      try {
        const result = await p.enrich(query);
        if (result) return { ...result, source: p.id };
      } catch (err) {
        console.warn(`[market-data] ${p.id} failed`, err);
      }
    }
    return null;
  }
}
