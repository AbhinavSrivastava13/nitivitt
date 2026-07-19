import { MarketDataRegistry } from "./provider";
import { mfapiProvider } from "./mfapi";
import { yahooProvider } from "./yahoo";

export function createDefaultRegistry(): MarketDataRegistry {
  const reg = new MarketDataRegistry();
  reg.register(mfapiProvider);
  reg.register(yahooProvider);
  return reg;
}

export { MarketDataRegistry } from "./provider";
export type { MarketDataProvider, MarketDataQuery } from "./provider";
