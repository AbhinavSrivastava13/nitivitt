import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing in — NitiVitt" },
      { name: "description", content: "Completing your secure NitiVitt sign-in." },
    ],
  }),
  component: AuthCallbackPage,
});

function getSafeNextPath() {
  const stored = window.sessionStorage.getItem("nitivitt.oauth.next");
  window.sessionStorage.removeItem("nitivitt.oauth.next");
  return stored?.startsWith("/") && !stored.startsWith("//") ? stored : "/dashboard";
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing Google sign-in…");

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const getParam = (name: string) => queryParams.get(name) || hashParams.get(name);
      const errorDescription = getParam("error_description") || getParam("error");

      if (errorDescription) {
        toast.error(errorDescription);
        navigate({ to: "/auth" });
        return;
      }

      const code = getParam("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;

        if (exchangeError) {
          setMessage("We could not complete Google sign-in. Please try again.");
          toast.error(exchangeError.message);
          navigate({ to: "/auth" });
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        setMessage("We could not complete Google sign-in. Please try again.");
        toast.error(error?.message ?? "Google sign-in failed");
        navigate({ to: "/auth" });
        return;
      }

      navigate({ to: getSafeNextPath() });
    }

    finishSignIn();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page flex items-center justify-center py-24">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elevated">
          <h1 className="font-display text-3xl text-foreground">Signing you in</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}