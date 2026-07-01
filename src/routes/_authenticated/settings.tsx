import { createFileRoute } from "@tanstack/react-router";
import { PageShell, ModulePlaceholder } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NitiVitt" },
      {
        name: "description",
        content: "Account, privacy, notifications, and data controls for your NitiVitt profile.",
      },
    ],
  }),
  component: () => (
    <PageShell
      eyebrow="Account"
      title="Settings"
      lede="Control your data, your notifications, and how NitiVitt computes your plan. Privacy and transparency are non-negotiable."
    >
      <ModulePlaceholder
        module="NitiVitt Settings"
        description="Granular controls for the things that matter — your data, your assumptions, your notification cadence — none of the dark patterns."
        features={[
          "Account & security — email, password, 2FA",
          "Assumptions — inflation, return rates, retirement age",
          "Notifications — monthly review, milestone alerts",
          "Privacy — data export, deletion, cohort opt-out",
          "Appearance — theme, currency display",
        ]}
      />
    </PageShell>
  ),
});
