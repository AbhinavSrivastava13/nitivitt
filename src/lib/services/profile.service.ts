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
  earning_members: number | null;
  monthly_sip: number | null;
  annual_investment: number | null;
  existing_portfolio: number | null;
  retirement_corpus_target: number | null;
  retirement_lifestyle: string | null;
  income_breakdown: Record<string, number> | null;
  expense_breakdown: Record<string, number> | null;
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
    // Cast: jsonb columns (income_breakdown / expense_breakdown) accept plain objects
    // but the generated `Json` type is stricter than our domain shape.
    .upsert(row as never, { onConflict: "user_id" })
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


/* ------------------------------ Snapshots ------------------------------ */

export interface FinancialSnapshotInsert {
  user_id: string;
  niti_score?: number | null;
  niti_score_grade?: string | null;
  niti_age?: number | null;
  niti_age_direction?: string | null;
  niti_age_delta_years?: number | null;
  net_worth?: number | null;
  total_assets?: number | null;
  total_liabilities?: number | null;
  savings_rate?: number | null;
  debt_ratio?: number | null;
  emergency_months?: number | null;
  retirement_status?: string | null;
  monthly_income?: number | null;
  monthly_expenses?: number | null;
  recommendations?: unknown;
  raw_input?: unknown;
}

export async function insertFinancialSnapshot(row: FinancialSnapshotInsert) {
  const { error } = await supabase
    .from("financial_snapshots")
    // Snapshot payload uses generic `unknown` to keep the caller free of jsonb-typing noise;
    // the row shape itself is validated by the Postgres column set.
    .insert(row as never);
  if (error) throw error;
}


export async function listFinancialSnapshots(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("financial_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("taken_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function countFinancialSnapshots(userId: string) {
  const { count, error } = await supabase
    .from("financial_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Returns the most recent financial snapshot for the user (or null when none),
 * used as the "previous review" baseline for Financial Journey deltas.
 */
export async function getLatestFinancialSnapshot(userId: string) {
  const { data, error } = await supabase
    .from("financial_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
