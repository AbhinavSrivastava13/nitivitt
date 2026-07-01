
-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========== profiles ===========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  date_of_birth date,
  gender text,
  city text,
  occupation text,
  marital_status text,
  dependents int DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- =========== financial_profiles ===========
CREATE TABLE public.financial_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income numeric(14,2),
  annual_income numeric(14,2),
  monthly_expenses numeric(14,2),
  monthly_essential_expenses numeric(14,2),
  risk_profile text,
  salary_growth_rate numeric(5,2),
  retirement_age int,
  employment_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_profiles TO authenticated;
GRANT ALL ON public.financial_profiles TO service_role;
ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fp self" ON public.financial_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fp_updated BEFORE UPDATE ON public.financial_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== assets ===========
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  is_liquid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets self" ON public.assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_assets_user ON public.assets(user_id);
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== liabilities ===========
CREATE TABLE public.liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  outstanding_amount numeric(14,2) NOT NULL DEFAULT 0,
  monthly_emi numeric(14,2) NOT NULL DEFAULT 0,
  interest_rate numeric(5,2),
  tenure_months int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO authenticated;
GRANT ALL ON public.liabilities TO service_role;
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liab self" ON public.liabilities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_liab_user ON public.liabilities(user_id);
CREATE TRIGGER trg_liab_updated BEFORE UPDATE ON public.liabilities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== goals ===========
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  name text NOT NULL,
  target_amount numeric(14,2) NOT NULL,
  target_date date,
  priority text NOT NULL DEFAULT 'medium',
  current_progress numeric(14,2) NOT NULL DEFAULT 0,
  monthly_contribution numeric(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals self" ON public.goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_goals_user ON public.goals(user_id);
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== insurance ===========
CREATE TABLE public.insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insurance_type text NOT NULL, -- term, health, other
  provider text,
  cover_amount numeric(14,2) NOT NULL DEFAULT 0,
  annual_premium numeric(14,2) DEFAULT 0,
  nominee text,
  policy_end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance TO authenticated;
GRANT ALL ON public.insurance TO service_role;
ALTER TABLE public.insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ins self" ON public.insurance FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ins_user ON public.insurance(user_id);
CREATE TRIGGER trg_ins_updated BEFORE UPDATE ON public.insurance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== investments ===========
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_type text NOT NULL, -- equity, mutual_fund, ppf, epf, nps, fd, gold, real_estate, crypto, other
  name text NOT NULL,
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  monthly_contribution numeric(14,2) DEFAULT 0,
  invested_amount numeric(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv self" ON public.investments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_inv_user ON public.investments(user_id);
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== financial_scores ===========
CREATE TABLE public.financial_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_type text NOT NULL, -- 'niti_score', 'niti_age'
  score_value numeric(10,2) NOT NULL,
  band text,
  breakdown jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_scores TO authenticated;
GRANT ALL ON public.financial_scores TO service_role;
ALTER TABLE public.financial_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores self" ON public.financial_scores FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_scores_user ON public.financial_scores(user_id, score_type, computed_at DESC);

-- =========== recommendations ===========
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  severity text,
  explanation text,
  logic text,
  assumptions jsonb,
  next_action text,
  display_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reco self" ON public.recommendations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_reco_user ON public.recommendations(user_id, status, display_order);
CREATE TRIGGER trg_reco_updated BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== simulations ===========
CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_type text NOT NULL,
  name text,
  inputs jsonb NOT NULL,
  outputs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sim self" ON public.simulations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sim_user ON public.simulations(user_id);
CREATE TRIGGER trg_sim_updated BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== user_settings ===========
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system',
  currency text NOT NULL DEFAULT 'INR',
  notifications_enabled boolean NOT NULL DEFAULT true,
  monthly_review_enabled boolean NOT NULL DEFAULT true,
  assumptions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings self" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Attach signup trigger last (after user_settings exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
