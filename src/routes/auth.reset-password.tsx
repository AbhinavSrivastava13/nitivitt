import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — NitiVitt" },
      { name: "description", content: "Set a new password for your NitiVitt account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page flex items-center justify-center py-24">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated"
        >
          <h1 className="font-display text-3xl">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password — at least 8 characters.
          </p>
          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
          />
          <button
            disabled={submitting}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "…" : "Update password"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
