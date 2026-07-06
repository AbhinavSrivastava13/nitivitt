/**
 * Knowledge Hub content contract.
 *
 * The UI ONLY depends on these types. Today articles are static imports
 * from `articles/*`; tomorrow the same shape can be produced by a Supabase
 * query, a headless CMS, or a markdown loader without touching the routes.
 */

export interface ArticleSection {
  heading: string;
  /** Markdown body. Rendered with react-markdown. */
  body: string;
}

export interface Article {
  slug: string;
  title: string;
  subtitle: string;
  category: ArticleCategory;
  readingMinutes: number;
  updatedAt: string; // ISO date
  author: string;
  coverImage?: string;
  summary: string;
  sections: ArticleSection[];
  keyTakeaways: string[];
  relatedSlugs: string[];
}

export type ArticleCategory =
  | "Foundations"
  | "Safety"
  | "Investing"
  | "Retirement"
  | "Protection"
  | "Debt"
  | "Tax"
  | "Behaviour";

export interface ArticleSummary {
  slug: string;
  title: string;
  subtitle: string;
  category: ArticleCategory;
  readingMinutes: number;
  updatedAt: string;
  coverImage?: string;
  summary: string;
}

export function toSummary(a: Article): ArticleSummary {
  return {
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    category: a.category,
    readingMinutes: a.readingMinutes,
    updatedAt: a.updatedAt,
    coverImage: a.coverImage,
    summary: a.summary,
  };
}
