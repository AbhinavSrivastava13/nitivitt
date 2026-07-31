CREATE TABLE IF NOT EXISTS public.tax_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  last_reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Tax Review';
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS tax_year text NOT NULL DEFAULT 'FY 2025-26';
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS age_years integer NOT NULL DEFAULT 30;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'salaried';
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS recommended_regime text NOT NULL DEFAULT 'new';
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS gross_income numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS total_tax numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS estimated_tax_saved numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS effective_rate_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS input jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS report jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.tax_analyses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tax_analyses_user_id_idx ON public.tax_analyses (user_id);
CREATE INDEX IF NOT EXISTS tax_analyses_user_reviewed_idx ON public.tax_analyses (user_id, last_reviewed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_analyses TO authenticated;
GRANT ALL ON public.tax_analyses TO service_role;

ALTER TABLE public.tax_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_analyses_owner_select ON public.tax_analyses;
CREATE POLICY tax_analyses_owner_select ON public.tax_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS tax_analyses_owner_insert ON public.tax_analyses;
CREATE POLICY tax_analyses_owner_insert ON public.tax_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS tax_analyses_owner_update ON public.tax_analyses;
CREATE POLICY tax_analyses_owner_update ON public.tax_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS tax_analyses_owner_delete ON public.tax_analyses;
CREATE POLICY tax_analyses_owner_delete ON public.tax_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

DROP TRIGGER IF EXISTS set_tax_analyses_updated_at ON public.tax_analyses;
CREATE TRIGGER set_tax_analyses_updated_at BEFORE UPDATE ON public.tax_analyses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

NOTIFY pgrst, 'reload schema';