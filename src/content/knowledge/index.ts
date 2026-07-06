/**
 * Data-source boundary for the Knowledge Hub.
 *
 * Today: static array of articles bundled with the app.
 * Tomorrow: swap the bodies of `listArticles` / `getArticleBySlug` for a
 * Supabase query or CMS fetch — the routes never change.
 */
import type { Article, ArticleSummary } from "./types";
import { toSummary } from "./types";

import { understandingNitiscore } from "./articles/understanding-nitiscore";
import { understandingNitiage } from "./articles/understanding-nitiage";
import { emergencyFund } from "./articles/emergency-fund";
import { mutualFundsVsFd } from "./articles/mutual-funds-vs-fd";
import { sipForBeginners } from "./articles/sip-for-beginners";
import { retirementPlanningIndia } from "./articles/retirement-planning-india";
import { insurancePlanning } from "./articles/insurance-planning";
import { homeLoanVsRenting } from "./articles/home-loan-vs-renting";
import { taxSavingBasics } from "./articles/tax-saving-basics";
import { commonMistakes } from "./articles/common-mistakes";

const ARTICLES: Article[] = [
  understandingNitiscore,
  understandingNitiage,
  emergencyFund,
  mutualFundsVsFd,
  sipForBeginners,
  retirementPlanningIndia,
  insurancePlanning,
  homeLoanVsRenting,
  taxSavingBasics,
  commonMistakes,
];

export async function listArticles(): Promise<ArticleSummary[]> {
  return ARTICLES.map(toSummary).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  return ARTICLES.find((a) => a.slug === slug) ?? null;
}

export async function getRelated(slug: string, limit = 3): Promise<ArticleSummary[]> {
  const source = ARTICLES.find((a) => a.slug === slug);
  if (!source) return [];
  const map = new Map(ARTICLES.map((a) => [a.slug, a]));
  const picks = source.relatedSlugs
    .map((s) => map.get(s))
    .filter((a): a is Article => !!a)
    .slice(0, limit);
  if (picks.length >= limit) return picks.map(toSummary);
  // Backfill from same category.
  const backfill = ARTICLES.filter((a) => a.slug !== slug && a.category === source.category && !picks.includes(a))
    .slice(0, limit - picks.length);
  return [...picks, ...backfill].map(toSummary);
}

export function listCategories(): string[] {
  return Array.from(new Set(ARTICLES.map((a) => a.category)));
}

export function listSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}
