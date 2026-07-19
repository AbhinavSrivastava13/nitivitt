
CREATE TABLE IF NOT EXISTS public.portfolio_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  source_platform TEXT,
  file_name TEXT,
  holdings JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC,
  portfolio_score INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_analyses TO authenticated;
GRANT ALL ON public.portfolio_analyses TO service_role;

ALTER TABLE public.portfolio_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own portfolio analyses" ON public.portfolio_analyses;
CREATE POLICY "Users manage their own portfolio analyses"
  ON public.portfolio_analyses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS portfolio_analyses_user_created_idx
  ON public.portfolio_analyses (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_portfolio_analyses_updated_at ON public.portfolio_analyses;
CREATE TRIGGER trg_portfolio_analyses_updated_at
  BEFORE UPDATE ON public.portfolio_analyses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

NOTIFY pgrst, 'reload schema';
