import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User, LayoutDashboard, FileText, Settings, RefreshCw, UserCircle2 } from "lucide-react";
import { Logo } from "./brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_NAV = [
  { to: "/how-it-works", label: "Features" },
  { to: "/principles", label: "How It Works" },
  { to: "/knowledge", label: "Knowledge Hub" },
  { to: "/about", label: "Pricing" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        {isAuthenticated ? (
          <Link to="/dashboard" aria-label="Go to dashboard">
            <Logo />
          </Link>
        ) : (
          <Link to="/" aria-label="NitiVitt home">
            <Logo />
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
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

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <UserMenu name={user?.user_metadata?.full_name ?? user?.email ?? "Account"} />
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <User className="h-4 w-4" aria-hidden />
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-95 active:scale-[0.98]"
              >
                Get Started
                <span aria-hidden>→</span>
              </Link>
              {/* Mobile inline login */}
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="inline-flex md:hidden items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
              >
                <User className="h-3.5 w-3.5" aria-hidden />
                Login
              </Link>
            </>
          )}

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 top-0 h-0.5 w-full bg-current transition ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1.5 h-0.5 w-full bg-current transition ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-3 h-0.5 w-full bg-current transition ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onClick={() => setMenuOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Get Started
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/" });
  }

  const firstName = name.includes("@") ? name.split("@")[0] : name.split(" ")[0];

  const items = [
    { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { to: "/financial-health" as const, label: "Financial Health Report", icon: FileText },
    { to: "/profile" as const, label: "Profile", icon: UserCircle2 },
    { to: "/settings" as const, label: "Settings", icon: Settings },
    { to: "/financial-health" as const, label: "Update Analysis", icon: RefreshCw },
  ];


  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {firstName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{firstName}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{name}</p>
          </div>
          <ul className="p-1.5">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.label}>
                  <Link
                    to={it.to}
                    onClick={() => setOpen(false)}

                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {it.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-1 border-t border-border pt-1">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Logout
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
