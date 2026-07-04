import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-7xl text-primary">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NitiVitt - Your Personal Financial Guide" },
      {
        name: "description",
        content:
          "NitiVitt is India's financial guidance platform. Get your NitiScore, plan goals, and make smarter money decisions — transparent, math-backed, never biased.",
      },
      { name: "author", content: "NitiVitt" },
      { name: "theme-color", content: "#0B2E5C" },
      { property: "og:title", content: "NitiVitt - Your Personal Financial Guide" },
      {
        property: "og:description",
        content:
          "Know Better. Plan Better. Grow Better. India's financial guidance platform — built on math, not opinions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "NitiVitt" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NitiVitt - Your Personal Financial Guide" },
      { name: "description", content: "NitiVitt Core is a financial intelligence platform that provides personalized insights and recommendations." },
      { property: "og:description", content: "NitiVitt Core is a financial intelligence platform that provides personalized insights and recommendations." },
      { name: "twitter:description", content: "NitiVitt Core is a financial intelligence platform that provides personalized insights and recommendations." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/d4cd3872-04ef-4eb8-b0f7-e8c0c5c88680" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/d4cd3872-04ef-4eb8-b0f7-e8c0c5c88680" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Inject runtime Supabase config so the browser client works on any host
  // (Cloudflare Workers, Lovable Cloud, self-hosted) without a rebuild.
  // On Cloudflare, env is captured from the Worker's fetch(env) arg — not process.env.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getRuntimeEnv } = require("@/lib/runtime-env.server") as typeof import("@/lib/runtime-env.server");
  const runtimeEnv = {
    SUPABASE_URL: getRuntimeEnv("SUPABASE_URL") ?? getRuntimeEnv("VITE_SUPABASE_URL") ?? "",
    SUPABASE_PUBLISHABLE_KEY:
      getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY") ?? getRuntimeEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "",
  };
  const inline = `window.__NITIVITT_ENV=${JSON.stringify(runtimeEnv)};`;

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: inline }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Load client only in the browser to keep SSR safe.
    let unsub: (() => void) | undefined;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-right" />
      <Outlet />
    </QueryClientProvider>
  );
}
