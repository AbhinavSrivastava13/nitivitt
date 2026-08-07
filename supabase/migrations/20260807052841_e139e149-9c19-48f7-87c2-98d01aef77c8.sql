ALTER TABLE public.portfolio_analyses ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS portfolio_analyses_primary_idx ON public.portfolio_analyses (user_id) WHERE is_primary;
NOTIFY pgrst, 'reload schema';