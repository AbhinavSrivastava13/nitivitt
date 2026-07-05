# NitiVitt Dashboard & AI Experience Refinement

Scope is large. Splitting into ordered, backward-compatible slices. Nothing in `src/lib/niticore/*` or migrations will change.

## 1. Dashboard layout (`src/routes/_authenticated/dashboard.tsx`)

New grid on `lg+`:

```text
+----------------------+----------------------+---------------------------+
|  NitiScore™          |  NitiAge™            |                           |
+----------------------+----------------------+     NitiPath™ (Top 3)     |
|  Net Worth           |  Emergency Fund      |     full-height column    |
+----------------------+----------------------+---------------------------+
|          NitiGuide™ (briefing)              |     NitiSim™ (chat)       |
+---------------------------------------------+---------------------------+
```

- Left: `grid-cols-2 grid-rows-2` with equal card dimensions.
- Right: NitiPath spans both rows (`row-span-2`) and matches left column's total height via `h-full`.
- Below: NitiGuide (2/3) + NitiSim (1/3), equal height row.
- Mobile: stacks linearly, preserves current order.

NitiPath card renders only top 3 recommendations. Each row shows Priority badge, Title, Why, Expected Impact, Next Action. Clicking opens the existing recommendation detail (reuse `RecommendationDetailDialog` if present, else a new `<Dialog>` inline).

## 2. Interactive hero metrics

Add a `<MetricDetailDialog>` opened by clicking any of the 4 hero cards. Contents are read from existing NitiCore outputs — no new math:

- NitiScore: score, grade, pillar breakdown, helping/hurting factors, top actions (derived from existing recommendations tagged by pillar).
- NitiAge: current age vs financial age, delta, drivers.
- Net Worth: assets total, liabilities total, top contributors from `assets`/`liabilities` tables.
- Emergency Fund: current months covered, target months, gap, monthly top-up needed (reuse existing calc).

All values come from the already-loaded snapshot; dialog is pure presentation.

## 3. NitiGuide as a briefing (not a chat)

- Remove the chat UI on the dashboard NitiGuide card and on `/ai-coach` (or repurpose that route as the standalone briefing page).
- New server function `generateNitiGuideBriefing` in `src/lib/niti-guide.functions.ts`:
  - `requireSupabaseAuth` middleware.
  - Loads profile + latest NitiCore snapshot + top recommendations.
  - Calls `google/gemini-3-flash-preview` via existing `ai-gateway` helper with a prompt encoding the "wise elder mentor" tone, Indian context, and strict instruction: **do not invent numbers; only reference values provided**.
  - Returns markdown sections: Where you stand, Your habits, Strengths, Opportunities, Impact on goals, Why your top 3 matter, What changes if you follow them.
- Cache the briefing per (user, snapshot hash) in a lightweight `niti_guide_briefings` table — only added if a table is truly needed; otherwise store on `financial_scores.briefing_markdown` via a single additive column. Prefer the additive column to avoid a new table. If schema change is judged unnecessary, keep in-memory + regenerate on Update Analysis.
- Render with `react-markdown` in the dashboard NitiGuide card (scrollable, expand-to-full-view button).

## 4. NitiSim as the only chat surface

- Dashboard card: compact composer with 4-6 example prompt chips ("Increase SIP by ₹5,000", "₹20L car next year?", "Retire at 50?", …) + "Open full simulator" link.
- `/simulator` route: full chat UI using AI Elements (`Conversation`, `Message`, `PromptInput`, `Tool`) per chat-ui-composition guidance. Assistant messages have no background; user bubble uses `bg-primary text-primary-foreground`.
- Server route `src/routes/api/nitisim.ts` (streaming):
  1. Gemini extracts structured variables via `tool` calls (`applySimulation` tool with Zod schema: `sipDelta`, `oneOffPurchase`, `newLoan`, `retirementAge`, etc.).
  2. Tool `execute` runs existing NitiCore functions on a *clone* of the snapshot with the requested overrides — no new math, just re-invoke deterministic engines with adjusted inputs.
  3. Returns before/after JSON: NitiScore, NitiAge, Net Worth, Emergency Fund months, Savings Rate, Retirement Readiness.
  4. Gemini receives the tool result and produces the plain-English "Current → What changed → Updated metrics → Explanation → Long-term impact" narrative.
- Persist per-user conversation history in a new lightweight table `nitisim_messages(user_id, thread_id, role, content, created_at, parts jsonb)` **only if** the user's existing schema doesn't already provide it; otherwise keep single-conversation history in `localStorage`. Confirm before adding the table.

## 5. Update Analysis = annual review flow

- "Update Analysis" button navigates to `/onboarding?mode=review`.
- Onboarding form reads existing values from `financial_profiles`, `assets`, `liabilities`, `goals`, `insurance`, `investments` and pre-fills every field.
- On submit: same existing NitiCore pipeline runs → dashboard, briefing, and Financial Health Report all invalidate via TanStack Query keys → `last_updated_at` on `profiles` (or `financial_profiles`) bumps.
- No new tables; reuses existing onboarding mutations.

## 6. Recommendation quality (no formula changes)

In `src/lib/niticore/recommendations.ts` (or equivalent), after the existing per-module recommendation list is produced:

- Score each recommendation by a global impact heuristic: `expectedScoreDelta × pillarWeight × urgencyFactor` where all inputs already exist on the recommendation object.
- Re-sort globally instead of per module.
- Enrich each rec with `whyItMatters`, `expectedImpact`, `nextAction` fields — these become the fields NitiPath and detail dialogs render.
- Underlying pillar scoring is untouched.

## 7. Product responsibilities enforced

- Remove any duplicated advice text from NitiGuide that overlaps NitiPath — NitiGuide narrates, NitiPath prescribes.
- Financial Health Report keeps sole ownership of full calculation transparency; dashboard detail dialogs link to it instead of duplicating tables.

## Technical notes

- Ordering to keep the app runnable at each step: (1) layout + interactive metric dialogs, (2) recommendation re-ranking + NitiPath top 3, (3) Update Analysis flow, (4) NitiGuide briefing, (5) NitiSim chat + tool-calling.
- All new server calls use `createServerFn` + `requireSupabaseAuth`; streaming NitiSim uses `/api/nitisim` server route.
- Gemini calls: `google/gemini-3-flash-preview` via existing `createLovableAiGatewayProvider`. No provider changes.
- Type-safe Zod schemas for the simulation tool; NitiCore invoked only inside tool `execute`.
- Every AI response is grounded in a JSON payload of NitiCore outputs passed as context; prompts explicitly forbid inventing numeric values.
- Backward compatibility: existing routes, auth, RLS, and NitiCore engines untouched; new features are additive.

## Open questions before I build

1. Add the new `nitisim_messages` table for persistent per-user chat history, or keep NitiSim history in `localStorage` for now?
2. Store the NitiGuide briefing (a) as an additive `briefing_markdown` column on `financial_scores`, (b) regenerate on every dashboard load with a short in-memory cache, or (c) a new `niti_guide_briefings` table?
3. For Update Analysis, should the pre-filled onboarding be the exact existing multi-step flow reused as-is, or a single consolidated "review" page? Reuse is faster and safer; consolidated is a bigger UI change.

Please confirm (or answer the three questions) and I will implement in the order above.
