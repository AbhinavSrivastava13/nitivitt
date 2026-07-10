import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfile, getFinancialProfile, listAssets, listLiabilities, listGoals, listInsurance,
} from "@/lib/services/profile.service";
import { formatINR } from "@/lib/finance/core";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Financial profile — NitiVitt" },
      {
        name: "description",
        content:
          "Your financial profile powers every NitiVitt calculation. Personal details, income, expenses, assets, liabilities, goals.",
      },
    ],
  }),
  component: ProfilePage,
});

function useProfileData() {
  return useQuery({
    queryKey: ["profile-page"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user!;
      const [profile, fp, assets, liabs, goals, insurance] = await Promise.all([
        getProfile(user.id), getFinancialProfile(user.id),
        listAssets(user.id), listLiabilities(user.id),
        listGoals(user.id), listInsurance(user.id),
      ]);
      return { profile, fp, assets, liabs, goals, insurance };
    },
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="mb-3 font-display text-lg text-foreground">{title}</h2>
      <dl>{children}</dl>
    </div>
  );
}

function ProfilePage() {
  const { data, isLoading } = useProfileData();

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteHeader />
        <main className="container-page py-16">
          <p className="text-sm text-muted-foreground">Loading your profile…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { profile, fp, assets, liabs, goals, insurance } = data;
  const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
  const totalLiab = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
  const investmentCategories = new Set(["mutual_funds", "stocks", "epf", "ppf", "nps", "gold", "crypto"]);
  const investments = assets.filter((a) => investmentCategories.has(a.category));
  const nonInvestAssets = assets.filter((a) => !investmentCategories.has(a.category));

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Your financial profile</p>
            <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">{profile?.full_name ?? "Profile"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Everything NitiVitt knows about your money, in one place.</p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95"
          >
            <Pencil className="h-4 w-4" /> Edit Profile
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Section title="Personal Information">
            <Row label="Full name" value={profile?.full_name} />
            <Row label="Date of birth" value={profile?.date_of_birth} />
            <Row label="Gender" value={profile?.gender} />
            <Row label="City" value={profile?.city} />
            <Row label="Occupation" value={profile?.occupation} />
            <Row label="Marital status" value={profile?.marital_status} />
            <Row label="Dependents" value={profile?.dependents ?? 0} />
            <Row label="Earning members" value={(fp as { earning_members?: number | null } | null)?.earning_members ?? "—"} />
          </Section>

          <Section title="Income & Retirement">
            <Row label="Monthly income" value={formatINR(Number(fp?.monthly_income ?? 0))} />
            <Row label="Annual income" value={formatINR(Number(fp?.annual_income ?? 0))} />
            <Row label="Monthly SIP" value={formatINR(Number((fp as { monthly_sip?: number | null } | null)?.monthly_sip ?? 0))} />
            <Row label="Existing portfolio" value={formatINR(Number((fp as { existing_portfolio?: number | null } | null)?.existing_portfolio ?? 0))} />
            <Row label="Risk profile" value={fp?.risk_profile} />
            <Row label="Planned retirement age" value={fp?.retirement_age ?? "—"} />
            <Row label="Retirement lifestyle" value={(fp as { retirement_lifestyle?: string | null } | null)?.retirement_lifestyle ?? "—"} />
            <Row label="Retirement corpus target" value={formatINR(Number((fp as { retirement_corpus_target?: number | null } | null)?.retirement_corpus_target ?? 0))} />
          </Section>


          <Section title="Expenses">
            <Row label="Total monthly expenses" value={formatINR(Number(fp?.monthly_expenses ?? 0))} />
            <Row label="Essential monthly expenses" value={formatINR(Number(fp?.monthly_essential_expenses ?? 0))} />
            <Row
              label="Monthly savings"
              value={formatINR(Number(fp?.monthly_income ?? 0) - Number(fp?.monthly_expenses ?? 0))}
            />
          </Section>

          <Section title="Assets">
            <Row label="Total assets" value={formatINR(totalAssets)} />
            {nonInvestAssets.length === 0 && <Row label="Holdings" value="None recorded" />}
            {nonInvestAssets.map((a) => (
              <Row key={a.id} label={a.name || a.category} value={formatINR(Number(a.current_value ?? 0))} />
            ))}
          </Section>

          <Section title="Liabilities">
            <Row label="Total outstanding" value={formatINR(totalLiab)} />
            <Row label="Total monthly EMI" value={formatINR(monthlyEmi)} />
            {liabs.map((l) => (
              <Row key={l.id} label={l.name || l.category} value={formatINR(Number(l.outstanding_amount ?? 0))} />
            ))}
          </Section>

          <Section title="Investments">
            {investments.length === 0 && <Row label="Holdings" value="None recorded" />}
            {investments.map((a) => (
              <Row key={a.id} label={a.name || a.category} value={formatINR(Number(a.current_value ?? 0))} />
            ))}
          </Section>

          <Section title="Insurance">
            {insurance.length === 0 && <Row label="Cover" value="None recorded" />}
            {insurance.map((i) => (
              <Row
                key={i.id}
                label={i.insurance_type?.replace(/_/g, " ") ?? "Policy"}
                value={formatINR(Number(i.cover_amount ?? 0))}
              />
            ))}
          </Section>

          <Section title="Financial Goals">
            {goals.length === 0 && <Row label="Goals" value="None recorded" />}
            {goals.map((g) => (
              <Row
                key={g.id}
                label={g.name || g.goal_type}
                value={formatINR(Number(g.target_amount ?? 0))}
              />
            ))}
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
