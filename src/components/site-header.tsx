import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "./brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "Features" },
  { to: "/principles", label: "How It Works" },
  { to: "/knowledge", label: "Knowledge Hub" },
  { to: "/about", label: "Pricing" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-[0.98]"
              >
                Get Started
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
        >
          <span className="relative block h-3 w-4">
            <span className={`absolute left-0 top-0 h-0.5 w-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`absolute left-0 top-1.5 h-0.5 w-full bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-3 h-0.5 w-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    handleSignOut();
                  }}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground"
                >
                  Login
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
