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

    // 4) Call the AI layer (Lovable Gateway or Gemini direct — auto-detected).
    const { callAiChat, isAiConfigured } = await import("@/lib/ai-gateway");
    if (!isAiConfigured()) {
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

    const result = await callAiChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    if (!result) {
      return { explanation: fallbackExplanation(structured), source: "fallback" };
    }
    return { explanation: result.text, source: result.provider };
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

/**
 * NitiGuide™ briefing — the "elder-brother explanation".
 *
 * Not a chatbot. Given the user's real NitiCore snapshot, this returns a
 * warm, mentor-style briefing in markdown covering:
 *   1. Where they stand.
 *   2. Their habits.
 *   3. Their strengths.
 *   4. Their opportunities.
 *   5. Why the top 3 NitiPath actions matter.
 *   6. What positive outcomes to expect if they act.
 *
 * All numbers come from NitiCore; the AI only translates.
 */
const BriefingInput = z.object({}).optional();

export const getNitiGuideBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => BriefingInput.parse(v) ?? {})
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

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

    const totalAssets = assets.reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const liquidAssets = assets.filter((a) => a.is_liquid).reduce((a, b) => a + Number(b.current_value ?? 0), 0);
    const totalLiabilities = liabs.reduce((a, b) => a + Number(b.outstanding_amount ?? 0), 0);
    const monthlyEmi = liabs.reduce((a, b) => a + Number(b.monthly_emi ?? 0), 0);
    const termCover = insurance.filter((i) => i.insurance_type === "term")
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

    const input: NitiCoreInput = {
      ageYears: ageFromDob(profile?.date_of_birth ?? null),
      monthlyIncome: Number(fp?.monthly_income ?? 0),
      monthlyExpenses: Number(fp?.monthly_expenses ?? 0),
      monthlyEssentialExpenses: Number(fp?.monthly_essential_expenses ?? 0),
      liquidAssets, totalAssets, totalLiabilities, monthlyEmi,
      monthlyInvestments: 0, totalInvestments: 0,
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

    const firstName = profile?.full_name?.split(" ")[0] ?? "there";
    const payload = {
      firstName,
      ageYears: input.ageYears,
      monthlyIncome: input.monthlyIncome,
      monthlyExpenses: input.monthlyExpenses,
      metrics: {
        nitiScore: { value: score.value, grade: score.grade, breakdown: score.breakdown.map((b) => ({ pillar: b.pillar, score: Math.round(b.pillarScore) })) },
        nitiAge: { value: age.value, actual: input.ageYears, delta: age.value - input.ageYears },
        netWorth: netWorth.value,
        totalAssets, totalLiabilities,
        savingsRatePct: Number(savings.value),
        emergencyMonths: Number(emergency.value),
        debtRatioPct: Number(debt.value),
        retirement: { status: retirement.status, summary: retirement.calculationSummary },
        insurance: { adequacyPct: insAdequacy.value, hasTerm: input.hasTermInsurance, hasHealth: input.hasHealthInsurance, termCover },
      },
      topActions: recs.slice(0, 3).map((r) => ({
        title: r.title,
        priority: r.priority,
        category: r.category,
        whyItMatters: r.whyItMatters,
        expectedImpact: r.expectedImpact,
        nextAction: r.nextAction,
      })),
      goalCount: goals.length,
      goals: goals.slice(0, 5).map((g) => ({ name: g.name, target: Number(g.target_amount ?? 0), progress: Number(g.current_progress ?? 0), targetDate: g.target_date })),
    };

    const { callAiChat, isAiConfigured } = await import("@/lib/ai-gateway");
    if (!isAiConfigured()) {
      return { markdown: briefingFallback(payload), source: "fallback", generatedAt: new Date().toISOString() };
    }

    const systemPrompt = `You are NitiGuide, the "trusted mentor" financial reviewer inside NitiVitt. You are NOT a chatbot — you produce a personalised written briefing the user reads once, like a thoughtful review from an experienced Indian financial planner sitting across the table.

Non-negotiable rules:
1. Every number you cite MUST come from the JSON provided. You NEVER invent, estimate, or recalculate.
2. Do NOT restate the dashboard verbatim (avoid "your score is X, your age is Y" openers). Interpret the pattern — what it says about how the user actually behaves with money.
3. Do NOT just repeat the NitiPath™ action titles. Explain WHY each of the top 3 matters for THIS person and what genuinely improves if they act.
4. Warm, professional, encouraging. No sales language. No emojis. No H1/H2 markdown headings. Use **bold section labels** inline at the start of each paragraph.
5. Respect Indian context: joint families, dependents, salaried vs self-employed, EMI culture, FD/gold bias, PPF/EPF/ELSS/SIP behaviour, insurance under-coverage, retirement anxiety.
6. Address them by first name once, near the start.
7. Return Markdown paragraphs, no JSON, no code fences.

Structure — use these six sections in order, each 2–4 sentences:

**Overall assessment.** A calm, honest read of where they stand and what the numbers together say. Not a metric restatement.

**Strengths.** What they're clearly getting right, referencing pillar names naturally (Savings, Emergency, Debt, Insurance, Investments, Retirement). Give them credit specifically.

**Areas needing attention.** The 1–2 places behaviour is quietly costing them, with the *why*. Be direct without being harsh.

**Behavioural observations.** Patterns you notice — e.g. buffer-heavy but under-invested, high EMI-to-income, under-insured for dependents, FD-heavy allocation, retirement gap on autopilot. Ground each observation in the JSON.

**What to do next.** Walk through the top NitiPath™ actions one by one — why each matters for THIS person and what improves (a pillar, a metric, a future outcome) if they act. Do NOT list; write as flowing prose.

**Where this leads.** A short, hopeful projection of what following through looks like 3–5 years out. Encouraging, specific, and anchored to their pillars.

Length: 380–520 words total.`;

    const userPrompt = `Write the briefing using ONLY these authoritative NitiCore numbers. Do not modify any value.\n\n${JSON.stringify(payload, null, 2)}`;

    const result = await callAiChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.55,
    });

    if (!result) {
      return { markdown: briefingFallback(payload), source: "fallback", generatedAt: new Date().toISOString() };
    }
    return { markdown: result.text, source: result.provider, generatedAt: new Date().toISOString() };
  });

function briefingFallback(p: {
  firstName: string;
  metrics: {
    nitiScore: { value: number; grade: string };
    nitiAge: { value: number; actual: number; delta: number };
    savingsRatePct: number;
    emergencyMonths: number;
  };
  topActions: { title: string; whyItMatters: string }[];
}): string {
  const m = p.metrics;
  const lines = [
    `Hi ${p.firstName}, here's how your financial life is shaping up right now.`,
    `Your NitiScore of ${m.nitiScore.value}/1000 (grade ${m.nitiScore.grade}) and financial age of ${m.nitiAge.value} against your actual ${m.nitiAge.actual} tell a clear story: your habits are ${m.nitiAge.delta <= 0 ? "already ahead of your years — you're building the discipline that most people take a decade to develop." : "still catching up with where they need to be — that's normal, and completely fixable."}`,
    `You're saving about ${Math.round(m.savingsRatePct)}% of your income and keep ${m.emergencyMonths.toFixed(1)} months of expenses aside for emergencies. That is the base your future decisions will rest on.`,
    p.topActions.length
      ? `The three moves that will move the needle most for you next are focused on: ${p.topActions.map((a) => a.title).join("; ")}. Each one is chosen because it protects or compounds every rupee that follows.`
      : `You're clear of critical actions right now — the priority becomes protecting and compounding what you already have.`,
    `NitiGuide is temporarily offline for the full narrative, but the numbers above are your real NitiCore snapshot. Take the top action first — the rest cascades from there.`,
  ];
  return lines.join("\n\n");
}

