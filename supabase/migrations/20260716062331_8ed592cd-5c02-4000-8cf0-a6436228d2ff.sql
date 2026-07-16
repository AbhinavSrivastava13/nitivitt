GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insurance_analyses TO authenticated;
GRANT ALL ON TABLE public.insurance_analyses TO service_role;

ALTER TABLE public.insurance_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own insurance analyses" ON public.insurance_analyses;
DROP POLICY IF EXISTS "Users can view their own insurance analyses" ON public.insurance_analyses;
DROP POLICY IF EXISTS "Users can create their own insurance analyses" ON public.insurance_analyses;
DROP POLICY IF EXISTS "Users can update their own insurance analyses" ON public.insurance_analyses;
DROP POLICY IF EXISTS "Users can delete their own insurance analyses" ON public.insurance_analyses;

CREATE POLICY "Users can view their own insurance analyses"
ON public.insurance_analyses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own insurance analyses"
ON public.insurance_analyses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insurance analyses"
ON public.insurance_analyses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own insurance analyses"
ON public.insurance_analyses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_insurance_analyses_updated_at'
      AND tgrelid = 'public.insurance_analyses'::regclass
  ) THEN
    CREATE TRIGGER trg_insurance_analyses_updated_at
      BEFORE UPDATE ON public.insurance_analyses
      FOR EACH ROW
      EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;