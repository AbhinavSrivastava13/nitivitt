/**
 * NitiCore™ configuration layer.
 *
 * All financial assumptions live here. Every downstream service reads from
 * `NITI_CORE_CONFIG` — nothing is hardcoded. Tune this file to update the
 * whole engine.
 *
 * Values must be reviewed by qualified financial professionals before
 * production use.
 */
export interface NitiCoreConfig {
  /** Per-annum decimals (0.06 == 6%) */
  inflation: number;
  equityReturn: number;
  debtReturn: number;
  hybridReturn: number;
  salaryGrowth: number;
  postRetirementReturn: number;
  /** Withdrawal rate for corpus estimation (0.04 == 4% rule) */
  retirementWithdrawalRate: number;
  /** Emergency fund target in months of essentials */
  emergencyFundMonths: { salaried: number; selfEmployed: number };
  /** Term-life multipliers */
  termLifeMultiplier: number;
  /** NitiScore pillar weights (sum to 100) */
  scoreWeights: {
    savings: number;
    emergency: number;
    debt: number;
    insurance: number;
    goals: number;
    retirement: number;
    investments: number;
  };
  /** Grade thresholds on the 0–1000 NitiScore */
  scoreGrades: { grade: "A+" | "A" | "B" | "C" | "D"; min: number }[];
}

export const NITI_CORE_CONFIG: NitiCoreConfig = {
  inflation: 0.06,
  equityReturn: 0.12,
  debtReturn: 0.07,
  hybridReturn: 0.095,
  salaryGrowth: 0.08,
  postRetirementReturn: 0.07,
  retirementWithdrawalRate: 0.04,
  emergencyFundMonths: { salaried: 6, selfEmployed: 12 },
  termLifeMultiplier: 15,
  scoreWeights: {
    savings: 20,
    emergency: 15,
    debt: 15,
    insurance: 15,
    goals: 15,
    retirement: 10,
    investments: 10,
  },
  scoreGrades: [
    { grade: "A+", min: 900 },
    { grade: "A", min: 800 },
    { grade: "B", min: 650 },
    { grade: "C", min: 500 },
    { grade: "D", min: 0 },
  ],
};

export const NITI_CORE_VERSION = "1.0.0";
