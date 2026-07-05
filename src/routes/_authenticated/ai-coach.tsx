import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getNitiGuideBriefing } from "@/lib/niti-guide.functions";

export const Route = createFileRoute("/_authenticated/ai-coach")({
  head: () => ({
    meta: [
      { title: "NitiGuide™ — Your Financial Briefing — NitiVitt" },
      { name: "description", content: "A personalised financial briefing that helps you understand your NitiCore™ numbers in plain, mentor-style English." },
    ],
  }),
  component: NitiGuidePage,
});

function NitiGuidePage() {
  const fn = useServerFn(getNitiGuideBriefing);
  const qc = useQueryClient();
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["nitiguide-briefing"],
    queryFn: () => fn({ data: {} }),
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="min-h-screen bg-surface">
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">NitiGuide™</p>
            </div>
            <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Your financial briefing.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              A calm, mentor-style read on where you stand — grounded entirely in your live NitiCore™ numbers. Not a chatbot.
              For "what-if" questions, use NitiSim™.
            </p>
          </div>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["nitiguide-briefing"] })}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh briefing
          </button>
        </div>

        <article className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft md:p-9">
          {isLoading && (
            <div className="space-y-3">
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <p className="pt-3 text-xs text-muted-foreground">NitiGuide is reading your numbers…</p>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
              {error instanceof Error ? error.message : "Could not load your briefing right now."}
            </div>
          )}
          {data && (
            <div className="prose prose-sm max-w-none text-foreground prose-p:leading-relaxed prose-p:text-foreground/90 prose-strong:text-foreground">
              <ReactMarkdown>{data.markdown}</ReactMarkdown>
              <p className="mt-8 text-[11px] italic text-muted-foreground">
                Every number above comes from your live NitiCore™ snapshot. NitiGuide explains, never calculates. Generated {new Date(data.generatedAt).toLocaleString("en-IN")}.
              </p>
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
