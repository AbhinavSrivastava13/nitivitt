/**
 * NitiGuide™ — the explanation layer.
 *
 * NitiGuide NEVER performs financial calculations. It only translates the
 * deterministic outputs of NitiCore™ into plain-language explanations.
 *
 * Contract:
 *   client → server fn (auth-gated) →
 *   server pulls user data (RLS) → runs NitiCore →
 *   sends STRUCTURED JSON (never raw DB rows) to the AI gateway →
 *   returns { explanation: string }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  calculateNitiScore,
  calculateNitiAge,
  calculateEmergencyFund,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateRetirement,
  calculateInsuranceAdequacy,
  calculateNetWorth,
  generateRecommendations,
  type NitiCoreInput,
} from "@/lib/niti-core";

const InputSchema = z.object({
  focus: z
    .enum(["overview", "score", "age", "path", "retirement", "insurance", "emergency", "goals", "custom"])
    .default("overview"),
  question: z.string().trim().max(500).optional(),
});

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

export const getNitiGuideExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Fetch minimal, user-scoped data via RLS.
    const [profileRes, fpRes, assetsRes, liabsRes, insRes, goalsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("assets").select("*").eq("user_id", userId),
      supabase.from("liabilities").select("*").eq("user_id", userId),
      supabase.from("insurance").select("*").eq("user_id", userId),
      supabase.from("goals").select("*").eq("user_id", userId),
    ]);

    const profile = profileRes.data;
    const fp = fpRes.data;
    const assets = assetsRes.data ?? [];
    const liabs = liabsRes.data ?? [];
    const insurance = insRes.data ?? [];
    const goals = goalsRes.data ?? [];

    // 2) Compute deterministic outputs — the single source of truth.
    const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const liquidAssets = assets
      .filter((a) => a.is_liquid)
      .reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
    const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
    const termCover = insurance
      .filter((i) => i.insurance_type === "term")
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

    const input: NitiCoreInput = {
      ageYears: ageFromDob(profile?.date_of_birth ?? null),
      monthlyIncome: Number(fp?.monthly_income ?? 0),
      monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
      monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
      liquidAssets,
      totalAssets,
      totalLiabilities,
      monthlyEmi,
      monthlyInvestments: 0,
      totalInvestments: 0,
      hasTermInsurance: insurance.some((i) => i.insurance_type === "term"),
      hasHealthInsurance: insurance.some((i) => i.insurance_type === "health"),
      termCover,
      retirementCorpus: 0,
      retirementAge: Number(fp?.retirement_age ?? 60),
      riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
    };

    const score = calculateNitiScore(input);
    const age = calculateNitiAge(input);
    const emergency = calculateEmergencyFund(input);
    const savings = calculateSavingsRate(input);
    const debt = calculateDebtRatio(input);
    const retirement = calculateRetirement(input);
    const insAdequacy = calculateInsuranceAdequacy(input);
    const netWorth = calculateNetWorth(input);
    const recs = generateRecommendations(input);

    // 3) STRUCTURED payload for the LLM. No raw DB rows, no PII beyond first name.
    const firstName = profile?.full_name?.split(" ")[0] ?? "there";
    const structured = {
      firstName,
      focus: data.focus,
      metrics: {
        nitiScore: { value: score.value, grade: score.grade, breakdown: score.breakdown.map((b) => ({ pillar: b.pillar, score: Math.round(b.pillarScore) })) },
        nitiAge: { value: age.value, actual: input.ageYears, delta: age.value - input.ageYears },
        netWorth: { value: netWorth.value, status: netWorth.status },
        savingsRatePct: savings.value,
        emergencyMonths: emergency.value,
        debtRatioPct: debt.value,
        retirement: { status: retirement.status, summary: retirement.calculationSummary },
        insurance: { adequacyPct: insAdequacy.value, hasTerm: input.hasTermInsurance, hasHealth: input.hasHealthInsurance },
      },
      topActions: recs.slice(0, 3).map((r) => ({
        title: r.title,
        priority: r.priority,
        nextAction: r.nextAction,
      })),
      goalCount: goals.length,
      goals: goals.slice(0, 5).map((g) => ({ name: g.name, target: Number(g.target_amount ?? 0), progress: Number(g.current_progress ?? 0), targetDate: g.target_date })),
    };

    // 4) Call the AI Gateway (Gemini). Key stays server-side.
    const gatewayKey = process.env.LOVABLE_API_KEY;
    if (!gatewayKey) {
      return {
        explanation: fallbackExplanation(structured),
        source: "fallback",
      };
    }

    const systemPrompt = `You are NitiGuide, the AI explanation layer of NitiVitt, India's financial guidance platform.

Rules — non-negotiable:
1. You NEVER compute or recalculate anything. Every number below is authoritative and was produced by the NitiCore deterministic engine.
2. You NEVER invent recommendations. Only reference the "topActions" provided.
3. You NEVER quote a number that isn't in the input JSON.
4. Speak in warm, plain English (or Hinglish only if it clearly helps). Use short paragraphs and 1-2 well-placed examples.
5. Explain WHY each number matters, not just what it is. Reference Indian financial context (SIP, EPF, ELSS, term cover multiples).
6. Address the user by first name once, naturally.
7. Do not use headings, markdown tables, or emojis. Do use short paragraphs.
8. Aim for 120-180 words unless the focus is "overview" — then 180-240.`;

    const userPrompt = data.question
      ? `The user asks: "${data.question}"\n\nAnswer using ONLY the authoritative NitiCore JSON below. If the answer requires numbers not present, say so honestly and suggest opening NitiSim.\n\n${JSON.stringify(structured, null, 2)}`
      : `Explain the user's financial situation with focus="${data.focus}". Use this authoritative JSON exactly — do not modify any number:\n\n${JSON.stringify(structured, null, 2)}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        console.error("NitiGuide gateway error", res.status, await res.text().catch(() => ""));
        return { explanation: fallbackExplanation(structured), source: "fallback" };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { explanation: fallbackExplanation(structured), source: "fallback" };
      }
      return { explanation: text, source: "gemini" };
    } catch (err) {
      console.error("NitiGuide fetch failed", err);
      return { explanation: fallbackExplanation(structured), source: "fallback" };
    }
  });

function fallbackExplanation(s: {
  firstName: string;
  metrics: {
    nitiScore: { value: number; grade: string };
    nitiAge: { value: number; actual: number; delta: number };
    savingsRatePct: number;
    emergencyMonths: number;
  };
  topActions: { title: string; nextAction: string }[];
}): string {
  const m = s.metrics;
  const first = s.topActions[0];
  return `Hi ${s.firstName}. Your NitiScore is ${m.nitiScore.value}/1000 (grade ${m.nitiScore.grade}), and your financial age is ${m.nitiAge.value} vs. your actual ${m.nitiAge.actual}. You're currently saving about ${Math.round(m.savingsRatePct)}% of income, with ${m.emergencyMonths.toFixed(1)} months of expenses set aside for emergencies. ${first ? `The most valuable next move is: ${first.title} — ${first.nextAction}` : "You're in a stable position — keep automating your savings."} NitiGuide is temporarily offline, so this is a straight-from-the-numbers summary. Full explanations resume shortly.`;
}
