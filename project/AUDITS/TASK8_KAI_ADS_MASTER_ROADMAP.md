# TASK 8 — KAI Ads 10/10 Master Roadmap

**Synthesized from:** Constitutional Compliance Audit, Task 1 (amendments,
complete), Task 2 (readiness: BLOCKED, 2 blockers), Task 3 (quality: 7 root
causes), Task 4 (UX: 8/10 P12 failures), Task 5 (trust: R1–R6), Task 6
(engineering: 5/10), Task 7 (retirement sequence D1–D7).
**Ordering: strictly by business impact** — what most directly moves paying
agencies from "cannot rely on KAI" to "never leaves KAI."

---

## M1 — Unblock and prove the product's core promise (GPT-Native live)
**Why (business impact #1):** every rejected ad this month traces to the legacy
pipeline; nothing else matters commercially until KAI's output is publishable.
**Scope:** fix Task 2's two blockers (`maxDuration` on the generate route +
explicit SDK timeout/retry budget); enable `GPT_NATIVE_AD_GENERATION` for ONE
pilot agency (Al Yousuf); generate the three real fixtures (Mukti welders,
Yanbu RCM, Bilfinger); product owner reviews every output.
**Dependencies:** Vercel env access (owner has it); quota credit (granted);
Task 1 amendments (done).
**Risk:** Medium — spend begins; variance unfiltered until M2. Mitigation:
supervised pilot, per-output review, flag-off rollback in seconds.
**Effort:** S (config) + pilot time.
**Acceptance:** ≥1 real advertisement generated end-to-end in production;
latency inside function budget; owner scores outputs against the 008 Article
VIII question.
**Principles:** Golden Rule, P2, P6, P7.

## M2 — Quality loop: best-of-N + Visual QA + spelling gate
**Why (#2):** closes Task 3 RC2 — KAI's median vs GPT Pro's user-picked best.
This is what makes M1's quality REPEATABLE, which is the Success Criteria.
**Scope:** adapt acceptance-loop/Brain-D to full-image output; N-candidate
generation with scored selection; image-spelling verification pass;
trust-zone-cleanliness check; persist scores (P16 foundation).
**Dependencies:** M1 live outputs to calibrate against.
**Risk:** Medium — cost multiplies by N; mitigated by budget work in M4.
**Effort:** M.
**Acceptance:** zero visible spelling errors across the pilot fixture set; QA
score persisted on every generation; sub-threshold outputs auto-regenerated.
**Principles:** P6, P7, P8, P16, Success Criteria.

## M3 — Prompt translation + density strategy + brand DNA
**Why (#3):** Task 3 RC3/RC4/RC5 — the three quality levers inside KAI's own
control that don't depend on model behavior.
**Scope:** rewrite enum→pictorial translation in `master-prompt-builder.ts`;
density-conditional prompt strategies (sparse/medium/HIGH doctrine — HIGH
treatment is a product-owner decision); feed Visual DNA + logo (migrate
`resolveAgencyVisualDna`, per Task 7 D3); align stated canvas with provider
size (RC6).
**Dependencies:** M1 (live feedback), M2 (measurable scores to iterate against).
**Risk:** Low — pure prompt/adapter changes behind the flag.
**Effort:** M.
**Acceptance:** measurable QA-score improvement across fixtures; agency logo +
palette visible on output; a 20+-position ad renders legibly.
**Principles:** P3, P5, P9, P10.

## M4 — Engineering floor: CI gate, monitoring, budget, timeouts hardened
**Why (#4):** protects everything above; Task 6's top items. A quality
regression that ships silently undoes M1–M3.
**Scope:** push/PR workflow (lint+typecheck+vitest+build) + branch protection;
error tracking + alerts on generation failures; wire daily budget to
`aggregateCostByAgency`; runbook for flag-first rollback.
**Dependencies:** none — can start in parallel with M1 (recommended first
merge of all).
**Risk:** Low.
**Effort:** S–M.
**Acceptance:** a deliberately broken PR is blocked by CI; a forced generation
failure produces an alert; exceeding the daily budget blocks spend with an
honest message.
**Principles:** P15.

## M5 — ChatGPT-grade composer
**Why (#5):** first-session impression + Task 4's 8 failed P12 requirements;
directly drives adoption/retention once output quality (M1–M3) earns trust.
**Scope:** additive multi-attachment draft model (attachment list + optional
instructions text); single composer surface (persistent textarea, multi-file,
chips, previews, removal); drag-drop + paste-image; instructions plumbed into
extraction context.
**Dependencies:** none technical; sequenced after M1–M4 purely on impact.
**Risk:** Medium (data-model change; additive JSON keeps migration risk low).
**Effort:** L.
**Acceptance:** two PDFs + one image + typed instructions in one draft produce
one advertisement; every Task 4 Priority-1 row closed.
**Principles:** P12, P13.

## M6 — Trust completion
**Why (#6):** ownership protection becomes commercially meaningful exactly when
output quality makes ads worth stealing.
**Scope:** Task 5 R1–R4 (visible agency mark + micro generation ID in the trust
zone; formal ID scheme surfaced on `/v/`; metadata parity incl. export
preservation; SHA-256 + HMAC verification backend). R5 (C2PA) and R6
(steganography) scheduled separately after.
**Dependencies:** M1 (trust layer live in production).
**Risk:** Low — all enrichment composites, P2-safe.
**Effort:** M.
**Acceptance:** a WhatsApp-recompressed copy of an ad remains verifiable via
QR + printed ID; `/v/` confirms hash match for an untampered file.
**Principles:** P11.

## M7 — Self-healing intelligence
**Why (#7):** removes the residual manual-correction cases (P14) once the big
quality levers are in.
**Scope:** normalization layer (currencies, salaries, dates, phone numbers)
with fact-preservation tests; presentation-spelling layer reconciled with the
verbatim extraction law (source-verbatim + display-text design); duplicate-info
detection surfaced as warnings.
**Dependencies:** M2's spelling gate (shared verification), product-owner
sign-off on the verbatim/display design.
**Risk:** Medium — touches Truth Brain adjacency; mitigated by "never change
factual meaning" test suite.
**Effort:** M.
**Acceptance:** the Yanbu fixture's mixed formats render normalized; every
normalization has a test proving the fact survived.
**Principles:** P1, P8, P14.

## M8 — Continuous benchmarking
**Why (#8):** converts "is it better?" from opinion to measurement (P16); the
instrument that certifies 10/10.
**Scope:** automated per-generation scoring history (from M2); regression
comparison vs previous KAI output; curated GPT-Pro comparison set (manual
collection — GPT Pro outputs cannot be automated via API) reviewed on a cadence.
**Dependencies:** M2.
**Risk:** Low.
**Effort:** M.
**Acceptance:** dashboard/report showing score trend per fixture; any release
that regresses median score is visible before rollout.
**Principles:** P16.

## M9 — Legacy retirement + documentation truth
**Why (#9 — last):** zero dead code/obsolete pipelines/placeholder docs (P15)
executed exactly once, safely, after the product has moved.
**Scope:** Task 7 sequence D1–D7 verbatim, including the editing-doctrine
implementation before section-regeneration retires, harness migration, and
docs 002–006/ADR/architecture backfill describing the FINAL architecture.
**Dependencies:** written production approval of GPT-Native (M1–M3 sustained),
CI gate (M4).
**Risk:** Managed by the sequence's gates and pre-deletion tag.
**Effort:** M spread over the sequence.
**Acceptance:** Task 7's D5 lands with full suite green; repo contains zero
items from the SAFE/BLOCKED inventories; docs describe reality.
**Principles:** P15.

---

## 10/10 certification map

| 10/10 area | Certified by |
|---|---|
| Image Quality / Photorealism | M1 + M2 + M3 (scores + owner review) |
| Recruitment Intelligence | M3 (Brain live in the hot path, translated properly) |
| User Experience | M5 |
| Typography (zero visible errors) | M2 spelling gate |
| Design Quality | M2 + M3 + M8 trend |
| Trust | M6 |
| Automation (zero manual correction) | M2 + M7 |
| Engineering | M4 + M9 |
| Overall | All milestones + the 008 Article VIII question answered YES on sustained production output |

**Critical path: M4 (CI) → M1 → M2 → M3 → M8**, with M5/M6/M7 parallelizable
after M1, and M9 strictly last. No milestone is implemented by this document —
this is the single reference plan for the remaining work to KAI Ads v1.0 10/10.
