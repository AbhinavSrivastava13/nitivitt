CREATE TABLE public.tax_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Tax Review',
  tax_year text NOT NULL DEFAULT 'FY 2025-26',
  age_years integer NOT NULL DEFAULT 30,
  employment_type text NOT NULL DEFAULT 'salaried',
  recommended_regime text NOT NULL DEFAULT 'new',
  gross_income numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  estimated_tax_saved numeric NOT NULL DEFAULT 0,
  effective_rate_pct numeric NOT NULL DEFAULT 0,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_analyses TO authenticated;
GRANT ALL ON public.tax_analyses TO service_role;

ALTER TABLE public.tax_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_analyses_owner_select" ON public.tax_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tax_analyses_owner_insert" ON public.tax_analyses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_analyses_owner_update" ON public.tax_analyses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_analyses_owner_delete" ON public.tax_analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX tax_analyses_user_reviewed_idx ON public.tax_analyses (user_id, last_reviewed_at DESC);

CREATE TRIGGER tax_analyses_set_updated_at
  BEFORE UPDATE ON public.tax_analyses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

NOTIFY pgrst, 'reload schema';