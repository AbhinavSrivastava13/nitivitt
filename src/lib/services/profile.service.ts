/**
 * Profile & onboarding data-access service.
 * All calls run through the browser Supabase client, so RLS ensures each user
 * can only ever read or write their own rows.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  occupation: string | null;
  marital_status: string | null;
  dependents: number | null;
  onboarding_completed: boolean;
}

export interface FinancialProfileRow {
  user_id: string;
  monthly_income: number | null;
  annual_income: number | null;
  monthly_expenses: number | null;
  monthly_essential_expenses: number | null;
  risk_profile: string | null;
  salary_growth_rate: number | null;
  retirement_age: number | null;
  employment_type: string | null;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function upsertProfile(row: Partial<ProfileRow> & { id: string }) {
  const { data, error } = await supabase.from("profiles").upsert(row).select().single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function upsertFinancialProfile(row: Partial<FinancialProfileRow> & { user_id: string }) {
  const { data, error } = await supabase
    .from("financial_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFinancialProfile(userId: string) {
  const { data, error } = await supabase
    .from("financial_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as FinancialProfileRow | null;
}

export async function markOnboardingComplete(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (error) throw error;
}

export async function listGoals(userId: string) {
  const { data, error } = await supabase.from("goals").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function listAssets(userId: string) {
  const { data, error } = await supabase.from("assets").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function listLiabilities(userId: string) {
  const { data, error } = await supabase.from("liabilities").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function listInsurance(userId: string) {
  const { data, error } = await supabase.from("insurance").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function insertGoal(row: {
  user_id: string;
  goal_type: string;
  name: string;
  target_amount: number;
  target_date?: string | null;
  priority?: string;
}) {
  const { error } = await supabase.from("goals").insert(row);
  if (error) throw error;
}

export async function insertInsurance(row: {
  user_id: string;
  insurance_type: string;
  cover_amount: number;
  annual_premium?: number;
  provider?: string;
  nominee?: string;
}) {
  const { error } = await supabase.from("insurance").insert(row);
  if (error) throw error;
}

export async function insertAsset(row: {
  user_id: string;
  category: string;
  name: string;
  current_value: number;
  is_liquid?: boolean;
}) {
  const { error } = await supabase.from("assets").insert(row);
  if (error) throw error;
}

export async function insertLiability(row: {
  user_id: string;
  category: string;
  name: string;
  outstanding_amount: number;
  monthly_emi?: number;
  tenure_months?: number | null;
  interest_rate?: number | null;
}) {
  const { error } = await supabase.from("liabilities").insert(row);
  if (error) throw error;
}

