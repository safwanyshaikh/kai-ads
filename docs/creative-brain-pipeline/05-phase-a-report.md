# PHASE A REPORT — Feature flag + adapter + full parity (complete, dormant)

Phase A implemented. Full parity, flag OFF, everything green. No Phase B, no
flag enablement, no commit/push/merge.

## 1. Files changed

| File | Change |
|---|---|
| `src/lib/env.ts` | **M** — `CREATIVE_BRAIN_BACKGROUND_BRIEF` flag (default `false`) + `getFeatureFlags()` |
| `src/server/services/advertisement-generation.service.ts` | **M** — imports + one flag-gated `buildBackgroundBrief()` helper, used at both call sites |
| `src/server/generation/background-brief/types.ts` | **M** — `ContentDensity`, `AgencyPalette`, two optional decision fields, extended traceability + boundary docstring |
| `src/server/generation/background-brief/gpt-background-brief-generator.ts` | **M** — density guidance + agency-palette clause wired into the prompt |
| `src/server/generation/background-brief/index.ts` | **M** — export adapter + new types |
| `src/server/generation/background-brief/creative-brain-adapter.ts` | **New** — the adapter |
| `tests/creative-brain-adapter.test.ts` | **New** — adapter + full-parity + flag-default tests |
| `tests/gpt-background-brief-generator.test.ts` | prototype tests (unchanged this phase) |

**Untouched / frozen:** `buildImageBrief()`, composition-constitution, overlay
renderer, QR, visual QA, image provider, acceptance-loop internals. Nothing
renamed.

## 2. Adapter architecture

`toCreativeBrainDecisions({ facts, copy, directives, dna, aspectRatio })` →
`CreativeBrainVisualDecisions`. Reads grounded artifacts, emits only
non-factual creative signals:

- **Creative direction (deterministic):** `colourMood` (Gulf → `DESERT_GOLD`),
  `visualStory` (industry → `WORKER_HERO`), `emotionalDirection`
  (benefits→MONEY, Gulf oil&gas→PRESTIGE, interviews→URGENCY), thematic
  `projectType` derived from **industry only** (never roles/header).
- **Full parity, no loss:** `contentDensityClass` ← `directives`;
  `agencyPalette` ← DNA **colours only** (primary/secondary/accent, never the
  agency name).
- **Truth boundary:** a test asserts employer name, agency name, positions,
  phone, email, interview city, RA number can appear in neither the decisions
  nor the prompt.

Responsibility split honored: Creative Brain decides direction · Agency DNA
applies identity (biases mood within the approved palette; does NOT replace
`colourMood`) · Overlay guarantees truth. The `AGENCY VISUAL IDENTITY` clause
forbids rendering colours as blocks/swatches/text.

## 3. Feature flag

`CREATIVE_BRAIN_BACKGROUND_BRIEF` — `z.coerce.boolean().default(false)`, same
pattern as `AI_KILL_SWITCH`, read via
`getFeatureFlags().creativeBrainBackgroundBrief`. OFF → legacy
`buildImageBrief()` verbatim. ON → Creative-Brain path. Not enabled.

## 4. Test results

- **Full suite: 433 passed / 41 files.** (Log's sharp / "vision API down" lines
  are intentional negative-path cases.)
- New this phase: **17 tests** across the two background-brief files — density
  pass-through, palette pass-through, no-factual-leak, thematic-projectType,
  and flag-defaults-to-false.
- **Typecheck: 0 errors. Lint: 0 warnings.**

## 5. Production unchanged with flag OFF — confirmation

Confirmed. The only edit at both call sites is
`buildImageBrief(facts, briefContext)` → `buildBackgroundBrief()`, and with the
flag OFF `buildBackgroundBrief()` returns exactly
`buildImageBrief(facts, briefContext)` — same args, same string. The
regeneration site's ` Address these defects…` suffix is preserved identically.
Flag default is `false` (asserted by a test), so the prompt sent to the image
provider is **byte-for-byte identical to today**. The generator, adapter,
density, and palette code are dormant until the flag is enabled.

## 6–8. No commit · No push · No merge

All changes sit in the working tree, uncommitted.

## Next (awaiting explicit approval)

1. **Approve Phase B** — route only the Bilfinger sample through the new path, or
2. **Commit Phase A** (with or without a push), or
3. Something else.
