/**
 * Insurance Analyzer — server functions (V1).
 *
 * `extractInsurancePolicy` — sends the PDF to the Lovable AI gateway
 * (Gemini) and returns structured JSON. Never analyses; only extracts.
 * `analyzeInsurancePolicy` — takes user-confirmed extracted fields, runs the
 * deterministic engine over the user's NitiCore context, saves the result,
 * and optionally asks Gemini to narrate the mentor summary.
 * `listInsuranceAnalyses` — lists past analyses for the user.
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
  emptyExtractedPolicy,
  POLICY_TYPE_LABEL,
  type AnalysisReport,
  type ExtractedPolicy,
  type PolicyType,
} from "./types";

// ─────────────────────────── EXTRACTION ─────────────────────────────

const ExtractInput = z.object({
  policyType: z.enum([
    "term",
    "health",
    "personal_accident",
    "critical_illness",
    "life",
    "family_floater",
    "other",
  ]),
  fileName: z.string().min(1).max(200),
  fileMime: z.string().min(1).max(100),
  /** Base64 PDF payload (no data-URL prefix). */
  fileBase64: z.string().min(100).max(20_000_000),
});

export const extractInsurancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }): Promise<{ policy: ExtractedPolicy; usedAi: boolean }> => {
    const lovableKey = getRuntimeEnv("LOVABLE_API_KEY");
    if (!lovableKey) {
      // No AI available — return an empty shell so the UI can prompt manual entry.
      return { policy: { ...emptyExtractedPolicy(), policyType: data.policyType }, usedAi: false };
    }

    const system = `You are a document-extraction assistant reading Indian insurance policy PDFs. Extract ONLY fields visible in the document. Never invent values. When a field is unclear, leave it null and add its name to lowConfidenceFields. Respond with strict JSON matching the provided shape.`;

    const shape = `{
  "policyHolder": string | null,
  "policyType": "term" | "health" | "personal_accident" | "critical_illness" | "life" | "family_floater" | "other" | null,
  "insurer": string | null,
  "policyNumber": string | null,
  "sumInsured": number | null,  // in INR, numeric only
  "premiumAnnual": number | null, // in INR
  "premiumFrequency": string | null,
  "policyTermYears": number | null,
  "coverageStart": string | null,  // ISO date if possible
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

    const userText = `The user has classified this policy as: ${POLICY_TYPE_LABEL[data.policyType]}. Extract the fields into JSON matching exactly this shape:\n${shape}\nReturn ONLY the JSON object.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
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
                    filename: data.fileName,
                    file_data: `data:${data.fileMime};base64,${data.fileBase64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        console.error("Insurance extract gateway error", res.status, await res.text().catch(() => ""));
        return { policy: { ...emptyExtractedPolicy(), policyType: data.policyType }, usedAi: false };
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
      const parsed = safeParseJson(raw);
      const merged: ExtractedPolicy = {
        ...emptyExtractedPolicy(),
        ...(parsed as Partial<ExtractedPolicy>),
        policyType: (parsed?.policyType as PolicyType | null) ?? data.policyType,
        riders: normalizeArray(parsed?.riders),
        waitingPeriods: normalizeArray(parsed?.waitingPeriods),
        exclusions: normalizeArray(parsed?.exclusions),
        addOns: normalizeArray(parsed?.addOns),
        lowConfidenceFields: normalizeArray(parsed?.lowConfidenceFields),
      };
      return { policy: merged, usedAi: true };
    } catch (err) {
      console.error("Insurance extract failed", err);
      return { policy: { ...emptyExtractedPolicy(), policyType: data.policyType }, usedAi: false };
    }
  });

function safeParseJson(text: string): Partial<ExtractedPolicy> | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
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
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 30);
}

// ─────────────────────────── ANALYSIS ───────────────────────────────

const AnalyzeInput = z.object({
  policyType: z.enum([
    "term",
    "health",
    "personal_accident",
    "critical_illness",
    "life",
    "family_floater",
    "other",
  ]),
  fileName: z.string().max(200).optional(),
  extracted: z.record(z.string(), z.unknown()),
  narrate: z.boolean().default(true),
});

export const analyzeInsurancePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ report: AnalysisReport; analysisId: string | null }> => {
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
    const termCover = insurance
      .filter((i) => i.insurance_type === "term")
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);
    const healthCover = insurance
      .filter((i) => ["health", "family_floater"].includes(String(i.insurance_type)))
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);
    const hasTerm = termCover > 0;
    const hasHealth = healthCover > 0;
    const hasPA = insurance.some((i) => i.insurance_type === "personal_accident");
    const hasCI = insurance.some((i) => i.insurance_type === "critical_illness");

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
      dependentsCount: profile?.dependents_count ?? undefined,
    };

    const ctx = evaluateContext(nitiInput);

    const extractedFull: ExtractedPolicy = {
      ...emptyExtractedPolicy(),
      ...(data.extracted as Partial<ExtractedPolicy>),
      policyType: data.policyType,
    };

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
        totalTermCover: termCover + (data.policyType === "term" ? Number(extractedFull.sumInsured ?? 0) : 0),
        totalHealthCover: healthCover + (["health", "family_floater"].includes(data.policyType) ? Number(extractedFull.sumInsured ?? 0) : 0),
      },
    });

    // Ask Gemini to narrate — but only to explain findings, never to decide them.
    if (data.narrate) {
      const narration = await narrateReport(report, extractedFull, ctx);
      if (narration) report.mentorSummary = narration;
    }

    // Persist (best-effort — analysis is still returned even if save fails).
    let analysisId: string | null = null;
    try {
      const { data: inserted, error } = await supabase
        .from("insurance_analyses")
        .insert({
          user_id: userId,
          policy_type: data.policyType,
          file_name: data.fileName ?? null,
          extracted_policy: extractedFull as never,
          report: report as never,
          protection_score: report.protectionScore,
        })
        .select("id")
        .single();
      if (error) console.error("insurance_analyses insert failed", error);
      analysisId = inserted?.id ?? null;
    } catch (err) {
      console.error("insurance_analyses insert threw", err);
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

  const system = `You are NitiGuide — a calm, seasoned Indian financial mentor reviewing a client's insurance policy. Only explain the deterministic findings provided. Never invent numbers, never recommend specific products or insurers, never use fear-based language. Speak in 3–5 short paragraphs, first plainly acknowledging what is in place, then the meaningful gaps in order of priority, then a short closing note. Use standard punctuation (hyphens, not em dashes).`;

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

// ─────────────────────────── LIST ───────────────────────────────────

export const listInsuranceAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("insurance_analyses")
      .select("id, policy_type, file_name, protection_score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { analyses: data ?? [] };
  });
