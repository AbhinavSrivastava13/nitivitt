# Milestone: AI Intelligence & Product Refinement (July 2026)

Scope-preserving milestone focused on trust, intelligence, and polish. No schema or NitiCore formula changes; all additions are backward compatible.

## Shipped

1. **NitiSim™ fresh-by-default conversations** (`src/routes/_authenticated/simulator.tsx`).
   - Prior conversations no longer auto-load; a "Continue previous" affordance appears only when localStorage has content.
   - `reset()` also clears the previous-conversation flag.
   - Planner already loads latest profile + NitiCore + goals every turn — this closes the memory loop so every fresh chat starts from those three sources + the current conversation only.

2. **NitiSim explainer prompt refined for mentor tone** (`src/lib/niti-sim.functions.ts`).
   - Tightened system prompt: bans robotic wording / motivational filler, requires Indian context, and instructs the model to weave in the new `crossPillarNote` when reasoning about why the score moved.

3. **Cross-pillar reasoning in NitiPath™** (`src/lib/niti-core/recommendation-engine.ts`, `types.ts`).
   - New optional `crossPillarNote` on `Recommendation` — a plain-English note describing how the action interacts with other pillars (buffer, debt, insurance, SIP capacity).
   - `prioritiseCrossPillar` fills the note deterministically for each surviving pillar rec.
   - Surfaced in dashboard rec dialog and passed into NitiGuide + NitiSim payloads so AI narration can reference the trade-off.

4. **Services section** (`src/content/services/index.ts`, `src/routes/services.tsx`, `src/routes/services.$slug.tsx`).
   - Data-driven catalog with the same CMS-swap boundary as the Knowledge Hub.
   - Five services: Financial Advisor, Portfolio Analyzer, Insurance Analyzer, Loan Optimizer, Tax Planner — each with tagline, category, status badge (Coming Soon/Beta/Available), short description, why-it-matters, expected benefits, and detail-page vision sections.
   - Detail pages include benefits sidebar, status, and Previous/Next navigation.
   - Added to `PUBLIC_NAV` (visible in desktop + mobile hamburger + user menu for signed-in users).

5. **Knowledge Hub — Previous/Next navigation** (`src/content/knowledge/index.ts`, `src/routes/knowledge.$slug.tsx`).
   - New `getPrevNext(slug)` helper.
   - Detail page now has Previous / Next tiles at the bottom in addition to the existing "Back to Knowledge Hub" button, related-articles sidebar, share button, key takeaways, reading time, and rich markdown body.

## Deferred (out of scope this milestone)

- Real service delivery for any of the five Services cards — pages are roadmap/vision only, as requested.
- Server-side persistence for NitiSim conversations (still localStorage-only per prior milestone).
- CMS or Supabase-backed knowledge/services content — the module boundary is ready; the switch is one file.
- Additional education articles beyond the current 10.
- Personality pass on `getNitiGuideExplanation` (short focused briefings) — the long briefing prompt is already mentor-toned; the short one can be tightened in a follow-up.

## Recommended next phase

- Wire NitiSim to a "goals" quick-picker so scenarios can be tied to a stored goal and impact-tracked over time.
- Add Supabase-backed feedback capture on Services detail pages ("Notify me when this launches") — first real user-intent signal for the roadmap.
- Convert `getNitiGuideExplanation` (the short per-metric explainer) to the same section-based mentor structure used by `getNitiGuideBriefing`.
- Author 5 more Knowledge Hub articles (NPS deep-dive, Rebalancing, HRA & rent, Business owner taxation, Estate planning basics) to fill the CMS-ready shelf.
- Introduce a lightweight event log so NitiSim planning follow-ups can survive a page refresh mid-scenario.
