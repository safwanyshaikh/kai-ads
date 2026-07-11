# SPRINT_005_FINAL.md

**Status: Core MVP journey complete and real end-to-end, with UI polish and mobile/device verification honestly scoped down given this sandbox's constraints — see "What was and wasn't built" below.**

---

## The headline result: Visual style is real now

Sprint 004 shipped Visual as architecture-only (`VISUAL_COMPOSITION_NOT_IMPLEMENTED`). That gap is closed. `advertisementGenerationService.generate()` now, for all three styles:

1. For Visual: calls the real `KaiCreativeEngineProvider` (OpenAI GPT Image) for a background. If unconfigured or it fails, falls back to a deterministic, industry-themed gradient (`fallback-background.ts`) rather than blocking — Visual must never return "not implemented."
2. Renders the full composition — background (or gradient), agency logo, exact recruitment text, the Unified Verification QR Badge — as one SVG (`section-renderer.ts`).
3. **Rasterizes that SVG to a real PNG** (`sharp`) — this is the piece that was missing. The advertisement is now an actual image, not an SVG data URI pretending to be one.
4. Exports to PNG/JPG/PDF on demand (`image-export.service.ts`, using `sharp` for JPG and `pdf-lib` for a real single-page PDF).

**The test that actually proves this works** (`tests/qr-composition-pipeline.test.ts`): generates a real QR, embeds it in the full SVG composition for each of the three styles, rasterizes the *entire* advertisement to PNG, and decodes the QR *from that final raster* — not from the standalone QR. All three styles pass. This is the difference between "the QR generator works" and "the QR on the actual downloadable file works," and only the second one matters.

## Export — real, not a placeholder

`GET /api/advertisements/[id]/export?format=png|jpg|pdf`, gated on `trustStatus !== "BLOCKED"` (which itself already encodes "QR must decode successfully," since `runTrustCheck` sets `BLOCKED` on an undecodable QR — no separate check needed). Filenames are built from country/industry/position, never an advertisement or agency ID (`buildExportFilename`, tested against uuid/cuid-shaped leakage). 10 tests cover real PNG passthrough, real JPEG conversion (verified magic bytes, no alpha), and a real parseable PDF at the correct page size.

## Theme selection has a genuine effect

Previously `theme: Json?` was stored but did nothing to the render. `getThemeAccentColor()` now maps each of the 10 required theme families to an accent color used for the DTP rule, Positions heading, and badge border — small, but real and tested (`tests/visual-composition.test.ts`), not a cosmetic label with no downstream effect.

## Bootstrap Trial Quota — the two named scenarios

The brief specifically named two flows to test; both are covered by `tests/integration/quota-exhaustion-flow.test.ts` against real PostgreSQL: 10 successful generations reach the limit exactly, the 11th is correctly identified as over quota, and a provider failure is recorded to `AiUsageLog` with `billable: false` while `successfulGenerationsUsed` stays untouched.

## Admin Usage Visibility

Added to the existing Agency Verification admin page (not a new analytics dashboard, which is still explicitly out of scope): each agency's `used/totalQuota` generation count is now visible to KAI Super Admin alongside its verification status.

## Section Editor UI

A real UI now exists for editing the Header and Footer sections directly, calling the same section API every other editing path in this app uses (`MANUAL_EDIT`, full version history). Positions/Benefits/Interview/Contact remain edited through the existing full advertisement edit form (Sprint 002/003) — noted as a scope decision below, not hidden.

## Self-audit findings and fixes

| Category | Finding | Fix |
|---|---|---|
| Architecture (Critical) | The agency logo was passed to the SVG renderer as a remote URL (`<image href="https://...">`). Verified directly: `sharp`'s SVG rasterizer does **not** fetch remote URLs — it silently renders a blank image (confirmed with a real test call before writing any composition code) | Added `fetchImageAsDataUri()` — the logo (and nothing else; it's always our own storage's URL, never client-supplied at this point) is fetched and inlined as base64 before rendering |
| Code Quality | `usedAiBackground` was computed but never used | Now recorded in the version snapshot, so every version shows whether AI or the fallback gradient produced it |
| Recruiter UX / Brief compliance | "If Visual style is selected despite excessive density: Warn the recruiter" had no implementation | Added: HIGH density + VISUAL style pushes a warning into the trust-check warnings list rather than silently proceeding |

Lint: 0 problems. Typecheck: same documented `@prisma/client` category as every prior sprint, zero of any other kind. Build: webpack compiles; final build fails at the same documented stage.

## Test Review

**241/241 tests passing across 31 files** (up from 214/27 at the end of Sprint 004). New this sprint: real SVG-to-PNG rasterization tests, real PNG→JPG/PDF conversion tests (actual magic-byte/page-size assertions, not mocked), the QR-survives-full-composition-and-rasterization test described above, Visual-style composition tests (AI background embedding, fallback gradient, logo embedding, exact-text-over-photo preservation), theme accent color tests, and the quota-exhaustion integration test.

## Real OpenAI Test

**Not performed — and here's exactly why, stated plainly rather than glossed over.** This sandbox has no `OPENAI_API_KEY` and, independently, no network path to `api.openai.com` (`curl` to it returns a 403 from the sandbox's own egress proxy — confirmed directly in an earlier sprint of this same build). Both conditions the brief's "If OPENAI_API_KEY is available" clause is checking for are false here. What *is* verified, without a live key: `KaiCreativeEngineProvider` compiles cleanly against the real `openai` package's types (`client.images.generate`), and the fallback path it triggers into (`ImageProviderNotImplementedError` → deterministic gradient) is exercised by real, passing tests. The recommended next step is exactly what the brief anticipates: run this in an environment with real OpenAI access and a key, and record the result then — Sprint 003's own `SPRINT_003_FINAL.md` has the template for how that verification was recorded once it became available externally.

## What was and wasn't built — scope decisions stated honestly

Given the scale of this brief, some items were prioritized over others. Nothing below is hidden or claimed as done when it isn't:

- **Built, real, tested:** Visual/Typography/Newspaper all produce a finished downloadable PNG/JPG/PDF. QR decode-before-download gate. Theme selection with a real visual effect. Platform format selection. Bootstrap Trial Quota (agency-shared, tested exhaustion). Admin usage visibility. Section editing for Header/Footer with full version history.
- **Built but intentionally narrower than the brief's full ambition:** the Section Editor UI covers Header/Footer directly; Positions/Benefits/Interview/Contact are edited through the existing full-form editor rather than seven separate section-specific mini-editors. Style/theme/platform selection is card-and-button based (not the fully illustrated "preview thumbnail per card" the brief describes) — functional and reusing the existing shadcn/ui component set, not a from-scratch design pass.
- **Not verified this sprint:** actual rendering on real mobile/tablet/desktop browsers and screen readers — this sandbox has no browser to test in. Every new component reuses the same responsive Tailwind patterns and shadcn/ui primitives established since Sprint 001 (which were built mobile-first), but "reuses a responsive component" and "was tested on an actual phone" are different claims, and only the first one is true here.
- **Explicitly out of scope, per the brief itself:** payments, candidate module, analytics dashboard, social auto-publishing — none built, matching "Do Not Build."
- **Known pre-existing limitation, unchanged:** this sandbox cannot run `prisma generate` or reach `api.openai.com` — documented since Sprint 001, still true, not new to this sprint.

## Definition of Done

- [x] Visual, Typography, Newspaper all produce a finished, downloadable advertisement — none returns "not implemented"
- [x] AI background + deterministic text/QR/badge composition, never image-model-rendered critical text (ADR-006, upheld)
- [x] Multiple positions (1 through 20-30) handled; high-density Visual selection warns rather than silently degrading
- [x] Real PNG/JPG/PDF export with useful, secret-free filenames
- [x] QR decode-before-download and trust-check-before-download gates, enforced server-side on the export route itself
- [x] Bootstrap Trial Quota: agency-shared, 10-free, failure-non-billing, tested exhaustion at exactly 10/11
- [x] Global AI kill switch enforced; daily budget guard remains an honestly-labeled stub (unchanged from Sprint 004, not silently implied to be real)
- [x] Theme selection has a real, tested effect on output
- [x] Admin Usage Visibility added without building the explicitly-forbidden analytics dashboard
- [x] Self-audit found and fixed one real architecture bug (remote-URL SVG embedding silently failing) before it shipped
- [x] 241/241 tests passing; lint 0 problems; typecheck/build clean outside the documented sandbox gap
- [x] README.md, CHANGELOG.md, SPRINT_005.md updated; SPRINT_005_FINAL.md created
- [x] Committed locally; push attempted

**Sprint 005 complete. Not starting Sprint 006.**
