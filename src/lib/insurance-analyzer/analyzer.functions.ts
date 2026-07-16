/**
 * Insurance Analyzer — server functions (V2).
 *
 * - `extractInsurancePolicy` sends the PDF to Gemini (via the Lovable AI
 *   gateway) and returns structured JSON. Never analyses; only extracts.
 * - `analyzeInsurancePolicy` runs the deterministic engine over the user's
 *   full FinancialContext + all saved policies, saves/overwrites the
 *   analysis, and asks Gemini to narrate the deterministic findings.
 * - `listInsuranceAnalyses`, `getInsuranceAnalysis`, `deleteInsuranceAnalysis`
 *   power the "My Insurance Policies" workspace.
 * - `getPortfolioProtectionSummary` computes portfolio-level intelligence
 *   deterministically across every saved policy.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { callAiChat } from "@/lib/ai-gateway";
import {
  evaluateContext,
  type NitiCoreInput,
} from "@/lib/niti-core";
import { analyzePolicy } from "./engine";
import {
  analyzePortfolio,
  type PortfolioPolicy,
  type PortfolioSummary,
} from "./portfolio";
import {
  emptyExtractedPolicy,
  POLICY_TYPE_LABEL,
  type AnalysisReport,
  type ExtractedPolicy,
  type PolicyType,
} from "./types";

// ─────────────────────────── EXTRACTION ─────────────────────────────

const ExtractInput = z.object({
  policyType: z.enum([
    "term", "health", "personal_accident", "critical_illness",
    "life", "family_floater", "other",
  ]),
  fileName: z.string().min(1).max(200),
  fileMime: z.string().min(1).max(100),
  fileBase64: z.string().min(100).max(20_000_000),
});

export const extractInsurancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<{ policy: ExtractedPolicy; usedAi: boolean; note?: string }> => {
    const lovableKey = getRuntimeEnv("LOVABLE_API_KEY");
    const geminiKey = getRuntimeEnv("GEMINI_API_KEY");
    if (!lovableKey && !geminiKey) {
      return {
        policy: { ...emptyExtractedPolicy(), policyType: data.policyType },
        usedAi: false,
        note: "AI extraction unavailable — please enter policy details manually.",
      };
    }

    const system = `You are a document-extraction assistant reading Indian insurance policy PDFs. Extract ONLY fields visible in the document. Never invent values. When a field is unclear, leave it null and add its exact JSON key name to lowConfidenceFields. Return ONE strict JSON object matching the requested shape — no markdown, no commentary.`;

    const shape = `{
  "policyHolder": string | null,
  "policyType": "term" | "health" | "personal_accident" | "critical_illness" | "life" | "family_floater" | "other" | null,
  "insurer": string | null,
  "policyNumber": string | null,
  "sumInsured": number | null,
  "premiumAnnual": number | null,
  "premiumFrequency": string | null,
  "policyTermYears": number | null,
  "coverageStart": string | null,
  "coverageEnd": string | null,
  "nominee": string | null,
  "riders": string[],
  "waitingPeriods": string[],
  "exclusions": string[],
  "deductible": number | null,
  "copayPct": number | null,
  "roomRentLimit": string | null,
  "addOns": string[],
  "notes": string | null,
  "lowConfidenceFields": string[]
}`;

    const userText = `The user has classified this policy as: ${POLICY_TYPE_LABEL[data.policyType]}. Extract every visible field into JSON matching exactly this shape (all amounts in INR as plain numbers):\n${shape}\nReturn ONLY the JSON object.`;

    try {
      let raw = "";

      if (lovableKey) {
        raw = await extractWithLovableGateway({
          apiKey: lovableKey,
          system,
          userText,
          fileName: data.fileName,
          fileMime: data.fileMime,
          fileBase64: data.fileBase64,
        });
      }

      if (!raw && geminiKey) {
        raw = await extractWithGeminiDirect({
          apiKey: geminiKey,
          system,
          userText,
          fileMime: data.fileMime,
          fileBase64: data.fileBase64,
        });
      }

      if (!raw) {
        return {
          policy: { ...emptyExtractedPolicy(), policyType: data.policyType },
          usedAi: false,
          note: "Extraction service could not read this PDF. Please enter details manually.",
        };
      }

      console.log("[insurance-extract] raw response length:", raw.length);
      const parsed = safeParseJson(raw);
      if (!parsed) {
        console.error("[insurance-extract] failed to parse JSON. First 400 chars:", raw.slice(0, 400));
        return {
          policy: { ...emptyExtractedPolicy(), policyType: data.policyType },
          usedAi: false,
          note: "Could not read this PDF confidently. Please enter details manually.",
        };
      }

      const merged: ExtractedPolicy = {
        ...emptyExtractedPolicy(),
        ...parsed,
        policyType: (parsed.policyType as PolicyType | null) ?? data.policyType,
        riders: normalizeArray(parsed.riders),
        waitingPeriods: normalizeArray(parsed.waitingPeriods),
        exclusions: normalizeArray(parsed.exclusions),
        addOns: normalizeArray(parsed.addOns),
        lowConfidenceFields: normalizeArray(parsed.lowConfidenceFields),
        sumInsured: coerceNumber(parsed.sumInsured),
        premiumAnnual: coerceNumber(parsed.premiumAnnual),
        policyTermYears: coerceNumber(parsed.policyTermYears),
        deductible: coerceNumber(parsed.deductible),
        copayPct: coerceNumber(parsed.copayPct),
      };
      return { policy: merged, usedAi: true };
    } catch (err) {
      console.error("Insurance extract failed", err);
      return {
        policy: { ...emptyExtractedPolicy(), policyType: data.policyType },
        usedAi: false,
        note: "Extraction failed. Please enter details manually.",
      };
    }
  });

async function extractWithLovableGateway({
  apiKey,
  system,
  userText,
  fileName,
  fileMime,
  fileBase64,
}: {
  apiKey: string;
  system: string;
  userText: string;
  fileName: string;
  fileMime: string;
  fileBase64: string;
}): Promise<string> {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
      response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                {
                  type: "file",
                  file: {
                filename: fileName,
                file_data: `data:${fileMime};base64,${fileBase64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Insurance extract gateway error", res.status, errText);
    return "";
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function extractWithGeminiDirect({
  apiKey,
  system,
  userText,
  fileMime,
  fileBase64,
}: {
  apiKey: string;
  system: string;
  userText: string;
  fileMime: string;
  fileBase64: string;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: userText },
            { inlineData: { mimeType: fileMime, data: fileBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    console.error("Insurance extract Gemini direct error", res.status, await res.text().catch(() => ""));
    return "";
  }

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}

function safeParseJson(text: string): Partial<ExtractedPolicy> | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as Partial<ExtractedPolicy>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Partial<ExtractedPolicy>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 30);
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ─────────────────────────── ANALYSIS ───────────────────────────────

const AnalyzeInput = z.object({
  policyType: z.enum([
    "term", "health", "personal_accident", "critical_illness",
    "life", "family_floater", "other",
  ]),
  fileName: z.string().max(200).optional(),
  extracted: z.record(z.string(), z.unknown()),
  narrate: z.boolean().default(true),
  /** When provided, overwrite this analysis (re-analyze or replace flow). */
  replaceId: z.string().uuid().optional(),
});

interface DbAnalysisRow {
  id: string;
  user_id: string;
  policy_type: string;
  file_name: string | null;
  insurer: string | null;
  sum_insured: string | number | null;
  premium_annual: string | number | null;
  extracted_policy: Record<string, unknown>;
  report: Record<string, unknown>;
  protection_score: number;
  last_reviewed_at: string;
  created_at: string;
  updated_at: string;
}

type DbClient = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (c: string) => { single: () => Promise<{ data: DbAnalysisRow | null; error: unknown }> };
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => {
          select: (c: string) => { single: () => Promise<{ data: DbAnalysisRow | null; error: unknown }> };
        };
      };
    };
    select: (c: string) => {
      eq: (col: string, v: string) => {
        eq?: (col: string, v: string) => Promise<{ data: DbAnalysisRow[] | null; error: { message: string } | null }>;
        order?: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: DbAnalysisRow[] | null; error: { message: string } | null }>;
        };
        maybeSingle?: () => Promise<{ data: DbAnalysisRow | null; error: { message: string } | null }>;
      };
    };
    delete: () => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

export const analyzeInsurancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ report: AnalysisReport; analysisId: string | null }> => {
    const { supabase, userId } = context;

    const [profileRes, fpRes, assetsRes, liabsRes, insRes, savedRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("assets").select("*").eq("user_id", userId),
      supabase.from("liabilities").select("*").eq("user_id", userId),
      supabase.from("insurance").select("*").eq("user_id", userId),
      (supabase as unknown as DbClient)
        .from("insurance_analyses")
        .select("id, policy_type, insurer, sum_insured, premium_annual, extracted_policy, protection_score, file_name, created_at, last_reviewed_at, report")
        .eq("user_id", userId).order!("created_at", { ascending: false }).limit(50),
    ]);

    const profile = profileRes.data;
    const fp = fpRes.data;
    const assets = assetsRes.data ?? [];
    const liabs = liabsRes.data ?? [];
    const insurance = insRes.data ?? [];
    const savedAnalyses = (savedRes.data ?? []) as DbAnalysisRow[];

    const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
    const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);

    // Union of manually-recorded insurance and saved-analysis policies.
    const savedByType = (t: string) => savedAnalyses.filter((s) => s.policy_type === t);
    const sumSavedCover = (types: string[]) => savedAnalyses
      .filter((s) => types.includes(s.policy_type))
      .reduce((a, b) => a + Number(b.sum_insured ?? 0), 0);

    const termCover = insurance.filter((i) => i.insurance_type === "term")
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0)
      + sumSavedCover(["term", "life"]);
    const healthCover = insurance
      .filter((i) => ["health", "family_floater"].includes(String(i.insurance_type)))
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0)
      + sumSavedCover(["health", "family_floater"]);
    const hasTerm = termCover > 0;
    const hasHealth = healthCover > 0;
    const hasPA = insurance.some((i) => i.insurance_type === "personal_accident") || savedByType("personal_accident").length > 0;
    const hasCI = insurance.some((i) => i.insurance_type === "critical_illness") || savedByType("critical_illness").length > 0;

    const ageYears = ageFromDob(profile?.date_of_birth ?? null);
    const nitiInput: NitiCoreInput = {
      ageYears,
      monthlyIncome: Number(fp?.monthly_income ?? 0),
      monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
      monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? fp?.monthly_expenses ?? 0),
      liquidAssets,
      totalAssets,
      totalLiabilities,
      monthlyEmi,
      monthlyInvestments: Number(fp?.monthly_sip ?? 0),
      totalInvestments: Number(fp?.existing_portfolio ?? 0),
      hasTermInsurance: hasTerm,
      hasHealthInsurance: hasHealth,
      termCover,
      retirementCorpus: 0,
      retirementAge: Number(fp?.retirement_age ?? 60),
      employmentType: (fp?.employment_type as "salaried" | "self_employed" | null) ?? undefined,
      riskProfile: (fp?.risk_profile as "conservative" | "moderate" | "aggressive" | null) ?? undefined,
      dependentsCount: profile?.dependents ?? undefined,
    };

    const ctx = evaluateContext(nitiInput);

    const extractedFull: ExtractedPolicy = {
      ...emptyExtractedPolicy(),
      ...(data.extracted as Partial<ExtractedPolicy>),
      policyType: data.policyType,
    };

    const currentPolicySum = Number(extractedFull.sumInsured ?? 0);
    const alreadyIncluded = data.replaceId
      ? savedAnalyses.some((s) => s.id === data.replaceId && s.policy_type === data.policyType)
      : false;
    const addIfNew = alreadyIncluded ? 0 : currentPolicySum;

    const report = analyzePolicy({
      policy: extractedFull,
      policyType: data.policyType,
      input: nitiInput,
      context: ctx,
      existingPortfolio: {
        hasTerm: hasTerm || data.policyType === "term",
        hasHealth: hasHealth || data.policyType === "health" || data.policyType === "family_floater",
        hasPersonalAccident: hasPA || data.policyType === "personal_accident",
        hasCriticalIllness: hasCI || data.policyType === "critical_illness",
        totalTermCover: termCover + (["term", "life"].includes(data.policyType) ? addIfNew : 0),
        totalHealthCover: healthCover + (["health", "family_floater"].includes(data.policyType) ? addIfNew : 0),
      },
    });

    if (data.narrate) {
      const narration = await narrateReport(report, extractedFull, ctx);
      if (narration) report.mentorSummary = narration;
    }

    let analysisId: string | null = null;
    const client = supabase as unknown as DbClient;
    const row = {
      user_id: userId,
      policy_type: data.policyType,
      file_name: data.fileName ?? extractedFull.policyNumber ?? null,
      insurer: extractedFull.insurer,
      sum_insured: extractedFull.sumInsured,
      premium_annual: extractedFull.premiumAnnual,
      extracted_policy: extractedFull,
      report,
      protection_score: report.protectionScore,
      last_reviewed_at: new Date().toISOString(),
    };

    if (data.replaceId) {
      const { data: updated, error } = await client
        .from("insurance_analyses")
        .update(row)
        .eq("id", data.replaceId)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error) {
        console.error("insurance_analyses update failed", error);
        throw new Error(`Policy analysis could not be saved: ${String(error.message ?? "database update failed")}`);
      }
      analysisId = updated?.id ?? null;
    } else {
      const { data: inserted, error } = await client
        .from("insurance_analyses")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        console.error("insurance_analyses insert failed", error);
        throw new Error(`Policy analysis could not be saved: ${String(error.message ?? "database insert failed")}`);
      }
      analysisId = inserted?.id ?? null;
    }

    if (!analysisId) {
      throw new Error("Policy analysis could not be saved: no saved analysis id was returned.");
    }

    return { report, analysisId };
  });

async function narrateReport(
  report: AnalysisReport,
  policy: ExtractedPolicy,
  ctx: ReturnType<typeof evaluateContext>,
): Promise<string | null> {
  const payload = {
    policyType: report.policyType,
    protectionScore: report.protectionScore,
    scoreLabel: report.scoreLabel,
    strengths: report.strengths.map((f) => f.title),
    gaps: report.gaps.map((f) => f.title),
    observations: report.observations.map((f) => f.title),
    recommendations: report.recommendations.map((r) => ({ title: r.title, priority: r.priority, reason: r.reason })),
    context: {
      lifeStage: ctx.lifeStage,
      protectionPosture: ctx.protectionPosture,
      hasDependents: ctx.hasDependents,
    },
    policy: {
      insurer: policy.insurer,
      sumInsured: policy.sumInsured,
      premiumAnnual: policy.premiumAnnual,
    },
  };

  const system = `You are NitiGuide — a calm, seasoned Indian financial mentor reviewing a client's insurance policy. Only explain the deterministic findings provided. Never invent numbers, never recommend specific products or insurers, never use fear-based language. Speak in 3–5 short paragraphs, first plainly acknowledging what is in place, then the meaningful gaps in order of priority, then a short closing note on which actions deserve immediate attention and which can wait. Use standard punctuation (hyphens, not em dashes).`;

  const res = await callAiChat({
    temperature: 0.4,
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

export interface AnalysisListItem {
  id: string;
  policyType: PolicyType;
  fileName: string | null;
  insurer: string | null;
  sumInsured: number | null;
  premiumAnnual: number | null;
  protectionScore: number;
  createdAt: string;
  lastReviewedAt: string;
}

export const listInsuranceAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ analyses: AnalysisListItem[] }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { data, error } = await client
      .from("insurance_analyses")
      .select("id, policy_type, file_name, insurer, sum_insured, premium_annual, protection_score, created_at, last_reviewed_at")
      .eq("user_id", userId).order!("last_reviewed_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return {
      analyses: (data ?? []).map((r) => ({
        id: r.id,
        policyType: r.policy_type as PolicyType,
        fileName: r.file_name,
        insurer: r.insurer,
        sumInsured: r.sum_insured == null ? null : Number(r.sum_insured),
        premiumAnnual: r.premium_annual == null ? null : Number(r.premium_annual),
        protectionScore: r.protection_score,
        createdAt: r.created_at,
        lastReviewedAt: r.last_reviewed_at,
      })),
    };
  });

const GetInput = z.object({ id: z.string().uuid() });

export interface AnalysisDetail {
  id: string;
  policyType: PolicyType;
  fileName: string | null;
  insurer: string | null;
  sumInsured: number | null;
  premiumAnnual: number | null;
  protectionScore: number;
  createdAt: string;
  lastReviewedAt: string;
  extracted: ExtractedPolicy;
  report: AnalysisReport;
}

export const getInsuranceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }): Promise<{ analysis: AnalysisDetail | null }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => {
            eq: (col: string, v: string) => {
              maybeSingle: () => Promise<{ data: DbAnalysisRow | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
    const { data: row, error } = await client
      .from("insurance_analyses")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { analysis: null };
    return {
      analysis: {
        id: row.id,
        policyType: row.policy_type as PolicyType,
        fileName: row.file_name,
        insurer: row.insurer,
        sumInsured: row.sum_insured == null ? null : Number(row.sum_insured),
        premiumAnnual: row.premium_annual == null ? null : Number(row.premium_annual),
        protectionScore: row.protection_score,
        createdAt: row.created_at,
        lastReviewedAt: row.last_reviewed_at,
        extracted: {
          ...emptyExtractedPolicy(),
          ...(row.extracted_policy as Partial<ExtractedPolicy>),
        },
        report: row.report as unknown as AnalysisReport,
      },
    };
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteInsuranceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as DbClient;
    const { error } = await client
      .from("insurance_analyses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Re-analyze uses the saved extracted policy — deterministic engine only.
const ReanalyzeInput = z.object({ id: z.string().uuid(), narrate: z.boolean().default(true) });

export const reanalyzeInsurancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReanalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ analysisId: string; report: AnalysisReport } | { analysisId: null; report: null }> => {
    const { supabase, userId } = context;
    const client = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => {
            eq: (col: string, v: string) => {
              maybeSingle: () => Promise<{ data: DbAnalysisRow | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
    const { data: row, error } = await client
      .from("insurance_analyses")
      .select("*")
      .eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (error || !row) return { analysisId: null, report: null };

    const extracted: ExtractedPolicy = {
      ...emptyExtractedPolicy(),
      ...(row.extracted_policy as Partial<ExtractedPolicy>),
    };
    const result = await analyzeInsurancePolicy({
      data: {
        policyType: row.policy_type as PolicyType,
        fileName: row.file_name ?? undefined,
        extracted: extracted as unknown as Record<string, unknown>,
        narrate: data.narrate,
        replaceId: row.id,
      },
    });
    return { analysisId: result.analysisId ?? row.id, report: result.report };
  });

// ─────────────────────────── PORTFOLIO SUMMARY ──────────────────────

export const getPortfolioProtectionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ summary: PortfolioSummary | null; policyCount: number }> => {
    const { supabase, userId } = context;

    const [profileRes, fpRes, assetsRes, liabsRes, savedRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("assets").select("*").eq("user_id", userId),
      supabase.from("liabilities").select("*").eq("user_id", userId),
      (supabase as unknown as DbClient)
        .from("insurance_analyses")
        .select("*")
        .eq("user_id", userId).order!("created_at", { ascending: false }).limit(50),
    ]);

    const rows = (savedRes.data ?? []) as DbAnalysisRow[];
    if (rows.length === 0) return { summary: null, policyCount: 0 };

    const profile = profileRes.data;
    const fp = fpRes.data;
    const assets = assetsRes.data ?? [];
    const liabs = liabsRes.data ?? [];
    const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
    const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
    const ageYears = ageFromDob(profile?.date_of_birth ?? null);

    const policies: PortfolioPolicy[] = rows.map((r) => ({
      id: r.id,
      policyType: r.policy_type as PolicyType,
      insurer: r.insurer,
      sumInsured: r.sum_insured == null ? 0 : Number(r.sum_insured),
      premiumAnnual: r.premium_annual == null ? 0 : Number(r.premium_annual),
      fileName: r.file_name,
      lastReviewedAt: r.last_reviewed_at,
      createdAt: r.created_at,
      protectionScore: r.protection_score,
      extracted: {
        ...emptyExtractedPolicy(),
        ...(r.extracted_policy as Partial<ExtractedPolicy>),
      },
    }));

    const totalTermCover = policies
      .filter((p) => p.policyType === "term" || p.policyType === "life")
      .reduce((a, b) => a + b.sumInsured, 0);

    const nitiInput: NitiCoreInput = {
      ageYears,
      monthlyIncome: Number(fp?.monthly_income ?? 0),
      monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
      monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? fp?.monthly_expenses ?? 0),
      liquidAssets,
      totalAssets,
      totalLiabilities,
      monthlyEmi,
      monthlyInvestments: Number(fp?.monthly_sip ?? 0),
      totalInvestments: Number(fp?.existing_portfolio ?? 0),
      hasTermInsurance: totalTermCover > 0,
      hasHealthInsurance: policies.some((p) => p.policyType === "health" || p.policyType === "family_floater"),
      termCover: totalTermCover,
      retirementCorpus: 0,
      retirementAge: Number(fp?.retirement_age ?? 60),
      employmentType: (fp?.employment_type as "salaried" | "self_employed" | null) ?? undefined,
      riskProfile: (fp?.risk_profile as "conservative" | "moderate" | "aggressive" | null) ?? undefined,
      dependentsCount: profile?.dependents ?? undefined,
    };
    const ctx = evaluateContext(nitiInput);
    const summary = analyzePortfolio(policies, nitiInput, ctx);
    return { summary, policyCount: rows.length };
  });
