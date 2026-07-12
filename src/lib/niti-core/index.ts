/**
 * NitiCore™ — the deterministic financial engine.
 *
 * Single source of truth for every financial calculation in NitiVitt.
 * No calculation lives in React components. No calculation lives in AI
 * prompts. Everything originates here.
 *
 *   import { calculateNitiScore, generateRecommendations } from "@/lib/niti-core";
 */
export * from "./types";
export * from "./config";
export * from "./services";
export {
  generateRecommendations,
  generateRecommendationsWithContext,
} from "./recommendation-engine";
export { evaluateContext, describeContext } from "./financial-context";
export type {
  FinancialContext,
  LifeStage,
  ProtectionPosture,
  LiquidityHealth,
  WealthStage,
  ContextFlag,
} from "./financial-context";
