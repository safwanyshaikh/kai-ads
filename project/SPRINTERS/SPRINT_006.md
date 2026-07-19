# SPRINT 006 — CREATIVE DIRECTOR BRAIN (FOUNDATION LOCK + ARCHITECTURE REPORT)

**Status:** Architecture report only. NO code written. Awaiting approval before implementation.
**Baseline referenced:** Sprint 005 complete (`SPRINT_005_FINAL.md`), architecture per ADR-006.
**Working-tree note (honest):** current uncommitted prototype work exists — the additive
`src/server/generation/background-brief/` module (Phase A, flag-gated, dormant) and the
`docs/creative-brain-pipeline/` specs. Nothing is committed/pushed.

---

## READING CONFIRMATION

- ✓ Sprint 005 understood (`project/SPRINTERS/SPRINT_005_FINAL.md`) — Visual style real; SVG→PNG raster; export; quota; theme effect.
- ✓ Existing renderer understood — `section-renderer.ts` + archetypes (`visual-hero`, `structured-professional`, `dtp-newspaper`, `high-density`) → `composeAdvertisement()`; deterministic SVG, rasterized by `sharp`.
- ✓ Existing authentication understood — Better Auth (`src/lib/auth.ts`, `/api/auth/[...all]`); Google/Microsoft OAuth (the "client ID") or magic link; agency onboarding/verification/admin.
- ✓ Existing pipeline understood — `advertisementGenerationService.generate()`: facts → copy plan → composition directives → archetype → GPT background brief → image provider → compose → rasterize → acceptance loop → export.
- ✓ Existing advertisement workflow understood — draft: upload → extract → review → style → save; advertisement: generate → status → export → history/versions.
- ✓ Existing feature flags understood — `AI_KILL_SWITCH`, `CREATIVE_BRAIN_BACKGROUND_BRIEF` (my Phase A, default OFF), exposed via `getFeatureFlags()` / `getIntegrationStatus()`.
- ✓ Existing Truth Brain understood — `prohibited-claims.service.ts`, `trust-validation.service.ts`, and the source-fidelity gate (`acceptance/gates.ts` + composition-constitution) — every fact source-grounded; QR must decode.
- ✓ Existing Creative Brain prototype understood — production: `buildAdCopyPlan()` (`advertisement-intelligence.ts`) + `buildCompositionDirectives()` (`composition-constitution.ts`); spec: `docs/creative-brain-pipeline/08-creative-director-module.md`.
- ✓ Existing GPT Background prototype understood — frozen `buildImageBrief()` (`archetype-selection.ts`) + additive `background-brief/` generator (deterministic, 5-font, Country/Currency-aware spec).
- ✓ Existing poster renderer understood — the multi-vacancy poster is a **scratchpad prototype** + locked spec (`09-multi-vacancy-poster-layout.md`); NOT yet an in-app archetype.
- ✓ Existing QA pipeline understood — `acceptance/acceptance-loop.ts` (MAX 3 iterations): deterministic gates (source-fidelity, technical-render, QR) that an AI score can never override, + Visual QA Brain (`ai/visual-qa`, threshold 85, honest SKIPPED when no key).

## FROZEN — extend only, never redesign/recreate/replace
Authentication · Better Auth · Login · Registration · Agency Verification/Approval · User Management ·
Advertisement Workflow · Renderer (`section-renderer` + archetypes + `composeAdvertisement`) · QR System ·
Truth Brain · Verification/`/v/` System · Export System · Database (Prisma schema) · Existing feature flags ·
Existing production pipeline · ADR-006 (AI background + deterministic text — never AI-rendered critical text).

---

# SPRINT 006 ARCHITECTURE REPORT

Sprint 006 scope = **Commercial Advertisement Intelligence only.** Not UI, auth, deployment, infra,
APIs, renderer redesign, CSS, SVG, layouts, or database. Only the decision brain.
**The brain decides; the renderer executes; the renderer never thinks.**

## 1. Existing architecture understanding
Current flow (`advertisement-generation.service.ts`):
```
Source upload → Truth Brain (extract + source-fidelity + prohibited-claims)
  → buildAdCopyPlan()          (headline core, hookLines, strongestSellingPoint, emphasis)
  → buildCompositionDirectives() (informationPriority, dominantHook, contentDensityClass,
                                   typographyScale, footerVariant, trustArchitecture, candidateHook)
  → recommendArchetype()/selectArchetype()
  → buildImageBrief()  [frozen]  |OR|  generateGptBackgroundBrief() [flag CREATIVE_BRAIN_BACKGROUND_BRIEF, OFF]
  → getImageGenerationProvider().generate()  (GPT Image | deterministic gradient fallback)
  → composeAdvertisement() → section-renderer SVG → rasterize(sharp)
  → runAcceptanceLoop() (gates + Visual QA, ≤3 iters) → export (PNG/JPG/PDF)
```
Today's "creative decisions" are **partial and scattered**: `buildAdCopyPlan` + `buildCompositionDirectives`
decide headline/emphasis/density/priority only. There is **no single component** that decides country/currency,
candidate psychology, emotional/colour direction, personality, visual story, hero/background strategy, or a
commercial score. That logic is implicit, split across copy-plan, directives, and `buildImageBrief`.

## 2. Gap analysis
| Needed (Creative Director) | Today | Gap |
|---|---|---|
| Opportunity ranking / commercial priority | partial (`strongestSellingPoint`, `informationPriority`) | no explicit ranked hero + one-hero rule |
| Country + Currency intelligence | none (currency not validated) | **new** — SAR/AED/KWD/QAR/BHD/OMR, wrong currency = FAIL |
| Candidate psychology / one dominant hook | implicit | **new** |
| Emotional + colour direction | none | **new** (Country premium colour) |
| Advertisement personality/category | none | **new** |
| Visual story + hero + background strategy | `buildImageBrief` derives scene ad hoc | consolidate into decision, not renderer |
| Benefit ranking | `compensation-signal` partial | formalize 10-rank, never invent |
| Typography/information hierarchy | `typographyScale`, `informationPriority` | keep; feed from brain |
| Commercial Quality Score (0–100) | Visual QA (post-render, 85) | **new** pre-render commercial score + gates |
| Poster/DTP multi-vacancy strategy | scratchpad only | brain selects layout family |

## 3. Creative Director module boundaries
- **New module:** `src/server/generation/creative-director/` (name TBD) — pure, deterministic, side-effect-free.
- **Consumes:** grounded `AdvertisementFacts` (post-Truth-Brain) + agency identity + platform format + tenant Visual DNA.
- **Produces:** one `CreativeDirection` decision object (see §5). **Emits decisions, never pixels, never facts.**
- **Does NOT:** call the renderer, touch auth/DB, render SVG/CSS, generate images, or place factual content.
- Wraps/absorbs the existing `buildAdCopyPlan` + `buildCompositionDirectives` outputs as sub-inputs (does not delete them).

## 4. Inputs (only grounded, tenant-supplied)
- `AdvertisementFacts` (employer, industry, country, positions[], benefits[], interview[], contact, footer, agencyName, RA/reg).
- Agency identity + Visual DNA palette (tenant), supplied logos (client + agency).
- Platform format (aspect ratio), read-only Country/Currency/Industry knowledge tables (data, not tenant).
- Nothing invented; classifications inform emphasis only, never printed content.

## 5. Outputs — the `CreativeDirection` object (deterministic)
Opportunity ranking · commercial priority score · primary candidate hook · secondary message ·
prominence {employer, country, industry, project} · salary/overtime/benefits priority (ranked) ·
emotional direction · colour direction · visual story · hero strategy · background strategy ·
attention path · typography hierarchy · information hierarchy · CTA priority · advertisement
category/personality · poster strategy (single-role box | DTP grid | multi-vacancy poster) ·
mobile-readability plan · currency (validated) · truthAudit {emphasized[], invented: NONE}.

## 6. Decision graph
```
Truth Brain (grounded facts)
      ↓
Creative Director Brain  ──► 15 engines (Opportunity, Country, Currency, Industry, Psychology,
                              Visual Story, Personality, Benefit, Interview, Position, Trust,
                              Typography, Mobile, Validation, Commercial Score)
      ↓ CreativeDirection
GPT Background Brief Generator  (consumes visual decisions only)
      ↓
Poster / Archetype Layout selection (brain picks family)
      ↓
Renderer (executes, never decides)
      ↓
Visual QA (post-render score)  →  Export
```

## 7. Integration points (extend only)
- `advertisement-generation.service.ts` — insert the brain **after** facts/copy/directives, **before** `buildImageBrief`/generator; flag-gated branch (same pattern as `CREATIVE_BRAIN_BACKGROUND_BRIEF`).
- `background-brief/creative-brain-adapter.ts` — replace its ad-hoc derivation with the brain's `CreativeDirection` (full parity: DNA palette + density carried through).
- Archetype/poster selection — brain outputs `posterStrategy`; a thin selector maps it to an existing archetype (or, later, a new poster archetype — separate sprint).
- Acceptance loop — brain's commercial score is **advisory pre-render**; deterministic gates + Visual QA remain the authority (unchanged).

## 8. Risks
- **R1 Currency correctness** (wrong currency = FAIL) — validate against Country table; unit-tested; block on mismatch.
- **R2 Scope creep into renderer/UI** — mitigated: brain emits decisions only; no CSS/SVG in this module.
- **R3 Parity regression** when the adapter switches to the brain — mitigated by flag-OFF default + A/B vs legacy.
- **R4 Truth leakage** — brain may read facts but must emit no factual strings into visual decisions; structural type boundary + no-leak tests.
- **R5 Determinism** — no LLM/randomness in the brain; identical facts → identical `CreativeDirection`.
- **R6 Employer-over-opportunity** (validation rule) — brain enforces one-hero + demotes unknown employers.

## 9. Feature flag strategy
- New flag `CREATIVE_DIRECTOR_BRAIN` (`z.coerce.boolean().default(false)`), via `getFeatureFlags()`.
- OFF → production byte-identical (legacy copy-plan/directives/`buildImageBrief`).
- ON → brain drives the background-brief adapter (which already sits behind `CREATIVE_BRAIN_BACKGROUND_BRIEF`).
- Both flags OFF by default; enable brain only after A/B on the benchmark set (Halliburton, Bilfinger, Aramco, Bus Driver, Royal Palace).

## 10. Migration plan (reversible)
- **Phase 0 (this doc):** architecture lock — no code.
- **Phase A:** implement the brain module + `CreativeDirection` type + Country/Currency tables + unit tests; NOT wired. Flag OFF.
- **Phase B:** adapter consumes `CreativeDirection`; route only benchmark samples through it; compare prompt/score vs legacy.
- **Phase C:** commercial score + validation gates; A/B the five benchmark campaigns.
- **Phase D:** if ≥ legacy on Visual QA + commercial score → flip default ON; else instant rollback (flag OFF).
- Throughout: no deployment, no commits/pushes/merges, no renderer/auth/DB/production-behaviour change; everything behind flags.

---

---

## PHASE A — BUILT (unwired, flag OFF, tested)

Approved with refinement: the Brain is a **collection of 21 deterministic
engines under one orchestrator**. Implemented in
`src/server/generation/creative-director/`:

- `types.ts` — `CreativeInput`, all engine decisions, immutable `CreativeDirection`, `Trace`.
- `knowledge.ts` — Country/Currency table (SAR/AED/KWD/QAR/BHD/OMR + prestige + premium colour + tone + flag), industry attractiveness, brand-strength classes, channel constraints (DTP/social/LinkedIn/WhatsApp).
- `engines/market.ts` — country · currency · employer · industry intelligence.
- `engines/offer.ts` — salary · benefits · project · urgency intelligence.
- `engines/psychology.ts` — candidate psychology (one hook) · opportunity ranking (one hero).
- `engines/visual.ts` — visual story · hero · background · colour strategy.
- `engines/structure.ts` — typography · layout · CTA · trust · mobile strategy.
- `engines/quality.ts` — commercial scoring (0–100, advisory) · truth validation.
- `creative-director.ts` — orchestrator → `Object.freeze(CreativeDirection)` with per-engine traceability.

Every engine: deterministic · single responsibility · independently exported/
testable · never invents facts · emits a `Trace` (why).

Feature flag `CREATIVE_DIRECTOR_BRAIN` (`z.coerce.boolean().default(false)`) via
`getFeatureFlags()`. **NOT wired into the pipeline** — nothing calls the brain in
production; renderer/auth/DB/pipeline/deployment untouched.

Validation: **450/450 tests pass** (17 new: determinism, immutability,
21-trace coverage, currency-FAIL, GCC map, one-hero, employer-not-over-
opportunity, salary/benefits never-invent, truth validation, flag-default-OFF).
Typecheck 0, lint 0.

**STOP. Phase A built and dormant. Awaiting approval before Phase B (adapter wiring + benchmark A/B). No commit/push/merge.**
