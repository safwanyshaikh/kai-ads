# INTEGRATION PLAN — Replace legacy background brief (reversible)

Approved. Replaces the `buildImageBrief()` architecture without breaking
production. Architectural decision: **FULL PARITY** — the Creative Brain does
NOT replace Agency Visual DNA.

Responsibility split:
- **Creative Brain** — decides the creative direction.
- **Agency Visual DNA** — applies the agency's identity (approved palette).
- **Overlay Engine (frozen)** — guarantees truth and precision.

## 1. Dependency graph

```
Source Input → Truth Extraction → AdvertisementFacts
  → advertisement-generation.service.ts
       builds: copy = buildAdCopyPlan(facts)
               directives = buildCompositionDirectives(facts)   ★FROZEN★
               dna = resolveAgencyVisualDna(logo)
               briefContext = { copy, dna, directives, aspectRatio }
  → CALL SITE 1 (line ~175): prompt = buildImageBrief(facts, briefContext)  ★LEGACY★
  → CALL SITE 2 (line ~286): `${buildImageBrief(...)} Address these defects: ...`
  → getImageGenerationProvider().generate({ prompt, w, h, quality })  ★UNTOUCHED★
  → GPT Image → backgroundImageDataUri
  → runAcceptanceLoop → composeAdvertisement (OVERLAY) → rasterize → Visual QA → acceptance score
                                             ★FROZEN★               ★UNTOUCHED★

PROTOTYPE (isolated): generateGptBackgroundBrief(CreativeBrainVisualDecisions) → { prompt, sections, traceability }
```

**Key finding:** no "Creative Brain" component exists in production. Integration
requires a new **adapter** mapping (facts + AdCopyPlan + CompositionDirectives +
DNA) → CreativeBrainVisualDecisions. That adapter is the real integration
surface and the main risk.

| Component | Status |
|---|---|
| `buildImageBrief()` | Kept, unchanged (legacy path) |
| `advertisement-generation.service.ts` (2 call sites) | Edited — flag-gated branch |
| **NEW** `creative-brain-adapter.ts` | Added |
| `env.ts` | Edited — one boolean flag |
| composition-constitution, overlay, QR, visual QA, image provider, acceptance loop | Untouched |

## 2. Migration plan (Phases A–D)

- **Phase A** — dual path, flag-gated, default OFF. Add flag + adapter + wiring
  + tests. Production byte-for-byte identical when OFF.
- **Phase B** — route only the Bilfinger sample through the new generator.
- **Phase C** — compare: generated prompt · background · final ad · Visual QA ·
  acceptance score.
- **Phase D** — new ≥ legacy → flip default ON; else flip OFF (instant rollback).

## 3. Risk analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Parity gap — brand palette (DNA) not in prototype | Medium | FULL PARITY: carry DNA palette into decisions |
| R2 | Parity gap — density guidance | Medium | Carry `contentDensityClass` through adapter |
| R3 | Regeneration defect-note suffix must be preserved | Low | Preserve suffix in branch; test it |
| R4 | Adapter is new logic; bad mapping degrades ads | Medium | Flag OFF until Phase C; Bilfinger-only in B |
| R5 | Flag misconfiguration | Low | Default false; explicit opt-in |
| R6 | Truth leak into prompt | Low | Input type excludes facts; no-leak test |

## 4. Rollback strategy

- **Primary:** `CREATIVE_BRAIN_BACKGROUND_BRIEF=false` → instant config-only
  revert. No code change.
- **Structural:** legacy `buildImageBrief()` never removed/renamed.
- **Per-request:** failed new-path background still hits acceptance-loop
  regeneration; flag off restores legacy next generation.
- **Blast radius while OFF:** zero.

## 5. Estimated files changed during integration

| File | Change |
|---|---|
| `src/lib/env.ts` | flag + accessor |
| `background-brief/creative-brain-adapter.ts` | NEW adapter |
| `background-brief/index.ts` | export adapter |
| `advertisement-generation.service.ts` | flag-gated branch (2 sites) |
| `tests/creative-brain-adapter.test.ts` | NEW |

## 6. Migration risk rating

**MEDIUM** — mechanically low-risk (one production file, flag-gated, default
OFF, instant rollback), rated MEDIUM because the adapter is new logic and the
two parity gaps (DNA palette, density) must be carried through and validated on
Visual QA/acceptance before the default flips.
