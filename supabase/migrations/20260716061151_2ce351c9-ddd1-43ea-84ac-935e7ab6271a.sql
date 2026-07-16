
-- Restore missing Data API grants on insurance_analyses.
-- Root cause: the V2 migration created the table + RLS but never issued
-- GRANT statements. PostgREST silently rejected every insert/select from
-- the authenticated role, so saved policies never appeared in the workspace
-- and the portfolio summary always saw zero rows.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_analyses TO authenticated;
GRANT ALL ON public.insurance_analyses TO service_role;
