import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
// import { lovable } from "@/integrations/lovable/index";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — NitiVitt" },
      {
        name: "description",
        content: "Sign in or create your NitiVitt account to unlock your NitiScore™, personalised goals, and transparent financial guidance.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Use at least 8 characters").max(128);

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, forward.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: search.redirect ?? "/dashboard" });
    });
  }, [navigate, search.redirect]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const parsedPwd = passwordSchema.parse(password);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsedEmail,
          password: parsedPwd,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() || undefined },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to NitiVitt.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsedEmail,
          password: parsedPwd,
        });
        if (error) throw error;
      }
      navigate({ to: search.redirect ?? "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // async function handleGoogle() {
  //   setSubmitting(true);
  //   try {
  //     const result = await lovable.auth.signInWithOAuth("google", {
  //       redirect_uri: window.location.origin,
  //     });
  //     if (result.error) throw result.error;
  //     if (result.redirected) return;
  //     navigate({ to: search.redirect ?? "/dashboard" });
  //   } catch (err) {
  //     const msg = err instanceof Error ? err.message : "Google sign-in failed";
  //     toast.error(msg);
  //     setSubmitting(false);
  //   }
  // }
  async function handleGoogle() {
  setSubmitting(true);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;

  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Google sign-in failed";

    toast.error(msg);
    setSubmitting(false);
  }
}

  async function handleForgotPassword() {
    try {
      const parsedEmail = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reset email";
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page flex items-center justify-center py-16 md:py-24">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
          <div className="flex justify-center gap-1 rounded-lg bg-muted p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h1 className="mt-6 font-display text-3xl text-foreground">
            {mode === "signin" ? "Welcome back." : "Start your NitiVitt journey."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to see your NitiScore™ and next best action."
              : "One clean account. No trackers, no commissions."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  placeholder="Aarav Sharma"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@email.com"
              />
            </Field>
            <Field
              label="Password"
              hint={
                mode === "signin" ? (
                  <button type="button" onClick={handleForgotPassword} className="text-primary hover:underline">
                    Forgot?
                  </button>
                ) : null
              }
            >
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="At least 8 characters"
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/principles" className="underline">Principles</Link>. Your data is yours — end of story.
          </p>
        </div>
      </main>
      <SiteFooter />
      <style>{`.input{width:100%;border:1px solid var(--color-border);background:var(--color-surface);border-radius:0.5rem;padding:0.625rem 0.75rem;font-size:0.875rem;color:var(--color-foreground);outline:none;transition:border-color .15s}.input:focus{border-color:var(--color-primary)}`}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {hint}
      </div>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
