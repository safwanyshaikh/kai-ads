# TASK 2 — GPT-Native Production Readiness Audit

**Verdict: BLOCKED** — two hard blockers, three should-fix items. Nothing was
modified; production was not touched; the flag remains OFF.

## Checklist with evidence

| Area | Status | Evidence |
|---|---|---|
| Feature flag | **PASS** | `GPT_NATIVE_AD_GENERATION` defined (`src/lib/env.ts:151`, default `false`), exposed via `getFeatureFlags()` (`env.ts:205`), consumed at exactly one dispatch point (`advertisement-generation.service.ts:71`). Single-gate design; flag OFF is provably byte-identical legacy behavior (tested: `tests/gpt-native-feature-flag.test.ts`). |
| Environment variables | **PASS (with note)** | Required at runtime: `OPENAI_API_KEY` (optional in schema; absence → clean 503, see Error handling). `KAI_IMAGE_MODEL` default `gpt-image-1`, `KAI_IMAGE_QUALITY` default `high` — both read at the call site (`gpt-native-generation.service.ts:132,149`). Note: `KAI_IMAGE_SIZE` is declared but never read (dead config; dimensions come from platform formats via `nearestSupportedSize`). |
| OpenAI integration | **PASS** | Single client construction point (`openai-client.ts`), key never logged; `client.images.generate` with model/size/quality from env (`kai-creative-engine-provider.ts:49-55`); empty-response guarded (line 59-61). Size mapping covers all three GPT-Image-supported sizes with an exhaustive branch (lines 13-27). |
| Image generation path | **PASS (unit-proven only)** | Full path unit/integration-tested without live API (15 tests: commercial brief, master prompt, trust layer incl. real sharp compositing + QR re-decode from the final PNG). **Never executed against the live OpenAI API in any environment this audit can verify** — first live run is part of the rollout plan, not a code gap. |
| Rollback capability | **PASS** | Rollback = unset/false the env var; dispatch reverts to legacy instantly on next invocation. No schema changes were made (persistence uses the identical Prisma write shape; pipeline identity recorded in the freeform `AdvertisementVersion.snapshot.pipeline` field), so no migration rollback is ever needed. |
| Logging | **PASS** | Structured pino logs on success (`log.info` with pipeline tag) and failure (`log.error`), cost tracking recorded on both outcomes (`costTrackingService.record` success + failure branches), audit log on success. |
| Error handling | **PASS** | `ImageProviderNotImplementedError` (no API key) → explicit 503 with an honest message — deliberately NO deterministic fallback, because a fallback would silently violate Supreme Principle 2 (`gpt-native-generation.service.ts:152-157`). All other provider errors → cost-tracked failure + rethrow → `handleApiError` at the route. QR generation failure → cost-tracked + rethrow. |
| **Timeout handling** | **BLOCKED — Blocker 1** | The OpenAI client is constructed with SDK defaults: **timeout 600,000 ms (10 min), maxRetries 2** (verified by direct instantiation of the installed SDK). There is NO `maxDuration` route-segment config on `POST /api/advertisements/[id]/generate` and NO `vercel.json` (verified: grep found no `maxDuration` anywhere; `vercel.json` does not exist). A high-quality `gpt-image-1` call routinely runs 30–120+ s; Vercel's default serverless function duration limit will kill the function before OpenAI responds. Result in production: the API request dies with a platform timeout, the user sees a generic failure, quota is (correctly) not consumed, but the pipeline is effectively unusable for real generations. **Required before enabling: an explicit `maxDuration` on the generate route sized for image-generation latency, and an SDK-level timeout meaningfully below it so the app fails cleanly rather than being killed.** |
| **Retries** | **BLOCKED — Blocker 2 (compounding)** | SDK default `maxRetries: 2` multiplies worst-case latency ×3 against the same unconfigured function duration ceiling. There is no app-level retry policy distinguishing retryable (429/5xx) from non-retryable failures for the image call, and no idempotency guard if the client retries a request whose function was killed after the OpenAI call succeeded (cost incurred, nothing persisted). **Required: explicit, bounded retry configuration coherent with the route's duration budget.** |
| Quality/acceptance gating | **SHOULD-FIX (pre-scale)** | No Visual QA, no spelling verification, no trust-zone-cleanliness check runs on this path (the legacy `runAcceptanceLoop` is absent by design). First production outputs will be unvetted. Acceptable for a supervised pilot with a human reviewing every output; not acceptable for unsupervised production. |
| Brand intelligence | **SHOULD-FIX** | Agency Visual DNA/logo are not passed into the master prompt or trust layer (`facts` assembly lines 92-105 carries name/RA only) — Supreme Principle 10 gap; outputs will carry no agency branding beyond the trust badge. |
| Cost visibility | **SHOULD-FIX** | `estimatedCostUsd` is `null` for image calls (documented "never guess" rule) and the daily budget guard is a stub — enabling the flag begins real spend with quota as the only cap. |

## Verdict detail

**BLOCKED** until the two timeout/retry blockers are resolved (small, config-level
changes — a route `maxDuration`, an explicit SDK timeout/maxRetries — but they
are changes, and this task's mission forbids implementing them). After those
land, the recommended path is a supervised pilot (flag ON for one test agency,
human review of every output) before unsupervised production, closing the three
should-fix items during the pilot.

Nothing in this audit modified code, configuration, or production state.
