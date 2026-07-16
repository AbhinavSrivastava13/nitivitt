REVOKE ALL ON TABLE public.insurance_analyses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insurance_analyses TO authenticated;
GRANT ALL ON TABLE public.insurance_analyses TO service_role;