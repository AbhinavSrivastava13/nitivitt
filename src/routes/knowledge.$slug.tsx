import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight, Clock, CalendarDays, User, Share2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getArticleBySlug, getPrevNext, getRelated } from "@/content/knowledge";
import type { ArticleSection, ArticleSummary } from "@/content/knowledge/types";

export const Route = createFileRoute("/knowledge/$slug")({
  loader: async ({ params }) => {
    const article = await getArticleBySlug(params.slug);
    if (!article) throw notFound();
    const [related, { prev, next }] = await Promise.all([
      getRelated(params.slug),
      getPrevNext(params.slug),
    ]);
    return { article, related, prev, next };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    if (!a) return { meta: [{ title: "Article not found — NitiVitt" }] };
    return {
      meta: [
        { title: `${a.title} — NitiVitt Knowledge Hub` },
        { name: "description", content: a.summary },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.summary },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(a.coverImage
          ? [
              { property: "og:image", content: a.coverImage },
              { name: "twitter:image", content: a.coverImage },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container-page py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">404</p>
        <h1 className="mt-3 font-display text-4xl text-foreground">Article not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">The article you're looking for doesn't exist yet.</p>
        <Link to="/knowledge" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Knowledge Hub
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container-page py-24 text-center">
        <h1 className="font-display text-3xl text-foreground">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
        <button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button>
      </main>
      <SiteFooter />
    </div>
  ),
  component: ArticleDetail,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ArticleDetail() {
  const { article, related, prev, next } = Route.useLoaderData();

  async function share() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: { title: string; text: string; url: string }) => Promise<void> })
          .share({ title: article.title, text: article.summary, url });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-border">
          <div className="container-page py-14 md:py-20">
            <Link
              to="/knowledge"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-secondary hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Knowledge Hub
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{article.category}</p>
            <h1 className="mt-3 max-w-4xl text-balance font-display text-4xl leading-tight text-foreground md:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{article.subtitle}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {article.author}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {article.readingMinutes} min read</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Updated {formatDate(article.updatedAt)}</span>
              <button
                type="button"
                onClick={() => void share()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-foreground hover:border-primary/40"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
          </div>
        </section>

        {/* Cover image */}
        {article.coverImage && (
          <div className="container-page pt-8">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
              <img src={article.coverImage} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        )}

        {/* Body */}
        <article className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="prose prose-lg max-w-none text-foreground prose-headings:font-display prose-headings:text-foreground prose-p:leading-relaxed prose-p:text-foreground/90 prose-strong:text-foreground prose-a:text-primary prose-li:text-foreground/90">
            {article.sections.map((s: ArticleSection, i: number) => (
              <section key={i}>
                <h2 className="mt-10 first:mt-0 text-2xl">{s.heading}</h2>
                <ReactMarkdown>{s.body}</ReactMarkdown>
              </section>
            ))}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary-soft text-secondary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Key takeaways</p>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-foreground">
                {article.keyTakeaways.map((t: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {related.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Related reading</p>
                <ul className="mt-3 space-y-3">
                  {related.map((r: ArticleSummary) => (
                    <li key={r.slug}>
                      <Link
                        to="/knowledge/$slug"
                        params={{ slug: r.slug }}
                        className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{r.category}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{r.readingMinutes} min read</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </article>

        <div className="border-t border-border">
          <div className="container-page grid gap-3 py-8 md:grid-cols-2">
            {prev ? (
              <Link
                to="/knowledge/$slug"
                params={{ slug: prev.slug }}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">{prev.title}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link
                to="/knowledge/$slug"
                params={{ slug: next.slug }}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-primary/40"
              >
                <span className="inline-flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
                <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">{next.title}</span>
              </Link>
            ) : <span />}
          </div>
          <div className="container-page pb-10 text-center">
            <Link
              to="/knowledge"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Knowledge Hub
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
