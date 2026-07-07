/**
 * NitiSim™ — Scenario Simulator.
 *
 * Two-phase design so NitiSim behaves like a thoughtful financial advisor,
 * not a calculator:
 *
 *   phase 1 · planSimulation
 *     Gemini reads the user's question + baseline profile + prior turns +
 *     partially-filled slots and decides:
 *       - kind="ask"        → return 1–3 targeted follow-up questions
 *       - kind="simulate"   → return finalised overrides + scenarioTitle
 *       - kind="general"    → answer as NitiGuide, no NitiCore run
 *
 *   phase 2 · runSimulation
 *     Runs NitiCore deterministically with the finalised overrides,
 *     then Gemini writes an advisor-style narrative (verdict + short/long
 *     term impact + alternatives) using ONLY the resulting numbers.
 *
 * NitiCore remains the single source of truth. Gemini never invents numbers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateNitiScore,
  calculateNitiAge,
  calculateEmergencyFund,
  calculateNetWorth,
  calculateRetirement,
  calculateSavingsRate,
  calculateDebtRatio,
  calculateInsuranceAdequacy,
  generateRecommendations,
  type NitiCoreInput,
} from "@/lib/niti-core";

// ─── Types ────────────────────────────────────────────────────────────────

const OverrideSchema = z.object({
  monthlyIncome: z.number().optional(),
  monthlyExpenses: z.number().optional(),
  monthlyEssentialExpenses: z.number().optional(),
  monthlyInvestments: z.number().optional(),
  totalAssets: z.number().optional(),
  totalLiabilities: z.number().optional(),
  monthlyEmi: z.number().optional(),
  liquidAssets: z.number().optional(),
  retirementAge: z.number().optional(),
  retirementCorpus: z.number().optional(),
  horizonMonths: z.number().optional(),
});

type Overrides = z.infer<typeof OverrideSchema>;

const SlotsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({});

const PriorTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(1000),
});

// ─── Shared helpers ───────────────────────────────────────────────────────

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

interface LoadedProfile {
  input: NitiCoreInput;
  goals: Array<{ name: string; target: number; progress: number; targetDate: string | null }>;
  topRecs: Array<{ title: string; category: string; whyItMatters: string; crossPillarNote?: string; nextAction: string }>;
  firstName: string;
}

async function loadUserProfile(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
): Promise<LoadedProfile> {
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

  const totalAssets = assets.reduce((a: number, b: { current_value?: number | null }) => a + Number(b.current_value ?? 0), 0);
  const liquidAssets = assets
    .filter((a: { is_liquid?: boolean | null }) => a.is_liquid)
    .reduce((a: number, b: { current_value?: number | null }) => a + Number(b.current_value ?? 0), 0);
  const totalLiabilities = liabs.reduce((a: number, b: { outstanding_amount?: number | null }) => a + Number(b.outstanding_amount ?? 0), 0);
  const monthlyEmi = liabs.reduce((a: number, b: { monthly_emi?: number | null }) => a + Number(b.monthly_emi ?? 0), 0);
  const termCover = insurance
    .filter((i: { insurance_type?: string | null }) => i.insurance_type === "term")
    .reduce((a: number, b: { cover_amount?: number | null }) => a + Number(b.cover_amount ?? 0), 0);

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
    hasTermInsurance: insurance.some((i: { insurance_type?: string | null }) => i.insurance_type === "term"),
    hasHealthInsurance: insurance.some((i: { insurance_type?: string | null }) => i.insurance_type === "health"),
    termCover,
    retirementCorpus: 0,
    retirementAge: Number(fp?.retirement_age ?? 60),
    riskProfile: (fp?.risk_profile as NitiCoreInput["riskProfile"]) ?? "moderate",
  };

  const recs = generateRecommendations(input);

  return {
    input,
    goals: goals.map((g: { name: string; target_amount?: number | null; current_progress?: number | null; target_date?: string | null }) => ({
      name: g.name,
      target: Number(g.target_amount ?? 0),
      progress: Number(g.current_progress ?? 0),
      targetDate: g.target_date ?? null,
    })),
    topRecs: recs.slice(0, 3).map((r) => ({
      title: r.title,
      category: r.category,
      whyItMatters: r.whyItMatters,
      crossPillarNote: r.crossPillarNote,
      nextAction: r.nextAction,
    })),
    firstName: profile?.full_name?.split(" ")[0] ?? "there",
  };
}

function snapshot(input: NitiCoreInput) {
  const score = calculateNitiScore(input);
  const age = calculateNitiAge(input);
  const emergency = calculateEmergencyFund(input);
  const netWorth = calculateNetWorth(input);
  const retirement = calculateRetirement(input);
  const savings = calculateSavingsRate(input);
  const debt = calculateDebtRatio(input);
  const insurance = calculateInsuranceAdequacy(input);
  const agePayload = age.aiPayload as { direction: "ahead" | "behind" | "on_track"; deltaYears: number } | undefined;
  return {
    nitiScore: score.value,
    grade: score.grade,
    nitiAge: age.value,
    nitiAgeDirection: agePayload?.direction ?? "on_track",
    nitiAgeDeltaYears: agePayload?.deltaYears ?? 0,
    emergencyMonths: Number(emergency.value),
    netWorth: netWorth.value,
    savingsRatePct: Number(savings.value),
    debtRatioPct: Number(debt.value),
    insuranceAdequacyPct: Number(insurance.value),
    retirementStatus: retirement.status,
    retirementGap: retirement.value,
    retirementSummary: retirement.calculationSummary,
  };
}

/**
 * Propagate a single override across related fields so metrics stay
 * internally consistent. Deterministic; does not touch NitiCore formulas.
 */
function applyOverrides(base: NitiCoreInput, o: Overrides): { input: NitiCoreInput; propagation: string[] } {
  const input: NitiCoreInput = { ...base };
  const propagation: string[] = [];
  const horizonMonths = Math.max(1, Math.min(360, o.horizonMonths ?? 12));

  if (o.monthlyIncome !== undefined) input.monthlyIncome = o.monthlyIncome;

  if (o.monthlyExpenses !== undefined) input.monthlyExpenses = o.monthlyExpenses;

  if (o.monthlyEssentialExpenses !== undefined) input.monthlyEssentialExpenses = o.monthlyEssentialExpenses;

  if (o.monthlyInvestments !== undefined) {
    const delta = o.monthlyInvestments - base.monthlyInvestments;
    input.monthlyInvestments = o.monthlyInvestments;
    // Project the extra SIP over the horizon into totalInvestments + totalAssets.
    const projected = Math.max(0, delta * horizonMonths);
    if (projected > 0) {
      input.totalInvestments = base.totalInvestments + projected;
      input.totalAssets = base.totalAssets + projected;
      propagation.push(`Projected extra SIP over ${horizonMonths} months: ₹${Math.round(projected).toLocaleString("en-IN")} added to totalInvestments and totalAssets.`);
    }
  }

  if (o.totalAssets !== undefined) input.totalAssets = o.totalAssets;
  if (o.liquidAssets !== undefined) input.liquidAssets = o.liquidAssets;

  if (o.monthlyEmi !== undefined) {
    const delta = o.monthlyEmi - base.monthlyEmi;
    input.monthlyEmi = o.monthlyEmi;
    if (o.monthlyExpenses === undefined && delta !== 0) {
      input.monthlyExpenses = Math.max(0, base.monthlyExpenses + delta);
      propagation.push(`EMI changed by ₹${Math.round(delta).toLocaleString("en-IN")}; monthlyExpenses adjusted by the same delta.`);
    }
  }

  if (o.totalLiabilities !== undefined) {
    const delta = o.totalLiabilities - base.totalLiabilities;
    input.totalLiabilities = o.totalLiabilities;
    if (o.monthlyEmi === undefined && base.totalLiabilities > 0 && delta !== 0) {
      // Proportional EMI adjustment.
      const factor = o.totalLiabilities / base.totalLiabilities;
      const newEmi = Math.max(0, base.monthlyEmi * factor);
      const emiDelta = newEmi - base.monthlyEmi;
      input.monthlyEmi = newEmi;
      if (o.monthlyExpenses === undefined) {
        input.monthlyExpenses = Math.max(0, base.monthlyExpenses + emiDelta);
      }
      propagation.push(`Liabilities scaled by ${factor.toFixed(2)}×; monthlyEmi adjusted proportionally.`);
    }
  }

  if (o.retirementAge !== undefined) input.retirementAge = o.retirementAge;
  if (o.retirementCorpus !== undefined) input.retirementCorpus = o.retirementCorpus;

  return { input, propagation };
}

// ─── planSimulation — the "think first" phase ─────────────────────────────

const PlanInput = z.object({
  question: z.string().trim().min(2).max(500),
  slots: SlotsSchema.optional().default({}),
  priorTurns: z.array(PriorTurnSchema).max(20).default([]),
});

const PlanOutputSchema = z.object({
  kind: z.enum(["ask", "simulate", "general"]),
  scenarioTitle: z.string().max(80).optional(),
  followupQuestions: z.array(z.string().max(220)).max(3).optional(),
  missingSlots: z.array(z.string().max(60)).max(6).optional(),
  overrides: OverrideSchema.optional(),
  slots: SlotsSchema.optional(),
  rationale: z.string().max(400).optional(),
  reply: z.string().max(1200).optional(),
});

export const planSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PlanInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { input: baseInput, goals, topRecs, firstName } = await loadUserProfile(supabase, userId);

    const { callAiChat, isAiConfigured } = await import("@/lib/ai-gateway");
    if (!isAiConfigured()) {
      return {
        kind: "general" as const,
        reply: "The AI planner is temporarily unavailable. Please try again in a moment.",
        slots: data.slots,
      };
    }

    const baseline = snapshot(baseInput);

    const system = `You are the reasoning layer of NitiSim, NitiVitt's financial scenario planner. Behave like a thoughtful Indian financial advisor.

Your job on this turn is to decide ONE of three things:
  1. "ask"      — the user's question is a scenario but critical information is missing. Ask up to 3 short follow-ups.
  2. "simulate" — you have enough to finalise concrete overrides and simulate. Return them.
  3. "general"  — the question is not a simulation (definition, education, opinion). Answer briefly in "reply".

Return ONLY strict JSON matching this TypeScript type — no prose, no code fences:
{
  "kind": "ask" | "simulate" | "general",
  "scenarioTitle"?: string,           // 3–8 words, required if kind="simulate"
  "followupQuestions"?: string[],     // required if kind="ask", max 3, phrased naturally
  "missingSlots"?: string[],          // machine names of the info you still need
  "overrides"?: {                     // required if kind="simulate"
    "monthlyIncome"?: number,
    "monthlyExpenses"?: number,
    "monthlyEssentialExpenses"?: number,
    "monthlyInvestments"?: number,    // ABSOLUTE new value; add to current if user said "increase SIP by X"
    "totalAssets"?: number,
    "totalLiabilities"?: number,
    "monthlyEmi"?: number,
    "liquidAssets"?: number,
    "retirementAge"?: number,
    "retirementCorpus"?: number,
    "horizonMonths"?: number          // planning horizon in months; default 12
  },
  "slots"?: object,                   // updated slot state you want persisted
  "rationale"?: string,               // one line, private note
  "reply"?: string                    // required if kind="general"
}

Rules:
- Amounts are Indian Rupees. "1 Cr" = 10000000, "20 L" = 2000000, "50k" = 50000.
- For a "buy a car / house / phone" question, you MUST know: (a) timing (when), (b) financing (loan or cash), (c) down payment %, before you can simulate. If any missing, kind="ask".
- For "increase SIP by X", finance and timing are unnecessary — you can simulate immediately with monthlyInvestments = current + X.
- If the user has already answered follow-ups in priorTurns or slots, USE that info; do not re-ask.
- Keep followupQuestions short, warm, and one topic each. Never ask more than 3.
- Never fabricate numbers. If a value is truly unknown after asking, omit that override.`;

    const userMsg = `USER'S CURRENT QUESTION: "${data.question}"

BASELINE (from NitiCore, do not modify):
${JSON.stringify(
  {
    firstName,
    ageYears: baseInput.ageYears,
    monthlyIncome: baseInput.monthlyIncome,
    monthlyExpenses: baseInput.monthlyExpenses,
    monthlyEssentialExpenses: baseInput.monthlyEssentialExpenses,
    totalAssets: baseInput.totalAssets,
    liquidAssets: baseInput.liquidAssets,
    totalLiabilities: baseInput.totalLiabilities,
    monthlyEmi: baseInput.monthlyEmi,
    hasTermInsurance: baseInput.hasTermInsurance,
    hasHealthInsurance: baseInput.hasHealthInsurance,
    retirementAge: baseInput.retirementAge,
    riskProfile: baseInput.riskProfile,
    baselineMetrics: baseline,
    goals,
    topRecommendations: topRecs,
  },
  null,
  2,
)}

PRIOR TURNS (chronological):
${JSON.stringify(data.priorTurns, null, 2)}

ALREADY-COLLECTED SLOTS:
${JSON.stringify(data.slots ?? {}, null, 2)}

Decide the correct "kind" and return JSON.`;

    const res = await callAiChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      jsonMode: true,
    });

    if (!res) {
      return {
        kind: "general" as const,
        reply: "The AI planner didn't respond. Please try again.",
        slots: data.slots,
      };
    }

    try {
      const parsed = PlanOutputSchema.safeParse(JSON.parse(res.text));
      if (!parsed.success) {
        return {
          kind: "general" as const,
          reply: "I couldn't confidently interpret that. Try rephrasing — for example: \"What if I increase my SIP by ₹5,000?\"",
          slots: data.slots,
        };
      }
      return { ...parsed.data, slots: parsed.data.slots ?? data.slots };
    } catch {
      return {
        kind: "general" as const,
        reply: "I couldn't parse a plan for that. Try rephrasing your question.",
        slots: data.slots,
      };
    }
  });

// ─── runSimulation — the "compute + explain" phase ────────────────────────

const RunInput = z.object({
  question: z.string().trim().min(2).max(500),
  scenarioTitle: z.string().max(80).default("Scenario"),
  overrides: OverrideSchema.default({}),
});

export const runSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RunInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { input: baseInput, goals, topRecs, firstName } = await loadUserProfile(supabase, userId);

    const baseline = snapshot(baseInput);
    const { input: simInput, propagation } = applyOverrides(baseInput, data.overrides);
    const simulated = snapshot(simInput);

    const { callAiChat, isAiConfigured } = await import("@/lib/ai-gateway");

    let explanation = "";
    if (isAiConfigured()) {
      const system = `You are NitiGuide, the explanation layer of NitiSim. You write like an experienced Indian financial mentor — warm, direct, and specific.

Rules — non-negotiable:
1. NEVER invent, estimate, or recalculate a number. Every figure you cite must come verbatim from the JSON below (baseline, simulated, or overrides).
2. NEVER quote raw variable names. Say "your NitiScore" not "nitiScore".
3. Use Indian ₹ formatting with lakh/crore where natural.
4. Structure the answer in exactly these sections, in this order, in markdown with bold section labels (no # headings):
   **What changes** — 1–2 sentences plain English.
   **Why the score moved** — cite which pillars gained/lost strength.
   **Short-term impact (0–12 months)** — cashflow, buffer, EMI.
   **Long-term impact (3–10 years)** — retirement, net worth, compounding.
   **Is this sensible?** — an explicit verdict considering emergency fund, insurance, debt, and current top NitiPath actions. Say "yes / it depends / not right now" clearly and explain.
   **Alternatives to consider** — 1–2 concrete options only when relevant. Skip if not needed.
5. Length: 220–320 words.
6. Address the user by first name once, near the start.
7. If overrides is empty {} or clearly incomplete, say so and suggest what to clarify.
8. If the decision would push emergency fund under 3 months, health/term insurance is missing, or debt ratio would exceed 40%, flag it explicitly under "Is this sensible?".`;

      const userMsg = `USER QUESTION: "${data.question}"
SCENARIO: "${data.scenarioTitle}"
FIRST NAME: ${firstName}

BASELINE (NitiCore): ${JSON.stringify(baseline)}
SIMULATED (NitiCore): ${JSON.stringify(simulated)}
OVERRIDES APPLIED: ${JSON.stringify(data.overrides)}
PROPAGATION NOTES: ${JSON.stringify(propagation)}
USER GOALS: ${JSON.stringify(goals)}
TOP NITIPATH ACTIONS: ${JSON.stringify(topRecs)}

Write the advisor briefing.`;

      const res = await callAiChat({
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.45,
      });
      if (res) explanation = res.text;
    }

    if (!explanation) {
      explanation = Object.keys(data.overrides).length === 0
        ? "I couldn't interpret concrete changes for that scenario. Try being more specific — e.g. \"Increase my SIP by ₹5,000 for the next 3 years\"."
        : "Simulation complete. Compare the two columns above to see the impact on your plan.";
    }

    return {
      scenarioTitle: data.scenarioTitle,
      baseline,
      simulated,
      overrides: data.overrides,
      propagation,
      explanation,
    };
  });
