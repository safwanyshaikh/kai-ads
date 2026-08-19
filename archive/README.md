# archive/ — cold storage

Everything under `archive/` is **historical record only**. It is not a
source of implementation, and nothing here is on the live call graph.

## The only live architecture

| Branch | Role |
|---|---|
| `main` | production |
| `restore-fact-layer` | current commercial development |

There is no third development branch. Historical Claude branches,
experiment branches, acceptance-artifact branches and ad-hoc
single-advertisement branches are **not** implementation sources.

## Rule

> **DO NOT source implementation from `archive/*`, `experiment/*`,
> `acceptance-artifacts-*`, `adhoc-single-ad-*`, `certification-artifacts-*`,
> or historical Claude branches — unless the user explicitly requests
> historical analysis.**

When a question is "what does KAI do today?", the answer comes from the
live pipeline (see `docs/011` and the module map below), never from
here. When a question is "what did we try in July?", this is the place.

## Live pipeline, for orientation

```
SOURCE REQUIREMENT
  -> document processing        src/server/services/document-processing.service.ts
  -> extraction                 src/server/ai/kai-intelligence-engine.ts
  -> advertisement facts        src/server/generation/pipeline/requirement-intelligence.ts
  -> content intelligence       src/server/generation/pipeline/content-intelligence.ts
  -> social product decision    src/server/generation/pipeline/social-product-decision.ts
  -> creative brief             src/server/generation/pipeline/creative-brief.ts
  -> Gemini artwork             src/server/ai/image
  -> deterministic fact layer   src/server/generation/pipeline/fact-layer.ts
  -> agency trust footer        src/server/generation/pipeline/branding-overlay.ts
  -> visual QA                  src/server/generation/visual-qa-gate.ts
  -> stored advertisement       src/server/services/advertisement-generation.service.ts
```

Single sources of truth (never duplicate these into a renderer):

| Concern | Module |
|---|---|
| Type roles, families, measured widths | `src/lib/kdl-typography.ts` |
| Role-family clustering rules | `src/lib/role-families.ts` |
| Social formats + Feed ceiling | `src/lib/platform-formats.ts` |
| DTP approved physical slots | `src/lib/dtp-format-law.ts` |

## Directories

| Directory | Holds |
|---|---|
| `branches/` | notes/exports from historical branches |
| `legacy-schemas/` | superseded schema shapes, for reference |
| `legacy-renderers/` | superseded rendering approaches |
| `legacy-layouts/` | superseded layout specs |
| `experiments/` | one-off explorations |
| `acceptance-artifacts/` | past acceptance renders/reports |
| `adhoc/` | one-off single-advertisement work |
| `old-prompts/` | superseded prompt text |

Empty directories are kept with `.gitkeep` so the structure is stable.
