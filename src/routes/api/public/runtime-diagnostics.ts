import { createFileRoute } from "@tanstack/react-router";
import { getRuntimeEnv } from "@/lib/runtime-env";

function hostFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export const Route = createFileRoute("/api/public/runtime-diagnostics")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = getRuntimeEnv("SUPABASE_URL");
        return Response.json({
          supabaseHost: hostFromUrl(supabaseUrl),
          hasSupabasePublishableKey: hasValue(getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY")),
          hasGeminiKey: hasValue(getRuntimeEnv("GEMINI_API_KEY")),
          hasLovableAiKey: hasValue(getRuntimeEnv("LOVABLE_API_KEY")),
        });
      },
    },
  },
});