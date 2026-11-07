# NitiScore integrity

## Build
- Make `src/lib/niti-core/services/niti-score.ts` the only NitiScore implementation and retire the duplicate finance scorer.
- Add a shared `buildNitiCoreInput` data builder that reads each user's profile, finances, assets, liabilities, insurance, investments, and goals, including investment totals and EPF/PPF/NPS retirement corpus. Replace duplicate input assembly across dashboard, financial health, recommendations, AI guidance, simulator, and analyzer paths while preserving surface-specific context.
- Replace the placeholder Goals score with progress-versus-time scoring, priority-weighted across goals. When no goals exist, mark Goals “Not scored” and proportionally redistribute its configured weight across scored pillars.
- Replace hardcoded pillar counts and weights in homepage FAQ, dashboard score detail, How It Works, Principles, and the NitiScore knowledge article with output derived from `NITI_CORE_CONFIG.scoreWeights`.
- Treat missing date of birth as unknown rather than age 30; omit NitiAge and show an add-date-of-birth prompt where the score is presented.
- Add focused unit tests for all seven pillars, no-goal weight redistribution, and the composite score.

## Technical details
- Keep all visuals unchanged except the requested missing-date-of-birth prompt and hide behavior. Keep NitiCore formulas outside the requested score corrections unchanged.
- Use the existing authenticated data-access patterns and RLS; no schema migration is planned.
- Verify with targeted unit tests, the project TypeScript check, and the current preview build diagnostics.
