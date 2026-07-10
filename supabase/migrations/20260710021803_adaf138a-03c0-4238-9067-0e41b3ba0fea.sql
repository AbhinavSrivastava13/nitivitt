
-- 1) Extend financial_profiles with fields collected in onboarding but not yet persisted
ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS earning_members integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_sip numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_investment numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_portfolio numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retirement_corpus_target numeric(16,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retirement_lifestyle text,
  ADD COLUMN IF NOT EXISTS income_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS expense_breakdown jsonb;

-- 2) Financial snapshots — one per successful Review Profile submission
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  niti_score integer,
  niti_score_grade text,
  niti_age integer,
  niti_age_direction text,
  niti_age_delta_years integer,
  net_worth numeric(16,2),
  total_assets numeric(16,2),
  total_liabilities numeric(16,2),
  savings_rate numeric(6,2),
  debt_ratio numeric(6,2),
  emergency_months numeric(6,2),
  retirement_status text,
  monthly_income numeric(14,2),
  monthly_expenses numeric(14,2),
  recommendations jsonb,
  raw_input jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_snapshots_user_taken
  ON public.financial_snapshots (user_id, taken_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_snapshots TO authenticated;
GRANT ALL ON public.financial_snapshots TO service_role;

ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots self" ON public.financial_snapshots;
CREATE POLICY "snapshots self"
  ON public.financial_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
