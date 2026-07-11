# SPRINT_004_FINAL.md

**Status: Complete, with one honestly-scoped-out piece (Visual style full composition — see "What was not built").**

---

## What shipped

### Database (extends Sprint 002/003 tables, no parallel schema)

- `Advertisement` gained: `platformFormat`, `density`, `generatedAssetUrl`, `badgeConfig`, `trustStatus`, `trustWarnings`.
- `AdvertisementVersion` gained: `changedSection`, `regenerationMethod`, `previousSectionData`, `newSectionData` — the Critical Editing USP's audit trail.
- `AiUsageLog` gained: `imageSize`, `imageQuality`, `billable`, `advertisementId`, `advertisementVersionId` — reused for image generation cost tracking, not a parallel table.
- New: `AgencyVerification` (1:1 with Agency), `AgencyGenerationQuota` (1:1 with Agency, the Bootstrap Trial Quota), `QrScanEvent` (privacy-preserving scan intelligence).
- New enums: `AdvertisementDensity`, `AdvertisementSection`, `RegenerationMethod`, `AdvertisementTrustStatus`, `AgencyVerificationStatus`, and five new `AiOperationType` values.
- Migration `prisma/migrations/20260401000000_generation_engine_trust_qr/`, applied and verified against the same real PostgreSQL 16 instance used since Sprint 001's fix pass.

### ADR-006: Advertisement Rendering Architecture

Required by the brief before building the renderer. Decision: AI-generated background/decorative imagery + deterministic SVG composition for all factual text (positions, salary, phone numbers, RA license number, QR, badge) — never full-image AI generation of the whole poster. Full rationale, including why this is the only architecture that can honestly satisfy "block ready status if the QR doesn't decode" and "never claim isolated regional editing," is in `decisions/ADR-006 Advertisement Rendering Architecture.md`.

### Advertisement Generation Flow

`src/server/services/advertisement-generation.service.ts` — `generate()` runs the full flow in one call: quota/kill-switch check → density classification → type recommendation (or explicit override) → badge selection → QR generation + self-decode-verification → deterministic section composition → trust check → version + history + audit log, all in one transaction where the writes need to be atomic. `regenerateSection()` is the Critical Editing USP: edits exactly one section, leaves everything else untouched, and records `changedSection`/`previousSectionData`/`newSectionData`/`regenerationMethod` on the new version — not a vague "regenerated" flag.

### Density / Type / Theme / Badge Intelligence

Four small, independently unit-tested modules under `src/server/generation/`:
- `density-classification.service.ts` — LOW/MEDIUM/HIGH from total headcount + distinct position count (not just position count alone — see the file's own comment for why).
- `advertisement-type-recommendation.service.ts` — never recommends Visual for HIGH density; urgent/salary-focused → Typography; a single low-density requirement → Visual. Always a recommendation, never a hard constraint (the API accepts an explicit `style` override).
- `theme-recommendation.service.ts` — 10 named theme families exactly matching the brief's minimum list; recruiters pick a name, never a hex code or font name.
- `badge-selection.service.ts` — shape/size chosen from style/density/position-count/platform, never manually designed by the recruiter.

### Unified Verification QR Badge — real, not simulated

`src/server/generation/qr-renderer.ts` generates a real QR PNG (`qrcode` package) and immediately decodes that exact PNG with a real reader (`jsqr` + `pngjs` for raw pixels) before returning. `trust-validation.service.ts` blocks `TRUST_READY` if that decode fails or doesn't match the encoded payload — this is the literal, tested implementation of "if KAI cannot decode its own generated QR: BLOCK READY STATUS," not a policy statement. The QR encodes only a KAI tracking URL (`{KAI_PUBLIC_DOMAIN}/v/{agencyVerificationId}?a={advertisementId}`), never the official government destination directly (verified by a dedicated test).

### QR Redirect Flow

`src/app/v/[agencyVerificationId]/route.ts` — public, rate-limited, no candidate login. Records a privacy-preserving `QrScanEvent` (approximate geography from request headers, coarse device category from user-agent, no raw IP, no candidate identity) and redirects immediately to the agency's official verification URL. Falls back to a minimal honest status page ("temporarily unavailable... try again later") if the destination isn't set — never a false verification claim.

### Critical Legal Language / Government Branding Restriction

`src/server/generation/prohibited-claims.service.ts` — every phrase explicitly listed as prohibited in the brief is detected (case-insensitive) and blocks `TRUST_READY`; every explicitly-allowed phrase is confirmed clean. Government emblem/seal references are checked separately. 13 phrase-level tests plus the trust-check integration tests confirm this end to end.

### Agency Verification Workflow

`src/server/services/agency-verification.service.ts` + `/api/agency-verifications*` (KAI Super Admin only, reusing the `agency:verify` RBAC permission and the existing `AuditLog`) + a minimal admin UI at `/admin/agency-verifications`. Verify / suspend / restore (→ `REVERIFICATION_REQUIRED`, not silently back to fully trusted) / require-reverification, each audit-logged.

### Bootstrap Trial Quota + Cost Control

`src/server/services/generation-quota.service.ts` — 10 free generations per **agency** (verified by a dedicated integration test: two different employees of the same agency increment the same counter), a real `AI_KILL_SWITCH` env-driven gate, and an honestly-labeled stub for the daily budget guard (returns true today; no real-time spend aggregation is wired up yet — stated plainly in the code comment rather than implied to work). Every generation operation — success and failure — is recorded to `AiUsageLog` with a `billable` flag that's `false` for failed operations, so "don't charge for system failures" is enforced by data, not by convention.

### KAI Creative Engine (image generation) — architecture, not full composition

`src/server/ai/image/` follows the exact Sprint 002/003 pattern: an interface, a `NotImplementedImageProvider`, and a real `KaiCreativeEngineProvider` implementing the actual OpenAI GPT Image API (`client.images.generate`). `advertisementGenerationService.generate()` genuinely calls this provider for the Visual style — it doesn't hardcode a rejection string. If `OPENAI_API_KEY` is set, it actually attempts background generation; if that succeeds, generation still stops with an honest "composition isn't wired up yet" error rather than pretending to produce a finished Visual advertisement (see "What was not built").

## Self-audit findings and fixes

| Category | Finding | Fix |
|---|---|---|
| Code Quality | `GenerateAdvertisementInput` was defined twice — once as a Zod-inferred type, once as a hand-written interface with the same name and shape, in two different files | Removed the duplicate interface; the service now imports the single Zod-derived type |
| Architecture / Dependency | `getImageGenerationProvider()` (the real KAI Creative Engine factory) was built but never called anywhere — dead code | `generate()`'s Visual-style path now genuinely calls it and surfaces its real error, instead of a hardcoded rejection message that never touched the actual architecture |
| Code Quality | 17 more types/interfaces exported with zero external consumers, following the same rule enforced in every prior sprint | De-exported |
| Security | `regenerateSection()`'s value-resolution silently fell back to "the first value in the request body" if the exact expected field key was missing — a request could accidentally (or deliberately) write an unrelated value into a section | Now requires the exact expected key and fails with a clear 400 if it's absent |
| Security | The public `/v/[agencyVerificationId]` QR redirect endpoint had no rate limit — a bot could flood `QrScanEvent` rows or probe ID combinations | Added a 120/hour-per-IP limit; falls back to the same honest status page rather than a raw 429 (a scanning phone shouldn't see an API error) |

Lint: 0 problems. Typecheck: 76 errors, all the same `@prisma/client` type-resolution category as every prior sprint (see below) — zero of any other kind. Build: webpack compiles successfully; final build fails at the same documented stage.

## Test Review

**214/214 tests passing across 27 files** (up from 140/16 at the end of Sprint 003). New this sprint: 12 integration tests (real PostgreSQL — Agency Verification, shared agency-level quota, billable-vs-not AiUsageLog rows, Critical Editing USP version tracking, tenant isolation across two agencies, the QR-URL-never-contains-the-real-destination check) plus unit tests for every pure-logic module (density, type recommendation, theme recommendation, badge selection, prohibited claims, trust check, section renderer, the image provider architecture) and — genuinely, not mocked — QR generation and decode self-verification against the real `qrcode`/`jsqr`/`pngjs` libraries.

## Known limitations, stated plainly

1. **Same Prisma-generate / OpenAI-network gap as every prior sprint.** `binaries.prisma.sh` and `api.openai.com` are both outside this sandbox's network allowlist, and no `OPENAI_API_KEY` is available here regardless. The `KaiCreativeEngineProvider` is a real, complete implementation against the documented OpenAI SDK API — it has never executed against a live model in this sandbox, exactly like Sprint 003's text extraction provider before its external verification.
2. **Visual style composition is genuinely not built.** Per ADR-006's own "Consequences" section: this sprint ships the deterministic Typography/Newspaper renderer completely (real SVG, real QR, real badge, all passing automated decode verification) and the KAI Creative Engine's background-generation call for real — but the step that would combine a generated background image with the deterministic text/QR/badge layers into one finished Visual advertisement is not implemented. Requesting Visual generation returns a clear, honest error rather than a broken or fake result, whether or not OpenAI is configured.
3. **The daily AI budget guard is a stub**, explicitly labeled as such in the code (`generation-quota.service.ts`). The kill switch is real and enforced; the spend-aggregation math it would need is not built yet.
4. **No theme-picker or badge-preview UI component was built** — the theme/badge selection logic is real, tested, and reachable via API (`/api/theme-families`, and `badgeConfig` returned from generation), but there's no dedicated UI for a recruiter to browse theme families before generating. The Generation panel added to the Advertisement Detail page covers platform selection, generation, trust status, and the generated preview.
5. **Geo/device signals on QR scans** are read from request headers (`x-vercel-ip-country` etc.) that are only populated on some hosting platforms — on others, `countryCode`/`region`/`city` will simply be `null` for every scan, which is honest (never fabricated) but means that data is platform-dependent, not universal.

## Definition of Done

- [x] SPRINT_004.md created and read before coding; ADR-006 written before implementing the renderer
- [x] No Sprint 001–003 code reopened; extended existing schema/services/providers throughout (Advertisement, AdvertisementVersion, AiUsageLog, AuditLog, RBAC, rate-limit, pagination, cost-estimation all reused, not duplicated)
- [x] Advertisement Generation Flow implemented end-to-end for Typography/Newspaper; Visual is real architecture with an honest "not fully wired" stop
- [x] Density Intelligence, Type Recommendation, Theme Intelligence, Platform Formats (centralized, extensible registry) — all real and tested
- [x] KAI Creative Engine architecture — real interface, real OpenAI implementation, genuinely called (not dead code), Null stand-in when unconfigured, product-facing name never leaks the provider
- [x] Image Generation Cost Control — reuses AiUsageLog, `billable` distinguishes success from system failure
- [x] Bootstrap Trial Quota — agency-level (verified by test), kill switch real, budget guard honestly stubbed
- [x] Section-Based Architecture + Critical Editing USP — one section changes, everything else is provably untouched, tracked with before/after data and method
- [x] Unified Verification QR Badge — one badge, not two; correct allowed/prohibited language; no government emblem imitation
- [x] QR Architecture — tracking URL only, never the real destination directly; existing QRs survive a destination change
- [x] Agency Verification Workflow — full CRUD-equivalent (verify/suspend/restore/require-reverification), audit-logged, KAI Super Admin only
- [x] Advertisement-level tracking + QR Scan Intelligence — privacy-preserving, tenant-isolated, tested
- [x] QR Redirect Flow — immediate redirect, no interstitial, honest fallback page, rate limited
- [x] Automated QR decode verification blocks ready status on failure — real, tested against the real generated PNG
- [x] Social Trust Check — TRUST_READY / REVIEW_RECOMMENDED / BLOCKED, never calls anything "Facebook/WhatsApp/Meta/LinkedIn Approved"
- [x] KAI Knowledge Capture — every field the brief lists is either a real column or derivable from existing Sprint 002/003 fields; no analytics dashboard built (correctly out of scope)
- [x] Unit + integration tests per the brief's list; no live OpenAI key required for any automated test
- [x] Self-audit performed, findings above, all fixed
- [x] Do Not Build list respected: no payments, no candidate module, no analytics dashboard, no auto-publishing, no guaranteed-moderation claims
- [x] Typecheck/lint/tests/build run; README.md, CHANGELOG.md, SPRINT_004.md updated
- [x] Committed locally; push attempted (see final report footer for credential status)

**Sprint 004 complete. Not starting Sprint 005.**
