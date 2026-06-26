import { Link } from "@tanstack/react-router";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  tone?: "default" | "inverse";
}

/**
 * NitiVitt mark — an upward arc (growth) cradled by a downward arc (guidance),
 * forming a stylised "N" lens. Drawn as inline SVG so it inherits currentColor
 * and stays crisp at any size.
 */
export function Logo({ className, showWordmark = true, tone = "default" }: LogoProps) {
  const color = tone === "inverse" ? "text-background" : "text-primary";
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className ?? ""}`} aria-label="NitiVitt — home">
      <span className={`relative inline-flex h-8 w-8 items-center justify-center ${color}`}>
        <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="nv-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="currentColor" />
              <stop offset="100%" stopColor="oklch(0.58 0.14 162)" />
            </linearGradient>
          </defs>
          <path
            d="M5 24 L5 8 L14 8 C20 8 24 12 24 17 C24 22 20 24 14 24 Z"
            fill="url(#nv-grad)"
            opacity="0.95"
          />
          <circle cx="22" cy="10" r="2.2" fill="oklch(0.78 0.12 85)" />
        </svg>
      </span>
      {showWordmark && (
        <span className={`text-base font-semibold tracking-tight ${tone === "inverse" ? "text-background" : "text-foreground"}`}>
          NitiVitt
        </span>
      )}
    </Link>
  );
}
