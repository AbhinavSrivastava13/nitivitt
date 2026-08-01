CREATE TABLE public.advisor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_id text NOT NULL UNIQUE,
  topics text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL DEFAULT '',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  contact_phone text,
  package_id text NOT NULL,
  package_name text NOT NULL,
  amount_inr numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_provider text,
  payment_reference text,
  briefing jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_requests TO authenticated;
GRANT ALL ON public.advisor_requests TO service_role;

ALTER TABLE public.advisor_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY advisor_requests_owner_select ON public.advisor_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY advisor_requests_owner_insert ON public.advisor_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY advisor_requests_owner_update ON public.advisor_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY advisor_requests_owner_delete ON public.advisor_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER advisor_requests_set_updated_at
  BEFORE UPDATE ON public.advisor_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX advisor_requests_user_created_idx ON public.advisor_requests (user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';