import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auth-gated layout. All routes under `_authenticated/` require a session.
 * SSR is disabled because the Supabase session lives in localStorage, which
 * the server cannot read — gating server-side would loop on hard refresh.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
    // Route users through onboarding first
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && !profile.onboarding_completed) {
        throw redirect({ to: "/onboarding" });
      }
    }
    return { userId: data.user.id };
  },
  component: () => <Outlet />,
});
