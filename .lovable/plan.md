
# NitiVitt — Intelligence & Product Logic Refinement

Scope-preserving milestone. No UI redesign, no schema changes, no NitiCore™ formula changes. Every change is additive or a targeted logic fix.

## 1. NitiAge™ — semantics fix

**Problem:** `financialAge = actualAge + adjust`. When `adjust < 0` financialAge < actualAge — that means the user is *ahead*, not behind. UI copy today can invert this.

**Fix (single source of truth in `services/niti-age.ts`):**
- Keep the math. Add `aiPayload.delta` (already there) and add explicit fields:
  - `direction: "ahead" | "behind" | "on_track"`
  - `deltaYears: number` (always positive; sign encoded in `direction`)
  - `interpretation: string` explaining "Financial Age = actual age adjusted by habits (savings, emergency fund, debt, insurance, investing). Lower = healthier."
- Every consumer (dashboard hero card, metric dialog, financial-health page, NitiSim snapshot) reads `direction`/`deltaYears` instead of recomputing sign. Green for `ahead`, amber for `on_track`, red for `behind`.

## 2. NitiSim™ — reason-before-simulate

**New behavior:** NitiSim runs a lightweight conversational planner turn before any simulation.

Flow per user question:
1. Server fn `interpretSimQuestion` (Gemini) receives: question + baseline profile + last N turns + already-collected slots.
2. Returns one of:
   - `{ kind: "ask", questions: string[], missingSlots: string[] }` — up to 3 targeted follow-ups.
   - `{ kind: "simulate", overrides, scenarioTitle, rationale }` — enough info gathered.
   - `{ kind: "not_a_simulation", reply }` — general question → Gemini answers using NitiGuide tone, no NitiCore run.
3. Only on `simulate` do we call NitiCore and produce before/after snapshots.

**Client changes (`simulator.tsx`):**
- `ChatTurn` union gains `assistant-question` (renders follow-up chips the user can tap).
- Slot state (`Record<string, unknown>`) stored per conversation in localStorage alongside history so partially-answered scenarios survive reload.
- "Reset scenario" clears slots + turns.

**Server changes (`niti-sim.functions.ts`):**
- Split into two exported server fns: `planSimulation` (interpret) and `runSimulation` (deterministic + explain). `runSimulation` keeps existing signature but now accepts finalized `overrides` from the planner; it no longer does its own extraction.
- Full profile is loaded once per call: profiles, financial_profiles, assets, liabilities, insurance, and additionally `goals`, `recommendations` (existing tables — read-only), passed to both the planner and the explainer as context.

## 3. NitiSim explanations — advisor tone

New explainer prompt structure. Gemini receives baseline, simulated, overrides, user's goals, existing top recommendations, and the direction/severity of each metric delta. Output sections (markdown, ~180–260 words):
- **What changes** — plain English restatement.
- **Why the score moved** — cites the pillars that shifted.
- **Short-term impact** (0–12 mo) and **long-term impact** (3–10 yr).
- **Is this a sensible decision?** — explicit verdict considering emergency fund adequacy, debt load, retirement gap.
- **Alternatives worth considering** — 1–2 options when relevant.

Guardrails unchanged: Gemini never invents numbers; only quotes values from the JSON payload.

## 4. NitiSim context-awareness

Add to the payload sent to the explainer:
- Emergency fund months (baseline & simulated), debt ratio, savings rate, retirement gap/status.
- Top 3 open recommendations from NitiPath™.
- Active goals with target amounts & horizons (if any rows in `goals`).

Explainer prompt instructs Gemini to weigh the decision against these — e.g. "if buying reduces emergency fund below 3 months, flag it".

## 5. NitiGuide™ — mentor briefing quality

Keep briefing (non-chat) shape. Rewrite the prompt in `niti-guide.functions.ts` to produce these sections instead of metric restatement:
1. **Overall assessment** (2–3 sentences)
2. **Strengths** (bulleted, referencing the pillar names)
3. **Areas needing attention** (bulleted, with the *why*)
4. **Behavioural observations** (Indian financial context — e.g. FD-heavy allocation, under-insurance, EMI stacking)
5. **Goal progress** (only if goals exist)
6. **What to do next** (mirrors top 3 NitiPath recs, but explains *why they matter* and *what improves* if acted on)
7. **Encouragement** (1 short paragraph)

Cache key stays `(userId, snapshotHash)`, TTL 30 min client-side.

## 6. NitiCore™ recommendations — cross-pillar prioritisation

In `recommendation-engine.ts`, add a post-processing pass that re-ranks the already-generated recs:
- **Foundational-first rule:** if emergency fund < 3 months OR no health insurance OR no term insurance (with dependents), any recommendation from those pillars is boosted above investment/retirement recs regardless of raw impactScore.
- **Debt-before-invest rule:** if debt ratio > 40% and there's a high-interest liability, debt-reduction recs outrank new-SIP recs.
- **Dampen redundancy:** if two recs from the same pillar would appear in the top 3, keep the highest-impact one and demote the sibling.

No formula changes; only a deterministic sort/boost layer with clear priority tiers.

## 7. Simulation accuracy — propagation audit

Extend override handling in `runSimulation` so a single change propagates cleanly:
- `monthlyInvestments` delta increments a projected `totalInvestments` (delta × months to a 12-month horizon) and adds to `totalAssets` for the simulated snapshot only.
- `monthlyEmi` change adjusts `monthlyExpenses` if the user didn't supply an expense override.
- `totalLiabilities` change adjusts `monthlyEmi` proportionally when the planner infers a loan structure.
- `retirementCorpus`/`retirementAge` flow into `calculateRetirement` unchanged.

All propagation is deterministic and documented in `aiPayload.propagation` for transparency.

## 8. Knowledge Hub — data-driven education library

**Architecture (future-CMS-ready):**
```text
src/content/knowledge/
├── types.ts                  // Article, ArticleSummary, Category
├── articles.ts               // static array today; swappable for a fetch()
└── articles/
    ├── understanding-nitiscore.ts
    ├── understanding-nitiage.ts
    ├── emergency-fund.ts
    ├── mutual-funds-vs-fd.ts
    ├── sip-for-beginners.ts
    ├── retirement-planning-india.ts
    ├── insurance-planning.ts
    ├── home-loan-vs-renting.ts
    ├── tax-saving-basics.ts
    └── common-mistakes.ts
```

`Article` type:
```ts
type Article = {
  slug: string; title: string; subtitle: string;
  category: string; readingMinutes: number;
  updatedAt: string; author: string; coverImage?: string;
  summary: string;
  sections: Array<{ heading: string; body: string /* markdown */ }>;
  keyTakeaways: string[];
  relatedSlugs: string[];
};
```

A single `getArticles()` / `getArticleBySlug(slug)` module boundary — swapping to Supabase or a headless CMS later is a one-file change.

**Routes:**
- `src/routes/knowledge.tsx` — rewritten as a filterable card grid. Each card fully clickable, shows cover / category / title / summary / reading time / updated date.
- `src/routes/knowledge.$slug.tsx` — article detail: hero (title, subtitle, meta), markdown body via `react-markdown`, key takeaways card, related articles, share button (`navigator.share` + copy-link fallback), Back to Knowledge Hub.
- Per-route `head()` with unique title/description/og for each article slug.

**Content:** 10 articles as listed, written for Indian users, ~600–900 words each, structured with headings.

**Product boundary:** Knowledge Hub answers "teach me about personal finance" — no personalized data reads, no NitiCore calls. Cross-links to NitiGuide/NitiSim for personalization prompts.

## 9. Consistency sweep

After the changes above, one pass across dashboard, financial-health, recommendations, retirement, emergency-fund, net-worth, ai-coach, simulator to make sure:
- NitiAge status label matches direction everywhere.
- Terminology unified: "NitiScore™", "NitiAge™", "NitiPath™", "NitiSim™", "NitiGuide™".
- Colours: green = healthy/ahead, amber = attention, red = critical/behind — no inversions.

## Technical notes

- No DB schema changes. Reads only from existing tables (`profiles`, `financial_profiles`, `assets`, `liabilities`, `insurance`, `goals`, `recommendations`).
- All AI calls stay on the server via `createServerFn` + `requireSupabaseAuth` (already wired).
- Model unchanged: `google/gemini-3-flash-preview` via existing `ai-gateway.ts`.
- NitiCore formulas untouched; only additive fields on results and a re-rank layer on recommendations.
- NitiSim state (turns + slots) persists in localStorage only — no server persistence added this milestone.

## Order of execution

1. NitiAge semantics + all consumer sites (small, unblocks display consistency).
2. Recommendation re-rank layer.
3. NitiSim planner split + explainer rewrite + propagation.
4. NitiGuide prompt rewrite.
5. Knowledge Hub content module + list route + detail route + 10 articles.
6. Consistency sweep + manual smoke via preview.
