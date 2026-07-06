import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, CalendarDays } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { listArticles, listCategories } from "@/content/knowledge";
import type { ArticleSummary } from "@/content/knowledge/types";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Hub — NitiVitt" },
      {
        name: "description",
        content:
          "NitiVitt's financial education library — practical, plain-language articles on investing, insurance, retirement and tax written specifically for Indian households.",
      },
      { property: "og:title", content: "Knowledge Hub — NitiVitt" },
      { property: "og:description", content: "Practical Indian personal-finance education from NitiVitt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => ({
    articles: await listArticles(),
    categories: listCategories(),
  }),
  component: KnowledgeHub,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function KnowledgeHub() {
  const { articles, categories } = Route.useLoaderData();
  const [active, setActive] = useState<string | "All">("All");

  const filtered = useMemo(() => {
    if (active === "All") return articles;
    return articles.filter((a: ArticleSummary) => a.category === active);
  }, [articles, active]);

  return (
    <PageShell
      eyebrow="Knowledge Hub"
      title="Learn personal finance, the Indian way."
      lede="Practical, plain-language articles on investing, insurance, retirement and behaviour — written for Indian households by NitiVitt."
    >
      <div className="mb-8 flex flex-wrap gap-2">
        {(["All", ...categories] as const).map((c) => {
          const isActive = active === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a: ArticleSummary) => (
          <Link
            key={a.slug}
            to="/knowledge/$slug"
            params={{ slug: a.slug }}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            {a.coverImage && (
              <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
                <img src={a.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{a.category}</p>
            <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
              {a.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.summary}</p>
            <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {a.readingMinutes} min read
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Updated {formatDate(a.updatedAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No articles in this category yet — check back soon.
        </p>
      )}
    </PageShell>
  );
}
