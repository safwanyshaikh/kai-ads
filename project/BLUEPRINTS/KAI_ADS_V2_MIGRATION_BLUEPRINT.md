# KAI Ads V2 — Migration Blueprint

**Status:** Design document only. No code in this repository has been
changed to produce this blueprint, and none should be until the product
owner explicitly approves it.

**V1 status as of this document:** ARCHITECTURALLY FROZEN. Every file
referenced below under "What stays legacy" is a reference to existing,
untouched V1 code — read for the purpose of accurate mapping, not
modified. The frozen commit is `d322c2d` on
`claude/kai-ads-verify-state-upnt70`.

**Philosophy:** *"KAI understands recruitment. GPT creates the
advertisement."* Three steps only: recruiter writes naturally →
KAI silently builds a Creative Brief → one request to GPT Image → a
minimal, non-intrusive branding overlay.

---

## 1. What stays

| V2 capability | Real V1 code it's built from | Why it survives |
|---|---|---|
| Recruiter Chat (free text, no forms) | `src/components/advertisement/draft-workspace.tsx`'s paste box, the ChatGPT-style multi-attachment composer (`AdvertisementDraft.attachments`/`instructions`, `extraction-input-merge.ts`) | Already exactly "paste and go" — V1 already removed the old structured review form in Sprint 006. This UI shell is close to done. |
| Requirement Intelligence | `src/server/ai/openai/kai-extraction-engine.ts`, `kai-intelligence-engine.ts`, `extraction-result.schema.ts`, `extraction-providers.interface.ts` | This is Truth Brain: turning free text into grounded facts (never inventing a value the source doesn't contain). This exact discipline is what caught every real fabrication bug found this session — it is the one piece of "verification" this blueprint keeps, because it runs BEFORE generation, not as a correction loop after. |
| GPT Image API call | `src/server/ai/image/kai-creative-engine-provider.ts`, `image-provider.interface.ts` | Already a clean, single-purpose provider interface. Reusable as-is. |
| QR generation/verification | `src/server/generation/qr-renderer.ts` | Small, self-contained, already does exactly one job (generate + self-verify a KAI-controlled `/v/` URL). Regulatory requirement, not a design choice — see Risk R4. |

Everything else the recruiter/agency-facing product needs that ISN'T
advertisement generation — auth, multi-tenancy, agency verification,
admin, quota, billing, dashboards — is **out of scope for this
blueprint** and stays exactly as-is; V2 only replaces the generation
pipeline.

---

## 2. What becomes legacy

Frozen in place, not deleted, not imported by any new V2 code path:

- **Legacy deterministic renderer** — all four archetypes
  (`archetypes/visual-hero.ts`, `structured-professional.ts`,
  `high-density.ts`, `dtp-newspaper.ts`), `composition-constitution.ts`,
  `composition-shared.ts`, `archetype-selection.ts`,
  `advertisement-intelligence.ts`, `badge-selection.service.ts`,
  `theme-recommendation.service.ts`, `density-classification.service.ts`,
  `visual-dna.ts`.
- **Creative Director Brain** — all 20 deterministic engines
  (`creative-director/engines/{market,offer,psychology,visual,structure,quality}.ts`),
  the orchestrator (`creative-director.ts`), `pipeline-adapter.ts`. V2's
  "Creative Brief Generator" replaces this entire layer — see Open
  Decision D1 on whether the replacement is itself deterministic code or
  an LLM call.
- **GPT-Native master prompt builder** — `master-prompt-builder.ts`
  (the large structured prompt with its FACTUAL FIDELITY / RESERVED
  TRUST ZONE / HARD RULES sections, hardened repeatedly this session).
  V2 needs a much shorter, single-purpose prompt built directly from the
  Creative Brief.
- **Acceptance / QA retry loop** — `acceptance.ts`, `acceptance-loop.ts`,
  `runGptNativeAcceptance`, the 2-attempt regenerate-with-feedback loop
  in `gpt-native-generation.service.ts`. Explicitly removed per the
  mission ("No QA retry loops. No visual correction loops."). **This is
  the single highest-risk removal — see Risk R1.**
- **Background brief generator** — `background-brief/*` (legacy
  photo-brief-only generation, superseded by GPT-Native's full-canvas
  generation, now itself being superseded).
- **Both existing orchestrators** —
  `advertisement-generation.service.ts` (legacy) and
  `gpt-native-generation.service.ts` (current GPT-Native, with its
  2-attempt loop). V2 needs one new, radically simpler orchestrator.
- **Trust validation service** — `trust-validation.service.ts`
  (deterministic warnings/TRUST_READY logic tied to the old model).
  V2's minimal overlay doesn't need a separate validation pass — the
  overlay either composites cleanly or it doesn't; see Open Decision D3.
- **Current Trust Layer's visual weight** —
  `gpt-native/trust-layer.ts` as built (large white verification panel,
  "MEA VERIFIED AGENCY" label, multi-line text block) directly
  contradicts "No floating cards. No white panels. No large trust
  boxes." Only the QR generation and logo-compositing *primitives* are
  reusable; the panel design itself is legacy.

---

## 3. New folder structure (proposed)

```
src/server/generation-v2/
├── requirement-intelligence.ts       # thin wrapper reusing existing kai-extraction-engine.ts
├── creative-brief-v2.ts              # NEW — replaces creative-director/* entirely
├── image-request-builder.ts          # NEW — one short prompt from brief + facts
├── branding-overlay-v2.ts            # NEW — small logo + small QR + one-line footer, non-intrusive
├── generation-v2.service.ts          # NEW — orchestrator: 3 calls, no loop
└── types.ts

src/app/api/advertisements-v2/
└── [id]/generate/route.ts            # new endpoint, does not touch /api/advertisements/[id]/generate

src/components/advertisement-v2/
└── recruiter-chat.tsx                # thin evolution of draft-workspace.tsx's paste UI
```

V1's `src/server/generation/`, `src/server/services/*generation*`, and
`src/app/api/advertisements/[id]/generate` are **untouched** — a
parallel tree, not a rewrite in place. This mirrors the exact pattern
already proven safe in this codebase for the GPT-Native rollout
(`GPT_NATIVE_AD_GENERATION` flag, legacy path never touched) — the one
V1 architectural decision worth explicitly carrying into V2.

---

## 4. Minimal API flow

```
POST /api/advertisement-drafts-v2/[id]/generate
  1. requirementIntelligence.extract(rawText)      → grounded facts (Truth Brain, reused as-is)
  2. creativeBriefV2.build(facts)                  → ONE creative brief object (see D1)
  3. imageRequestBuilder.build(brief, facts)        → ONE prompt string
  4. imageProvider.generate(prompt)                 → ONE GPT Image call, no retry
  5. brandingOverlayV2.apply(image, agency)         → logo + small QR + 1-line footer
  6. persist + return
```

No archetype selection. No density classification. No badge selection.
No typography/layout/canvas engines. No acceptance gate beyond the QR
self-decode check (kept — it's a hard regulatory requirement, not a
quality judgment call, and costs nothing to keep).

---

## 5. Simplified data flow

```
Recruiter free text
      │
      ▼
Requirement Intelligence  ──── Truth Brain: extracted facts, nothing invented
      │
      ▼
Creative Brief Generator  ──── recruitment psychology + industry + hook +
      │                        colour/typography mood + hero concept
      │                        (KAI's IP — see D1 for how it's built)
      ▼
ONE prompt  ──────────────────  facts + brief, nothing else
      │
      ▼
GPT Image API  ──── ONE call, ONE image, no correction loop
      │
      ▼
Minimal Branding Overlay  ──── logo + small QR + 1-line footer only
      │
      ▼
Final advertisement
```

Contrast with V1 GPT-Native today: Facts → Creative Director (20
engines) → Commercial Brief → Master Prompt (200+ lines of rules) → GPT
Image → Trust Layer (large panel) → Acceptance (vision QA + fact
proofread) → conditional 2nd attempt → REVIEW_RECOMMENDED flagging.

---

## 6. Estimated implementation effort

Rough sizing, not a committed schedule — depends entirely on team size
and how Open Decisions D1/D2 resolve:

| Component | Size | Notes |
|---|---|---|
| Requirement Intelligence wrapper | XS (~0.5 day) | Thin reuse of existing, working extraction engine |
| Creative Brief Generator | M–L (3–7 days) | Depends entirely on D1 — deterministic (M) vs. LLM-authored (L, needs its own prompt design + evaluation) |
| Image request builder | S (1–2 days) | One short, well-tested prompt template |
| Minimal branding overlay | S (1–2 days) | Reuses QR/logo compositing primitives from the current trust-layer, new (smaller) layout |
| V2 orchestrator + API route | S (1–2 days) | Three sequential calls, no loop, straightforward |
| Recruiter Chat UI evolution | S (1–2 days) | Existing paste UI is already close |
| New V2 test suite from scratch | M (3–5 days) | V1's 599 tests don't transfer — new architecture, new fixtures. Should include the same real-world fixture discipline the V1 fabrication audit established. |
| **Total** | **~2–4 weeks** single engineer, or **~1–2 weeks** with focused parallel work | Excludes any real-GPT-image evaluation/tuning cycles (unbounded, costs real API credit per round — see R2) |

---

## 7. Risks

**R1 — No safety net for fact fidelity (highest risk, direct evidence this session).**
Every real fabrication bug found and fixed today — fabricated salary,
fabricated currency, fabricated headline number, invented position
count, altered experience years — was caught by the acceptance
loop's fact-checker, not prevented by the prompt alone. Removing the
correction loop removes the only mechanism that ever caught these in
production. The one-shot prompt can be as well-hardened as V1's, and
GPT can still fabricate on a given day (proven repeatedly today) — with
zero verification, a fabricated fact now ships directly to a real
candidate with no flag, no retry, nothing. **This directly concerns
CLAUDE.md's non-negotiable law: "never fabricate salary, vacancies,
urgency, or benefits."** This is not an engineering risk to mitigate
quietly — it is a product/constitutional decision the product owner
should make explicitly (see D2), not one this blueprint should
pre-decide.

**R2 — GPT compliance is probabilistic, not guaranteed.**
Even the current, heavily-hardened prompt still produces QR/text overlap
and layout drift on a real, meaningful fraction of generations (finding
F6 from today's audit). A shorter prompt with fewer explicit rules will
not automatically make GPT more compliant — it may reduce fabrication
surface area (fewer instructions to leave gaps in) but has no evidence
either way on layout compliance. Only real generations can answer this,
and each round costs API credit (already a stated concern this session).

**R3 — Output consistency across agencies/ads.**
Removing the deterministic archetype/typography/density system means
V2 has no lever to guarantee visual consistency between two ads from
the same agency, or between sparse and dense requirements. This may be
an accepted trade-off (GPT's creative range IS the point) or a real
gap depending on what agencies expect.

**R4 — Regulatory/trust requirements vs. "minimal."**
The QR and RA number aren't purely aesthetic — they're how a
MEA-registered agency demonstrates compliance. "Small QR, small
verification footer" must stay legible and functional at real-world
render/compression sizes (WhatsApp/social re-encoding already strips
EXIF today). Minimalism must not silently break decodability or
legibility.

**R5 — Migration/coexistence.**
Two live generation pipelines (V1 frozen-but-existing, V2 new) means
support/debugging surface doubles until V1 is actually retired, not
just frozen. No plan yet for when/whether V1 code is deleted (see D6).

**R6 — Testing debt.**
V1's 599 tests, including today's new real-world fabrication regression
suite, cover none of V2's architecture. V2 launches with materially
less automated coverage than V1 currently has, at least initially.

---

## 8. Open design decisions (need product-owner sign-off before implementation)

**D1 — Is the Creative Brief Generator deterministic code or an LLM call?**
Both satisfy "KAI understands recruitment, GPT creates the ad," but they're
very different builds: deterministic code (fast, free, consistent,
testable, but needs real engineering to encode "recruitment psychology")
vs. an LLM call (KAI prompts GPT to write the brief — flexible, but adds
a second real API call before the image call, adds latency/cost, and
introduces its own fidelity-drift risk one step earlier in the chain).

**D2 — Does V2 keep ANY post-generation fact check, or truly zero?**
Given R1, is there room for a lightweight, non-correcting safety net —
e.g. a single read-only fact check that flags (but never regenerates or
blocks) an ad for human review — without violating "no QA retry loops"?
That's a materially different, smaller thing than V1's 2-attempt
correction loop, and may satisfy both the mission's simplicity goal and
CLAUDE.md's Truth Brain law. This is the single most consequential
decision in this document.

**D3 — What exactly is in-scope for "minimal branding overlay"?**
Logo + QR + footer text, confirmed. Does it include the RA number as
separate text, or only inside the QR payload? Any trust status
indicator at all (today's TRUST_READY/REVIEW_RECOMMENDED concept), or
is every V2 ad published as-is with no status?

**D4 — Where does V2 live relative to V1 in the product?**
New feature flag (mirroring `GPT_NATIVE_AD_GENERATION`), a separate
route entirely, or a hard cutover for new agencies only while existing
agencies stay on V1?

**D5 — What happens to advertisements already generated under V1?**
Stay permanently viewable/editable via the legacy renderer (V1 code
must then never truly be deleted), or is there a one-time migration?

**D6 — Legacy retirement timeline.**
This blueprint freezes V1, it doesn't schedule its deletion. Is there
an intended point where V1 code is actually removed, and what's the
trigger (V2 hits parity? A time-boxed pilot succeeds? Never, it just
stays frozen indefinitely as a reference)?

---

*No code has been written or modified to produce this document. Awaiting
explicit approval before any V2 implementation begins.*
