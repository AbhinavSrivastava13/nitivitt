/**
 * NitiInvest™ — server functions.
 *
 * - `extractPortfolioFromScreenshots`: Gemini Vision extracts holdings from
 *   uploaded broker screenshots. Never invents values.
 * - `analyzePortfolio`: deterministic engine + market-data enrichment +
 *   optional NitiGuide narration. Saves the analysis.
 * - List / get / delete / re-analyze for the workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { callAiChat } from "@/lib/ai-gateway";
import { evaluateContext, type NitiCoreInput } from "@/lib/niti-core";
import { analyzePortfolio as runEngine } from "./engine";
import { createDefaultRegistry } from "./market-data";
import type {
  Holding,
  PortfolioReport,
} from "./types";
import { emptyHolding } from "./types";

// ─────────────────────────── EXTRACTION ─────────────────────────────

const ScreenshotSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileMime: z.string().min(1).max(100),
  fileBase64: z.string().min(100).max(15_000_000),
});

const ExtractInput = z.object({
  platform: z.string().max(60).optional(),
  screenshots: z.array(ScreenshotSchema).min(1).max(8),
});

export const extractPortfolioFromScreenshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<{ holdings: Holding[]; usedAi: boolean; note?: string }> => {
    const lovableKey = getRuntimeEnv("LOVABLE_API_KEY");
    const geminiKey = getRuntimeEnv("GEMINI_API_KEY");
    if (!lovableKey && !geminiKey) {
      return { holdings: [], usedAi: false, note: "AI extraction unavailable — please add holdings manually." };
    }

    const system = `You extract investment holdings from Indian broker/tracker screenshots (Groww, Zerodha, INDmoney, Upstox, Angel One, Paytm Money, etc.). Extract ONLY what is clearly visible. Never invent values. When a field is unclear, leave it null and add its exact JSON key to lowConfidenceFields for that holding. Return ONE strict JSON object — no markdown, no commentary.`;

    const shape = `{
  "holdings": [
    {
      "name": string,
      "assetClass": "equity_stock" | "equity_mf" | "index_fund" | "etf" | "debt_mf" | "hybrid_mf" | "gold_etf" | "sgb" | "reit" | "invit" | "bond" | "fd" | "cash" | "other",
      "identifier": string | null,          // ISIN / scheme code / ticker if visible
      "units": number | null,
      "averageCost": number | null,          // per unit in INR
      "currentPrice": number | null,         // per unit in INR
      "currentValue": number | null,         // total INR
      "pnlPct": number | null,
      "platform": string | null,
      "lowConfidenceFields": string[]
    }
  ]
}`;

    const userText = `Platform hint: ${data.platform ?? "unknown"}. Extract every visible holding from the attached screenshot(s) into JSON matching exactly this shape. All amounts in INR as plain numbers.\n${shape}\nReturn ONLY the JSON object.`;

    try {
      let raw = "";
      if (lovableKey) raw = await extractWithLovable(lovableKey, system, userText, data.screenshots);
      if (!raw && geminiKey) raw = await extractWithGeminiDirect(geminiKey, system, userText, data.screenshots);
      if (!raw) return { holdings: [], usedAi: false, note: "Extraction returned nothing — please add holdings manually." };

      const parsed = safeParseJson(raw);
      const list = Array.isArray(parsed?.holdings) ? parsed!.holdings : [];
      const holdings: Holding[] = list.map((h: Record<string, unknown>) => ({
        ...emptyHolding(),
        ...h,
        name: String(h.name ?? "").trim() || "Unnamed holding",
        assetClass: normalizeAssetClass(h.assetClass) as Holding["assetClass"],
        identifier: coerceString(h.identifier),
        units: coerceNumber(h.units),
        averageCost: coerceNumber(h.averageCost),
        currentPrice: coerceNumber(h.currentPrice),
        currentValue: coerceNumber(h.currentValue),
        pnlPct: coerceNumber(h.pnlPct),
        platform: coerceString(h.platform) ?? data.platform ?? null,
        lowConfidenceFields: Array.isArray(h.lowConfidenceFields)
          ? (h.lowConfidenceFields as unknown[]).filter((x): x is string => typeof x === "string")
          : [],
      })).filter((h) => h.name && h.name !== "Unnamed holding");

      if (holdings.length === 0) {
        return { holdings: [], usedAi: false, note: "Could not read any holdings confidently. Please add them manually." };
      }
      return { holdings, usedAi: true };
    } catch (err) {
      console.error("[niti-invest] extraction failed", err);
      return { holdings: [], usedAi: false, note: "Extraction failed. Please add holdings manually." };
    }
  });

async function extractWithLovable(
  apiKey: string,
  system: string,
  userText: string,
  screenshots: { fileName: string; fileMime: string; fileBase64: string }[],
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
  for (const s of screenshots) {
    parts.push({ type: "image_url", image_url: { url: `data:${s.fileMime};base64,${s.fileBase64}` } });
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
    }),
  });
  if (!res.ok) {
    console.error("[niti-invest] lovable error", res.status, await res.text().catch(() => ""));
    return "";
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function extractWithGeminiDirect(
  apiKey: string,
  system: string,
  userText: string,
  screenshots: { fileName: string; fileMime: string; fileBase64: string }[],
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: userText }];
  for (const s of screenshots) parts.push({ inlineData: { mimeType: s.fileMime, data: s.fileBase64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    console.error("[niti-invest] gemini error", res.status, await res.text().catch(() => ""));
    return "";
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}

function safeParseJson(text: string): { holdings?: Record<string, unknown>[] } | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const s = cleaned.indexOf("{"); const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) { try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { return null; } }
    return null;
  }
}

const VALID_CLASSES = new Set([
  "equity_stock","equity_mf","index_fund","etf","debt_mf","hybrid_mf",
  "gold_etf","sgb","reit","invit","bond","fd","cash","other",
]);
function normalizeAssetClass(v: unknown): string {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return VALID_CLASSES.has(s) ? s : "other";
}
function coerceString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}
function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v.replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; }
  return null;
}

// ─────────────────────────── ANALYSIS ───────────────────────────────

const AnalyzeInput = z.object({
  name: z.string().max(120).optional(),
  platform: z.string().max(60).optional(),
  holdings: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
  narrate: z.boolean().default(true),
  enrich: z.boolean().default(true),
  replaceId: z.string().uuid().optional(),
});

interface DbRow {
  id: string;
  user_id: string;
  name: string | null;
  source_platform: string | null;
  file_name: string | null;
  holdings: unknown;
  total_value: string | number | null;
  portfolio_score: number;
  report: unknown;
  last_reviewed_at: string;
  created_at: string;
  updated_at: string;
}
type DbClient = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: DbRow | null; error: { message?: string } | null }> } };
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (c: string) => { single: () => Promise<{ data: DbRow | null; error: { message?: string } | null }> } } } };
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq?: (c: string, v: string) => { maybeSingle: () => Promise<{ data: DbRow | null; error: { message: string } | null }> };
        order?: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: DbRow[] | null; error: { message: string } | null }> };
      };
    };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
  };
};

export const analyzePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ report: PortfolioReport; analysisId: string | null }> => {
    const { supabase, userId } = context;

    const [profileRes, fpRes, assetsRes, liabsRes, insRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("assets").select("*").eq("user_id", userId),
      supabase.from("liabilities").select("*").eq("user_id", userId),
      supabase.from("insurance").select("*").eq("user_id", userId),
    ]);
    const profile = profileRes.data;
    const fp = fpRes.data;
    const assets = assetsRes.data ?? [];
    const liabs = liabsRes.data ?? [];
    const insurance = insRes.data ?? [];

    const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
    const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
    const termCover = insurance.filter((i) => i.insurance_type === "term").reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

    const ageYears = ageFromDob(profile?.date_of_birth ?? null);
    const nitiInput: NitiCoreInput = {
      ageYears,
      monthlyIncome: Number(fp?.monthly_income ?? 0),
      monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
      monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? fp?.monthly_expenses ?? 0),
      liquidAssets, totalAssets, totalLiabilities, monthlyEmi,
      monthlyInvestments: Number(fp?.monthly_sip ?? 0),
      totalInvestments: Number(fp?.existing_portfolio ?? 0),
      hasTermInsurance: termCover > 0,
      hasHealthInsurance: insurance.some((i) => ["health","family_floater"].includes(String(i.insurance_type))),
      termCover,
      retirementCorpus: 0,
      retirementAge: Number(fp?.retirement_age ?? 60),
      employmentType: (fp?.employment_type as "salaried" | "self_employed" | null) ?? undefined,
      riskProfile: (fp?.risk_profile as "conservative" | "moderate" | "aggressive" | null) ?? undefined,
      dependentsCount: profile?.dependents ?? undefined,
    };
    const ctx = evaluateContext(nitiInput);

    // Normalize holdings.
    const holdings: Holding[] = (data.holdings as Partial<Holding>[]).map((h) => ({
      ...emptyHolding(),
      ...h,
      name: String(h.name ?? "").trim(),
      assetClass: (normalizeAssetClass(h.assetClass) as Holding["assetClass"]),
      units: coerceNumber(h.units),
      averageCost: coerceNumber(h.averageCost),
      currentPrice: coerceNumber(h.currentPrice),
      currentValue: coerceNumber(h.currentValue),
      pnlPct: coerceNumber(h.pnlPct),
    })).filter((h) => h.name.length > 0);

    // Enrichment (bounded, best-effort).
    if (data.enrich) {
      const registry = createDefaultRegistry();
      await Promise.all(
        holdings.slice(0, 40).map(async (h) => {
          const enrichment = await registry.enrich({ name: h.name, identifier: h.identifier, assetClass: h.assetClass });
          if (enrichment) h.enrichment = enrichment;
        }),
      );
    }

    const report = runEngine({ holdings, input: nitiInput, context: ctx });

    if (data.narrate) {
      const mentor = await narrate(report, ctx);
      if (mentor) report.mentorSummary = mentor;
    }

    const totalValue = report.totalValue;
    const client = supabase as unknown as DbClient;
    const row = {
      user_id: userId,
      name: data.name ?? (data.platform ? `${data.platform} portfolio` : "My portfolio"),
      source_platform: data.platform ?? null,
      file_name: null,
      holdings,
      total_value: totalValue,
      portfolio_score: report.portfolioScore,
      report,
      last_reviewed_at: new Date().toISOString(),
    };

    let analysisId: string | null = null;
    if (data.replaceId) {
      const { data: updated, error } = await client.from("portfolio_analyses").update(row)
        .eq("id", data.replaceId).eq("user_id", userId).select("id").single();
      if (error) throw new Error(`Portfolio analysis could not be saved: ${String(error.message ?? "update failed")}`);
      analysisId = updated?.id ?? null;
    } else {
      const { data: inserted, error } = await client.from("portfolio_analyses").insert(row).select("id").single();
      if (error) throw new Error(`Portfolio analysis could not be saved: ${String(error.message ?? "insert failed")}`);
      analysisId = inserted?.id ?? null;
    }
    if (!analysisId) throw new Error("Portfolio analysis could not be saved: no id returned.");
    return { report, analysisId };
  });

async function narrate(
  report: PortfolioReport,
  ctx: ReturnType<typeof evaluateContext>,
): Promise<string | null> {
  const payload = {
    executiveSummary: report.executiveSummary,
    portfolioScore: report.portfolioScore,
    scoreLabel: report.scoreLabel,
    snapshot: report.snapshot,
    riskMeter: report.riskMeter,
    goalAlignment: report.goalAlignment,
    allocation: report.allocation,
    topHoldings: report.topHoldings,
    positives: report.intelligence?.positives.map((f) => f.title) ?? report.strengths.map((f) => f.title),
    gaps: report.gaps.map((f) => f.title),
    insights: report.intelligence?.insights.map((f) => f.title) ?? report.observations.map((f) => f.title),
    recommendations: report.recommendations.map((r) => ({ title: r.title, priority: r.priority, reason: r.reason })),
    context: { lifeStage: ctx.lifeStage, protectionPosture: ctx.protectionPosture, liquidityHealth: ctx.liquidityHealth, hasDependents: ctx.hasDependents },
  };
  const system = `You are NitiGuide — a calm, seasoned Indian financial planner writing a portfolio review for a real client. Write as an experienced advisor, not an AI summariser. Do NOT restate raw scores or repeat the numbers already visible on the report. Do NOT recommend specific funds, stocks or insurers. Do NOT predict returns. Do NOT use fear-based language, em dashes or bullet lists.

Write 4 short paragraphs, each 2-3 sentences, separated by a blank line, in this order:

1. Why the portfolio looks the way it does today — the story of the choices behind it, said kindly.
2. What is genuinely working and worth protecting — name it specifically.
3. The single most important thing this investor should understand about their portfolio — opportunity cost, long-term implication, or a structural blind spot.
4. Logical next priorities, in the order they matter — clearly separating what is urgent from what can wait a quarter or two.

Keep it warm, precise, and grounded in the findings supplied. Never invent numbers.`;
  const res = await callAiChat({
    temperature: 0.45,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Findings JSON:\n${JSON.stringify(payload, null, 2)}` },
    ],
  });
  return res?.text ?? null;
}


function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

// ─────────────────────────── LIST / GET / DELETE ────────────────────

export interface PortfolioListItem {
  id: string;
  name: string;
  platform: string | null;
  totalValue: number;
  holdingCount: number;
  portfolioScore: number;
  createdAt: string;
  lastReviewedAt: string;
}

export const listPortfolioAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ analyses: PortfolioListItem[] }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { data, error } = await client.from("portfolio_analyses")
      .select("id, name, source_platform, total_value, portfolio_score, holdings, created_at, last_reviewed_at")
      .eq("user_id", userId).order!("last_reviewed_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return {
      analyses: (data ?? []).map((r) => ({
        id: r.id,
        name: r.name ?? "Portfolio",
        platform: r.source_platform,
        totalValue: r.total_value == null ? 0 : Number(r.total_value),
        holdingCount: Array.isArray(r.holdings) ? (r.holdings as unknown[]).length : 0,
        portfolioScore: r.portfolio_score,
        createdAt: r.created_at,
        lastReviewedAt: r.last_reviewed_at,
      })),
    };
  });

const GetInput = z.object({ id: z.string().uuid() });
export interface PortfolioDetail {
  id: string; name: string; platform: string | null; totalValue: number;
  portfolioScore: number; createdAt: string; lastReviewedAt: string;
  holdings: Holding[]; report: PortfolioReport;
}
export const getPortfolioAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }): Promise<{ analysis: PortfolioDetail | null }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { data: row, error } = await client.from("portfolio_analyses")
      .select("*").eq("id", data.id).eq!("user_id", userId).maybeSingle!();
    if (error) throw new Error(error.message);
    if (!row) return { analysis: null };
    return {
      analysis: {
        id: row.id,
        name: row.name ?? "Portfolio",
        platform: row.source_platform,
        totalValue: row.total_value == null ? 0 : Number(row.total_value),
        portfolioScore: row.portfolio_score,
        createdAt: row.created_at,
        lastReviewedAt: row.last_reviewed_at,
        holdings: (Array.isArray(row.holdings) ? row.holdings : []) as Holding[],
        report: row.report as unknown as PortfolioReport,
      },
    };
  });

const DeleteInput = z.object({ id: z.string().uuid() });
export const deletePortfolioAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { error } = await client.from("portfolio_analyses").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PortfolioIntelligenceSummary {
  totalValue: number;
  portfolioCount: number;
  averageScore: number;
  latestReviewedAt: string | null;
}
export const getPortfolioIntelligenceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ summary: PortfolioIntelligenceSummary }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { data } = await client.from("portfolio_analyses")
      .select("total_value, portfolio_score, last_reviewed_at")
      .eq("user_id", userId).order!("last_reviewed_at", { ascending: false }).limit(50);
    const rows = data ?? [];
    const totalValue = rows.reduce((a, r) => a + Number(r.total_value ?? 0), 0);
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.portfolio_score, 0) / rows.length) : 0;
    return {
      summary: {
        totalValue,
        portfolioCount: rows.length,
        averageScore: avg,
        latestReviewedAt: rows[0]?.last_reviewed_at ?? null,
      },
    };
  });
