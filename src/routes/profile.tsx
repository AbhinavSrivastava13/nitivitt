import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/profile")({
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
  component: () => (
    <PageShell
      eyebrow="Onboarding"
      title="Your financial profile"
      lede="Every NitiVitt number — your NitiScore, NitiAge, retirement gap, insurance need — is computed from this one source of truth. Complete it once. Update it as life changes."
    >
      <ModulePlaceholder
        module="NitiVitt Profile"
        description="A structured, multi-step onboarding that collects only what's needed and nothing more. Each section is independently editable and contributes to specific NitiScore pillars."
        features={[
          "Personal — age, city, occupation, dependents",
          "Income — salary, business, rental, other",
          "Expenses — essential vs. discretionary",
          "Assets — liquid, investments, retirement, real estate",
          "Liabilities — home loan, personal, credit cards",
          "Goals — retirement, education, home, vacation, custom",
          "Insurance — term, health, critical illness",
        ]}
      />
    </PageShell>
  ),
});
