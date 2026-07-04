/**
 * NitiSim™ — Scenario Simulator.
 *
 * Contract:
 *   client → server fn (auth-gated) →
 *   server loads the user's real profile (RLS) →
 *   Gemini extracts STRUCTURED variable overrides from the user's question →
 *   NitiCore recomputes with the overrides →
 *   Gemini explains the delta in plain English.
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
  type NitiCoreInput,
} from "@/lib/niti-core";

const InputSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

function ageFromDob(dob: string | null): number {
  if (!dob) return 30;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

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
  scenarioTitle: z.string().max(80).optional(),
});

function snapshot(input: NitiCoreInput) {
  const score = calculateNitiScore(input);
  const age = calculateNitiAge(input);
  const emergency = calculateEmergencyFund(input);
  const netWorth = calculateNetWorth(input);
  const retirement = calculateRetirement(input);
  const savings = calculateSavingsRate(input);
  const debt = calculateDebtRatio(input);
  return {
    nitiScore: score.value,
    grade: score.grade,
    nitiAge: age.value,
    emergencyMonths: Number(emergency.value),
    netWorth: netWorth.value,
    savingsRatePct: Number(savings.value),
    debtRatioPct: Number(debt.value),
    retirementStatus: retirement.status,
    retirementGap: retirement.value,
    retirementSummary: retirement.calculationSummary,
  };
}

export const runSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Pull the user's real financial profile via RLS.
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
    const termCover = insurance.filter((i) => i.insurance_type === "term")
      .reduce((a, b) => a + Number(b.cover_amount ?? 0), 0);

    const baseInput: NitiCoreInput = {
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

    const baseline = snapshot(baseInput);

    // 2) Ask the AI layer to translate the natural-language question into structured
    //    variable overrides — nothing else.
    const { callAiChat, isAiConfigured } = await import("@/lib/ai-gateway");
    const aiOn = isAiConfigured();
    let overrides: z.infer<typeof OverrideSchema> = {};
    let scenarioTitle = data.question.slice(0, 60);
    let interpretationNote: string | null = null;

    if (aiOn) {
      const extractionPrompt = `You are the variable extractor for NitiSim, NitiVitt's scenario simulator.

Return ONLY a JSON object matching this TypeScript type — no prose, no code fences:
{
  "scenarioTitle": string,        // 3-8 word title for the scenario
  "monthlyIncome"?: number,       // INR, ABSOLUTE new value (not delta)
  "monthlyExpenses"?: number,
  "monthlyEssentialExpenses"?: number,
  "monthlyInvestments"?: number,  // additional monthly investment / SIP
  "totalAssets"?: number,
  "totalLiabilities"?: number,
  "monthlyEmi"?: number,
  "liquidAssets"?: number,
  "retirementAge"?: number,       // years
  "retirementCorpus"?: number     // current corpus INR
}

Rules:
- Compute deltas against the user's baseline (given below) and RETURN THE NEW ABSOLUTE VALUES only for fields the user actually changed. Omit unchanged fields.
- Amounts are Indian Rupees. Interpret "1 Cr" as 10000000, "5L" as 500000, "50k" as 50000.
- If the user says "SIP by 3000", set monthlyInvestments = current(0) + 3000 = 3000 unless they specified otherwise.
- If the question is not a simulation (it's a general question), return {"scenarioTitle": "Not a simulation"}.

User baseline (INR): ${JSON.stringify({
        monthlyIncome: baseInput.monthlyIncome,
        monthlyExpenses: baseInput.monthlyExpenses,
        monthlyEssentialExpenses: baseInput.monthlyEssentialExpenses,
        totalAssets: baseInput.totalAssets,
        totalLiabilities: baseInput.totalLiabilities,
        monthlyEmi: baseInput.monthlyEmi,
        liquidAssets: baseInput.liquidAssets,
        retirementAge: baseInput.retirementAge,
        ageYears: baseInput.ageYears,
      })}

User question: "${data.question}"`;

      const extraction = await callAiChat({
        messages: [
          { role: "system", content: "You return only strict JSON. No prose." },
          { role: "user", content: extractionPrompt },
        ],
        temperature: 0.1,
        jsonMode: true,
      });
      if (extraction) {
        try {
          const parsed = OverrideSchema.safeParse(JSON.parse(extraction.text));
          if (parsed.success) {
            overrides = parsed.data;
            if (parsed.data.scenarioTitle) scenarioTitle = parsed.data.scenarioTitle;
          } else {
            interpretationNote = "Could not confidently interpret the scenario. Showing your baseline unchanged.";
          }
        } catch {
          interpretationNote = "Could not confidently interpret the scenario. Showing your baseline unchanged.";
        }
      } else {
        interpretationNote = "Scenario extraction unavailable. Showing your baseline unchanged.";
      }
    } else {
      interpretationNote = "AI extraction not configured — showing baseline unchanged.";
    }

    // 3) Apply overrides deterministically.
    const simulatedInput: NitiCoreInput = { ...baseInput };
    if (overrides.monthlyIncome !== undefined) simulatedInput.monthlyIncome = overrides.monthlyIncome;
    if (overrides.monthlyExpenses !== undefined) simulatedInput.monthlyExpenses = overrides.monthlyExpenses;
    if (overrides.monthlyEssentialExpenses !== undefined) simulatedInput.monthlyEssentialExpenses = overrides.monthlyEssentialExpenses;
    if (overrides.monthlyInvestments !== undefined) simulatedInput.monthlyInvestments = overrides.monthlyInvestments;
    if (overrides.totalAssets !== undefined) simulatedInput.totalAssets = overrides.totalAssets;
    if (overrides.totalLiabilities !== undefined) simulatedInput.totalLiabilities = overrides.totalLiabilities;
    if (overrides.monthlyEmi !== undefined) simulatedInput.monthlyEmi = overrides.monthlyEmi;
    if (overrides.liquidAssets !== undefined) simulatedInput.liquidAssets = overrides.liquidAssets;
    if (overrides.retirementAge !== undefined) simulatedInput.retirementAge = overrides.retirementAge;
    if (overrides.retirementCorpus !== undefined) simulatedInput.retirementCorpus = overrides.retirementCorpus;

    const simulated = snapshot(simulatedInput);

    // 4) Ask the AI layer to explain the delta in plain English — using ONLY these numbers.
    let explanation = "";
    if (aiOn) {
      const explainPrompt = `You are NitiGuide, the AI explanation layer of NitiVitt.

The user asked NitiSim: "${data.question}"

NitiCore (deterministic engine) computed these authoritative numbers. You must not modify any of them.

BASELINE: ${JSON.stringify(baseline)}
SIMULATED (${scenarioTitle}): ${JSON.stringify(simulated)}
OVERRIDES APPLIED: ${JSON.stringify(overrides)}

Explain in 130-200 words:
1. What changed (in plain English).
2. How the key metrics moved (NitiScore, NitiAge, emergency fund, retirement).
3. One concrete next step the user could take.

Rules:
- Never quote a number that isn't in the JSON above.
- Warm, professional tone. No headings, no emojis, no markdown tables.
- Use ₹ formatting with Indian conventions.
- If overrides is empty {}, say the scenario couldn't be interpreted and suggest a clearer prompt.`;

      const explain = await callAiChat({
        messages: [
          { role: "system", content: "Explain NitiCore output. Never compute. Never invent numbers." },
          { role: "user", content: explainPrompt },
        ],
        temperature: 0.4,
      });
      if (explain) explanation = explain.text;
    }

    if (!explanation) {
      explanation = interpretationNote ?? "Simulation complete. Compare the two columns above to see the impact on your plan.";
    }

    return {
      scenarioTitle,
      baseline,
      simulated,
      overrides,
      explanation,
      interpretationNote,
    };
  });
