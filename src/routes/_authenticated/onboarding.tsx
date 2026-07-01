import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertProfile,
  upsertFinancialProfile,
  markOnboardingComplete,
  insertGoal,
  insertInsurance,
} from "@/lib/services/profile.service";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — NitiVitt" },
      { name: "description", content: "Set up your NitiVitt financial profile in a few minutes." },
    ],
  }),
  component: OnboardingWizard,
});

interface WizardState {
  full_name: string;
  date_of_birth: string;
  gender: string;
  city: string;
  occupation: string;
  marital_status: string;
  dependents: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_essential_expenses: number;
  risk_profile: "conservative" | "moderate" | "aggressive";
  retirement_age: number;
  has_term: boolean;
  has_health: boolean;
  term_cover: number;
  health_cover: number;
  goal_type: string;
  goal_name: string;
  goal_amount: number;
  goal_year: number;
}

const STEPS = ["Personal", "Financial", "Insurance", "Goal"] as const;

function OnboardingWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [s, setS] = useState<WizardState>({
    full_name: "",
    date_of_birth: "",
    gender: "",
    city: "",
    occupation: "",
    marital_status: "single",
    dependents: 0,
    monthly_income: 0,
    monthly_expenses: 0,
    monthly_essential_expenses: 0,
    risk_profile: "moderate",
    retirement_age: 60,
    has_term: false,
    has_health: false,
    term_cover: 0,
    health_cover: 0,
    goal_type: "retirement",
    goal_name: "",
    goal_amount: 0,
    goal_year: new Date().getFullYear() + 10,
  });

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const nameSchema = z.string().trim().min(1, "Enter your name").max(100);
      const nameParsed = nameSchema.parse(s.full_name);

      await upsertProfile({
        id: user.id,
        full_name: nameParsed,
        date_of_birth: s.date_of_birth || null,
        gender: s.gender || null,
        city: s.city || null,
        occupation: s.occupation || null,
        marital_status: s.marital_status,
        dependents: s.dependents,
      });

      await upsertFinancialProfile({
        user_id: user.id,
        monthly_income: s.monthly_income,
        annual_income: s.monthly_income * 12,
        monthly_expenses: s.monthly_expenses,
        monthly_essential_expenses: s.monthly_essential_expenses,
        risk_profile: s.risk_profile,
        retirement_age: s.retirement_age,
      });

      if (s.has_term && s.term_cover > 0) {
        await insertInsurance({
          user_id: user.id,
          insurance_type: "term",
          cover_amount: s.term_cover,
        });
      }
      if (s.has_health && s.health_cover > 0) {
        await insertInsurance({
          user_id: user.id,
          insurance_type: "health",
          cover_amount: s.health_cover,
        });
      }

      if (s.goal_name && s.goal_amount > 0) {
        await insertGoal({
          user_id: user.id,
          goal_type: s.goal_type,
          name: s.goal_name,
          target_amount: s.goal_amount,
          target_date: `${s.goal_year}-01-01`,
          priority: "high",
        });
      }

      await markOnboardingComplete(user.id);
      await qc.invalidateQueries();
      toast.success("You're set. Loading your NitiScore…");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-2 font-display text-4xl text-foreground">{STEPS[step]}</h1>

          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldText label="Full name" value={s.full_name} onChange={(v) => set("full_name", v)} />
                <FieldText label="City" value={s.city} onChange={(v) => set("city", v)} />
                <FieldDate label="Date of birth" value={s.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
                <FieldSelect
                  label="Gender"
                  value={s.gender}
                  onChange={(v) => set("gender", v)}
                  options={["", "male", "female", "other", "prefer_not_to_say"]}
                />
                <FieldText label="Occupation" value={s.occupation} onChange={(v) => set("occupation", v)} />
                <FieldSelect
                  label="Marital status"
                  value={s.marital_status}
                  onChange={(v) => set("marital_status", v)}
                  options={["single", "married", "divorced", "widowed"]}
                />
                <FieldNumber label="Dependents" value={s.dependents} onChange={(v) => set("dependents", v)} />
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldNumber label="Monthly income (₹)" value={s.monthly_income} onChange={(v) => set("monthly_income", v)} />
                <FieldNumber label="Monthly expenses (₹)" value={s.monthly_expenses} onChange={(v) => set("monthly_expenses", v)} />
                <FieldNumber
                  label="Essential monthly expenses (₹)"
                  hint="Rent, EMI, groceries, utilities"
                  value={s.monthly_essential_expenses}
                  onChange={(v) => set("monthly_essential_expenses", v)}
                />
                <FieldSelect
                  label="Risk profile"
                  value={s.risk_profile}
                  onChange={(v) => set("risk_profile", v as WizardState["risk_profile"])}
                  options={["conservative", "moderate", "aggressive"]}
                />
                <FieldNumber label="Retirement age" value={s.retirement_age} onChange={(v) => set("retirement_age", v)} />
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldCheck label="I have term insurance" value={s.has_term} onChange={(v) => set("has_term", v)} />
                <FieldNumber label="Term cover (₹)" value={s.term_cover} onChange={(v) => set("term_cover", v)} />
                <FieldCheck label="I have health insurance" value={s.has_health} onChange={(v) => set("has_health", v)} />
                <FieldNumber label="Health cover (₹)" value={s.health_cover} onChange={(v) => set("health_cover", v)} />
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldSelect
                  label="Goal type"
                  value={s.goal_type}
                  onChange={(v) => set("goal_type", v)}
                  options={["retirement", "house", "car", "education", "vacation", "wedding", "other"]}
                />
                <FieldText label="Goal name" value={s.goal_name} onChange={(v) => set("goal_name", v)} />
                <FieldNumber label="Target amount (₹)" value={s.goal_amount} onChange={(v) => set("goal_amount", v)} />
                <FieldNumber label="Target year" value={s.goal_year} onChange={(v) => set("goal_year", v)} />
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((v) => v + 1)}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Finish & see my NitiScore →"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function baseInput() {
  return "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
}
function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FieldNumber({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type="number"
        min={0}
        className={baseInput()}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </label>
  );
}
function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input type="date" className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <select className={baseInput()} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o ? o.charAt(0).toUpperCase() + o.slice(1).replace("_", " ") : "—"}
          </option>
        ))}
      </select>
    </label>
  );
}
function FieldCheck({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
