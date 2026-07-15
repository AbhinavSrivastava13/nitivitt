
-- Insurance Analyzer V2: persistent policy library
CREATE TABLE IF NOT EXISTS public.insurance_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  file_name TEXT,
  insurer TEXT,
  sum_insured NUMERIC,
  premium_annual NUMERIC,
  extracted_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  protection_score INT NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_analyses TO authenticated;
GRANT ALL ON public.insurance_analyses TO service_role;

ALTER TABLE public.insurance_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own insurance analyses" ON public.insurance_analyses;
CREATE POLICY "Users manage their own insurance analyses"
  ON public.insurance_analyses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS insurance_analyses_user_created_idx
  ON public.insurance_analyses (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_insurance_analyses_updated_at ON public.insurance_analyses;
CREATE TRIGGER trg_insurance_analyses_updated_at
  BEFORE UPDATE ON public.insurance_analyses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
