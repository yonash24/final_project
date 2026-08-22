# Chat recommendations

The active flow is `src/lib/ai/chat-service.ts`: structured extraction and validation happen first, deterministic eligibility is applied next, semantic similarity is used only to rank eligible activity candidates, and the model is used only for wording.

Exact ages require non-null activity age bounds. Unknown-age activities are not presented as verified matches. Hard category wording such as `רק ספורט` filters results; softer interests rank matching categories. Hebrew aliases live in `src/lib/ai/activity-taxonomy.ts`.

Apply `supabase/migrations/0017_chat_recommendation_safety.sql` after migration 0016. The checks are `NOT VALID` to avoid breaking legacy rows; validate them after data cleanup. Re-embed changed activities/events with the existing embedding seed script; embeddings are ranking data, never age authority.

Run focused tests with `npm test -- src/lib/ai/__tests__/recommendations.test.ts`, then use `npm test`, `npm run lint`, and `npm run build`.
