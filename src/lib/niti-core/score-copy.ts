import { NITI_CORE_CONFIG } from "./config";

export const NITI_SCORE_PILLARS = [
  { key: "savings", label: "Savings", description: "how much of your income you keep every month" },
  { key: "emergency", label: "Emergency Fund", description: "months of essential expenses covered by liquid savings" },
  { key: "debt", label: "Debt", description: "how much monthly income is committed to EMIs" },
  { key: "insurance", label: "Insurance", description: "whether term and health cover are sized for your income and family" },
  { key: "goals", label: "Goals", description: "progress toward each goal compared with its expected timeline" },
  { key: "retirement", label: "Retirement", description: "whether your current trajectory meets your target retirement corpus" },
  { key: "investments", label: "Investments", description: "monthly investments compared with the income-based target" },
] as const;

export function getNitiScorePillars() {
  return NITI_SCORE_PILLARS.map((pillar) => ({
    ...pillar,
    weight: NITI_CORE_CONFIG.scoreWeights[pillar.key],
  }));
}

export function getNitiScoreWeightSummary(): string {
  return getNitiScorePillars().map(({ label, weight }) => `${label} (${weight}%)`).join(", ");
}

export function getNitiScorePillarCount(): number {
  return Object.keys(NITI_CORE_CONFIG.scoreWeights).length;
}