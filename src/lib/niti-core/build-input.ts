import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { NitiCoreGoal, NitiCoreInput } from "./types";

type NitiCoreDataClient = SupabaseClient<Database>;

function ageFromDob(dob: string | null | undefined): number {
  if (!dob) return 0;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(18, Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)));
}

/** Load and normalize the shared, user-scoped inputs consumed by NitiCore. */
export async function buildNitiCoreInput(userId: string, client: NitiCoreDataClient) {
  const [profileRes, financialProfileRes, assetsRes, liabilitiesRes, insuranceRes, investmentsRes, goalsRes] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.from("assets").select("*").eq("user_id", userId),
    client.from("liabilities").select("*").eq("user_id", userId),
    client.from("insurance").select("*").eq("user_id", userId),
    client.from("investments").select("*").eq("user_id", userId),
    client.from("goals").select("*").eq("user_id", userId),
  ]);

  const results = [profileRes, financialProfileRes, assetsRes, liabilitiesRes, insuranceRes, investmentsRes, goalsRes];
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;

  const profile = profileRes.data;
  const financialProfile = financialProfileRes.data;
  const assets = assetsRes.data ?? [];
  const liabilities = liabilitiesRes.data ?? [];
  const insurance = insuranceRes.data ?? [];
  const investments = investmentsRes.data ?? [];
  const goals = goalsRes.data ?? [];

  const totalAssets = assets.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
  const liquidAssets = assets.filter((row) => row.is_liquid)
    .reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
  const totalLiabilities = liabilities.reduce((sum, row) => sum + Number(row.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabilities.reduce((sum, row) => sum + Number(row.monthly_emi ?? 0), 0);
  const termInsurance = insurance.filter((row) => row.insurance_type === "term");
  const retirementTypes = new Set(["epf", "ppf", "nps"]);
  const goalInputs: NitiCoreGoal[] = goals.map((goal) => ({
    targetAmount: Number(goal.target_amount ?? 0),
    currentProgress: Number(goal.current_progress ?? 0),
    createdAt: goal.created_at,
    targetDate: goal.target_date,
    priority: goal.priority,
  }));
  const hasDateOfBirth = Boolean(profile?.date_of_birth);

  const input: NitiCoreInput = {
    ageYears: ageFromDob(profile?.date_of_birth),
    hasDateOfBirth,
    monthlyIncome: Number(financialProfile?.monthly_income ?? 0),
    monthlyExpenses: Number(financialProfile?.monthly_expenses ?? 0),
    monthlyEssentialExpenses: Number(financialProfile?.monthly_essential_expenses ?? 0),
    liquidAssets,
    totalAssets,
    totalLiabilities,
    monthlyEmi,
    monthlyInvestments: investments.reduce((sum, row) => sum + Number(row.monthly_contribution ?? 0), 0),
    totalInvestments: investments.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0),
    hasTermInsurance: termInsurance.length > 0,
    hasHealthInsurance: insurance.some((row) => row.insurance_type === "health"),
    termCover: termInsurance.reduce((sum, row) => sum + Number(row.cover_amount ?? 0), 0),
    retirementCorpus: investments
      .filter((row) => retirementTypes.has(row.investment_type.toLowerCase()))
      .reduce((sum, row) => sum + Number(row.current_value ?? 0), 0),
    retirementAge: Number(financialProfile?.retirement_age ?? 60),
    employmentType: financialProfile?.employment_type === "self_employed" ? "self_employed" : "salaried",
    riskProfile: (financialProfile?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
    dependentsCount: profile?.dependents ?? undefined,
    goals: goalInputs,
  };

  return { input, profile, financialProfile, assets, liabilities, insurance, investments, goals };
}