# TASK 3 — GPT Quality Audit (Advertisement Generation Quality Only)

**Scope:** Quality of the advertisement generation pipeline exclusively.
Engineering concerns are out of scope (see Task 2 / Task 6). No implementation.
Evidence: direct reads of both prompt pipelines, the Creative Director Brain,
the captured benchmark prompt outputs (legacy 2,650 chars vs GPT-native 4,039
chars, same Halliburton fixture), and the CEO's rejected-output screenshots
from live testing.

## Root causes, ranked (why output does not consistently match GPT Pro)

### ROOT CAUSE 1 — The active pipeline forbids GPT-Pro-quality output by contract
The production path (all flags OFF) sends `buildImageBrief`'s prompt, whose
captured output opens: *"Render NO readable text, NO letters, NO numbers, NO
logos, NO QR codes… no close-up identifiable human faces."* GPT Pro's quality
comes precisely from the things this prompt prohibits: integrated typography,
composed headlines, human subjects. The deterministic renderer then rebuilds
that 80% with four fixed SVG grammars and two Liberation fonts. **No prompt
tuning can fix this path; it is capped by design.** (Constitutionally resolved
by Task 1's amendments; operationally resolved only when GPT-native goes live.)

### ROOT CAUSE 2 — Single-shot generation with zero selection or iteration
GPT Pro users implicitly do best-of-N: regenerate, compare, pick. The GPT-native
pipeline takes the FIRST image the model returns — no candidate set, no Visual
QA scoring, no regenerate-on-defect loop (the legacy `runAcceptanceLoop` is
absent from this path). GPT-image output variance is high; without selection,
KAI's median output competes against GPT Pro's user-selected best.

### ROOT CAUSE 3 — The master prompt speaks Creative-Director jargon to an image model
`buildMasterAdvertisementPrompt` interpolates the Brain's internal enums
verbatim: "Visual story: REFINERY (MEGA_PROJECT personality)", "Composition:
DTP_GRID layout, 4 column(s)", "dominant hook \"Halliburton\"", "prominence:
HIGH". Image models respond to natural pictorial language, not typed enum
tokens. Every enum that reaches the prompt as-is is direction the model will
partially ignore. The Brain's decisions are right; their TRANSLATION into
image-model language is the weakest link in the compliant pipeline.

### ROOT CAUSE 4 — No density strategy for text volume
The master prompt instructs GPT to render EVERY position verbatim. For 1–8
positions this is achievable; for the real 129-position Halliburton requirement
it is physically impossible at legible size on one canvas — text accuracy and
typography quality degrade as rendered-text volume grows. There is no
density-conditional strategy (e.g., hero treatment for sparse, structured
handling for dense) on the GPT-native path — legacy had one (archetypes);
GPT-native flattened it.

### ROOT CAUSE 5 — No brand/visual identity inputs
The master prompt receives no agency palette, no logo, no visual DNA
(`gpt-native-generation.service.ts` facts assembly carries name/RA only, vs
legacy's `resolveAgencyVisualDna`). Output cannot look like *the agency's*
premium ad — only like *a* premium ad. (Supreme Principle 10.)

### ROOT CAUSE 6 — Canvas dimension mismatch
The prompt states the platform's exact canvas ("CANVAS: 1080x1350px") but the
provider maps every request onto one of GPT Image's three fixed sizes
(1024x1024 / 1024x1536 / 1536x1024, `kai-creative-engine-provider.ts:10-27`),
and the trust layer then resizes with `fit: "cover"` — mild cropping/scaling of
GPT's composition on every non-native aspect ratio.

### ROOT CAUSE 7 — Historic settings depressed the observed baseline
The screenshots that set the "Pathetic" impression were generated under
`gpt-4.1-mini` extraction and hardcoded `"medium"` image quality (both fixed in
commit `8934023`). Current defaults (`gpt-4.1`, `high`) have not yet produced a
comparable observed sample set — part of the gap is measurement lag, which only
live runs can close.

## Quality dimensions scorecard (evidence-referenced)

| Dimension | Legacy (active) | GPT-native (dormant) | Limiting cause |
|---|---|---|---|
| Creative Director reasoning | Skipped (flag OFF) | Full 20-engine direction | RC1 / RC3 |
| Prompt construction | Anti-quality by contract | Strong facts, weak translation | RC1 / RC3 |
| Prompt restrictions | Prohibits text/faces | Correctly prohibits only QR/badges | RC1 |
| Typography | 2 commodity fonts, unrenderable font direction | GPT-quality, unverified spelling | RC2 |
| Hierarchy | Correct but flat (template) | Directed via reading order | RC3 |
| Photography/realism | Background-only, faces banned | Full scenes permitted, ungated | RC2 |
| Human psychology | Encoded but dormant | Carried in brief as enums | RC3 |
| Layout freedom | Four fixed grammars | Full freedom, no density strategy | RC4 |
| Commercial appeal | CEO-rejected on evidence | Unmeasured | RC2/RC7 |
| Brand continuity | Visual DNA present | Absent | RC5 |

## Priority fixes (recommendations only — no implementation in this task)

1. **P1 — Go live on GPT-native** (prerequisite for every other fix to be
   measurable). Unblocks RC1, begins closing RC7.
2. **P2 — Add best-of-N + Visual QA selection loop** to the GPT-native path
   (adapt the existing acceptance-loop/Brain-D machinery to full-image output;
   add an image-spelling verification pass). Closes RC2.
3. **P3 — Rewrite the brief→prompt translation layer**: convert every enum to
   natural pictorial/art-direction language (a pure string-mapping change in
   `master-prompt-builder.ts`; the Brain itself needs no change). Closes RC3.
4. **P4 — Density-conditional master prompts**: sparse → hero-led single
   composition; medium → poster grammar description; HIGH (20+ positions) →
   explicitly instruct a clean structured table treatment, or route
   extreme-density ads to a hybrid strategy decided by the product owner.
   Closes RC4.
5. **P5 — Feed Agency Visual DNA + logo** into the master prompt and trust
   layer. Closes RC5.
6. **P6 — Align stated canvas with the provider's actual size** (state the
   mapped size in the prompt; reserve platform-exact resize for the trust
   layer). Closes RC6.
