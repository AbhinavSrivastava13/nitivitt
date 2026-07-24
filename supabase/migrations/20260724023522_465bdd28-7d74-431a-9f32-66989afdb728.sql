
CREATE TABLE IF NOT EXISTS public.loan_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  lender TEXT,
  principal NUMERIC(14,2),
  outstanding NUMERIC(14,2),
  interest_rate NUMERIC(6,3),
  tenure_months INTEGER,
  remaining_months INTEGER,
  monthly_emi NUMERIC(12,2),
  annual_prepayment NUMERIC(12,2) DEFAULT 0,
  tax_deductible BOOLEAN DEFAULT false,
  loan_health_score INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_analyses TO authenticated;
GRANT ALL ON public.loan_analyses TO service_role;

ALTER TABLE public.loan_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_analyses_owner_select" ON public.loan_analyses;
DROP POLICY IF EXISTS "loan_analyses_owner_insert" ON public.loan_analyses;
DROP POLICY IF EXISTS "loan_analyses_owner_update" ON public.loan_analyses;
DROP POLICY IF EXISTS "loan_analyses_owner_delete" ON public.loan_analyses;

CREATE POLICY "loan_analyses_owner_select" ON public.loan_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "loan_analyses_owner_insert" ON public.loan_analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loan_analyses_owner_update" ON public.loan_analyses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loan_analyses_owner_delete" ON public.loan_analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS loan_analyses_user_reviewed_idx
  ON public.loan_analyses (user_id, last_reviewed_at DESC);

DROP TRIGGER IF EXISTS loan_analyses_updated_at ON public.loan_analyses;
CREATE TRIGGER loan_analyses_updated_at
  BEFORE UPDATE ON public.loan_analyses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

NOTIFY pgrst, 'reload schema';
