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
export { generateRecommendations } from "./recommendation-engine";
