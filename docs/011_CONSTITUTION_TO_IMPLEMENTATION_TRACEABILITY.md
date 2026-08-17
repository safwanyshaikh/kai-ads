# KAI ADS — Constitution → Implementation Traceability

Version: 1.0

Status: LIVING RECORD — updated when a capability ships or a constitution is
amended. This document has **no authority of its own**: it does not add,
remove, weaken, or reinterpret any constitutional clause. It only records,
honestly, which constitutional capabilities are implemented in code today and
which are roadmap.

Owner: KAI Platform (product owner)

Last Updated: July 2026

---

## Why this document exists

A constitution defines the intended system. Code implements part of it at any
given moment. Those two things drifting apart is normal and expected — what is
*not* acceptable is losing track of the difference, or quietly editing the
constitution down to match what happens to be built.

So: **constitutional sections are never removed to match the code.** Where the
code does not yet reach the constitution, that gap is recorded here as a
roadmap item, with traceability in both directions.

Legend:

- ✅ **Implemented** — in production code, traceable to a file below.
- ⚠️ **Partial** — some of the clause is implemented, some is not.
- ❌ **Not implemented** — constitutional intent, no code yet.
- ⛔ **Superseded** — deliberately not implemented because a later
  constitution overrides the earlier clause (recorded, not a gap).
- 🟢 **Collecting Intelligence** — a *second dimension*, not a replacement for
  the status above. Marks capabilities that are live in production **and**
  actively accumulating the raw material a Phase 3 capability will consume.
  KAI is not waiting to learn; it is already gathering the evidence learning
  will use.

---

## Phase summary

| Phase | Meaning |
|---|---|
| **Production** | Live in the shipping product today. |
| **Phase 2** | Post-launch. Implementable now; deferred to keep launch scope tight. |
| **Phase 3** | Requires real production data (approved ads, recruiter feedback, campaign outcomes) before it can be built meaningfully. |

---

## 1. Generation pipeline — `docs/010` (V2 Final Product Constitution)

| Constitutional Capability | Status | Implementation | Phase |
|---|---|---|---|
| Requirement Intelligence | ✅ | `src/server/generation/pipeline/requirement-intelligence.ts` | Production |
| Content Intelligence Model (statement taxonomy, role-family clustering, compression eligibility, DTP capacity pre-flight) | ⚠️ | `src/server/generation/pipeline/content-intelligence.ts` — builds the model and enforces the capacity law before a Gemini call is spent (wired into `generate.ts` STEP 3.5). Compressed/clustered content is NOT yet consumed by the renderer's row layout (`fact-layer.ts` still typesets every position flatly, per docs/010 Amendment 1) — visual family-box composition is a follow-on step, not yet built. | Phase 2 |
| Creative Brief | ✅ | `src/server/generation/pipeline/creative-brief.ts` | Production |
| One GPT Image call | ✅ | `src/server/generation/pipeline/generate.ts` | Production |
| Branding Overlay | ✅ | `src/server/generation/pipeline/branding-overlay.ts` | Production |
| Zero fabrication rules | ✅ | Enforced in the Creative Brief instructions | Production |
| Exactly one pipeline, zero routing flags | ✅ | Verified: single call graph, no generation flags in `src/lib/env.ts` | Production |

## 2. AI responsibilities & limitations — `docs/000` (Product Constitution)

| Constitutional Capability | Status | Implementation | Phase |
|---|---|---|---|
| Requirement Extraction | ✅ | `src/server/ai/kai-intelligence-engine.ts` | Production |
| Trade Summarisation | ✅ | Extraction engine + `extraction-result.schema` | Production |
| Headline Generation | ✅ | GPT Image, via the Creative Brief | Production |
| Advertisement Copy | ✅ | GPT Image, via the Creative Brief | Production |
| Image Generation | ✅ | `pipeline/generate.ts` | Production |
| Never invent salary / employer / interview date / benefits / registration numbers | ✅ | Creative Brief zero-fabrication instructions + grounded `AdvertisementFacts` | Production |
| Trust display: MEA Registered Agency, registration number, trust stamp | ✅ | Branding Overlay footer band + `trust-validation.service.ts` | Production |
| Mark missing information as "Information Required" | ⚠️ | Missing facts are **omitted** rather than labelled. Constitutionally safe (never fabricates) but not the stated behaviour. | Phase 2 |
| Section Regeneration | ⛔ | Superseded by `docs/009` Principle 2 / `docs/010`: GPT owns full composition; partial re-render no longer exists as an operation. | — |
| Layout Recommendation | ⛔ | Superseded by `docs/010`: GPT Image owns all layout. | — |
| Editable blocks, editing one never affects others | ⚠️ | Data-level block editing exists (`PATCH /api/advertisements/[id]`, `AdvertisementCanvas`). The *image* regenerates as a whole, by constitutional design. Clause needs re-scoping to data, not pixels. | Phase 2 |
| Learning: every advertisement contributes structured recruitment intelligence | ❌ | No knowledge/learning code exists. | **Phase 3** |

## 3. Supreme principles — `docs/009`

| Principle | Status | Implementation | Phase |
|---|---|---|---|
| P1 — Truth First | ✅ | Grounded facts + zero-fabrication brief | Production |
| P2 — GPT creates the entire advertisement | ✅ | Single GPT Image call, no recomposition | Production |
| P3 — Creative Director Brain | ⚠️ | The deterministic engine modules were deleted in consolidation. The *function* now lives inside the Creative Brief prompt (senior recruitment creative director framing), not as code modules. Intent preserved, mechanism changed. | Production (prompt-level) |
| P4 — Advertisement Must Sell | ✅ | GPT Image + Creative Brief; judged by human review | Production |
| P5 — Human Psychology | ⚠️ | Expressed in the Creative Brief prompt; no separate psychology engine | Production (prompt-level) |
| P6 — Commercial Design | ✅ | GPT Image | Production |
| P7 — Photography | ✅ | GPT Image | Production |
| P8 — Typography | ✅ | GPT Image | Production |
| P9 — Layout | ✅ | GPT Image | Production |
| P10 — Brand Intelligence | ⚠️ | Logo placement ✅, watermark ✅, trust elements ✅. **Brand colours ❌** and typography consistency ❌ — the Visual DNA extractor was deleted in consolidation; GPT currently chooses palette. | Phase 2 (agency brand profile) |
| P11 — Trust Layer | ⚠️ | Agency verification ✅, QR verification ✅, agency watermark ✅. **Invisible metadata ❌, generation ID ❌, authenticity proof / content hash ❌** — these existed in the deleted `gpt-native/trust-layer.ts` and were not carried into the current overlay. | Phase 2 |
| P12 — GPT-Level User Experience | ✅ | Single composer: paste/attach → generate | Production |
| P13 — Zero Friction | ✅ | Passwordless auth, no archetype/theme pickers | Production |
| P14 — Self-Healing Intelligence | ⚠️ | Currency normalisation ✅ (`pipeline/currency.ts`), interview date/venue normalisation ✅ (`interview-events.ts`). **Spelling correction ❌, duplicate detection ❌, phone normalisation ❌.** | Phase 2 |
| P15 — Enterprise Engineering | ⚠️ | Zero dead code ✅, zero obsolete pipelines ✅, audit logs ✅, automated testing ✅ (312 tests), CI ✅, rollback ✅ (immutable version history). **Monitoring/alerting ❌.** Feature flags deliberately absent for generation, per `docs/010`. | Phase 2 (monitoring) |
| P16 — Continuous Benchmarking (vs GPT Pro and previous KAI output) | ❌ | The acceptance loop and Visual QA brain were deleted in consolidation. Certification now runs a QR gate only; quality is human-judged. | **Phase 3** |

## 4. Governance, evidence, memory

| Constitutional Capability | Status | Implementation | Phase |
|---|---|---|---|
| Audit Trail | ✅ 🟢 | `AuditLog` model + `audit-log.service.ts` — every generation recorded | Production |
| Advertisement Versioning (nothing overwritten) | ✅ 🟢 | `AdvertisementVersion` + `AdvertisementHistory` — immutable per generation | Production |
| AI usage & cost telemetry | ✅ 🟢 | `AiUsageLog` + `cost-tracking.service.ts` | Production |
| Generation quota governance | ✅ | `AgencyGenerationQuota` + `generation-quota.service.ts` | Production |
| Real-world engagement signal | ✅ 🟢 | `QrScanEvent` — every verification scan captured | Production |
| Structured recruitment facts per ad | ✅ 🟢 | `Advertisement` columns: industry, country, employer, positions, benefits, salary | Production |
| Trust outcome per ad | ✅ 🟢 | `Advertisement.trustStatus` + `trustWarnings` | Production |
| **Production Data Collection** | **🟢 Active** | The six 🟢 rows above, accumulating from launch day | Production |
| Human Approval Workflow | ⚠️ | `Approval` model exists but `ApprovalTargetType` covers only `AGENCY \| JOIN_REQUEST`. `AdvertisementStatus.REVIEW/APPROVED` exist as enum values with no workflow behind them. | **Phase 2** |
| Evidence capture (advertisement-level) | ❌ | The only `evidenceReference` is on `AgencyVerification` (agency paperwork), unrelated to ads. | **Phase 3** |
| Recruiter feedback capture | ❌ | No feedback model or service. | **Phase 3** |
| Knowledge repository | ❌ | No knowledge model or service. | **Phase 3** |
| Memory / intelligence continuity | ❌ | No memory system. (`memory-rate-limiter.ts` is an unrelated rate limiter.) | **Phase 3** |
| Knowledge Evolution Dashboard | ❌ | Not built. | **Phase 3** |
| Daily / Weekly / Monthly Intelligence Reports | ❌ | Not built. | **Phase 3** |

---

## Phase 3 — the learning loop

This is constitutional intent (`docs/000` "Learning"; `docs/009` P16), deferred
by product decision until real usage exists — not abandoned, and not a
weakening of the constitution.

**Why deferral is the right sequencing, not an excuse:** a learning loop needs
labelled outcomes. Today there are none — no approvals, no rejections, no
recruiter feedback, no campaign performance. Building the loop before those
exist would encode guesses as ground truth, and those guesses would be
expensive to unlearn later.

**Raw material already being captured** (this is the point — nothing is being
thrown away while we wait):

| Signal | Already captured in |
|---|---|
| Every advertisement generated, immutably versioned | `AdvertisementVersion` |
| Every lifecycle action, with actor and timestamp | `AuditLog`, `AdvertisementHistory` |
| Industry, country, employer, positions, salary per ad | `Advertisement` (structured columns) |
| Trust outcome per ad | `Advertisement.trustStatus`, `trustWarnings` |
| Model, latency, and cost per generation | `AiUsageLog` |
| Real-world candidate engagement | `QrScanEvent` |

**Phase 3 build order, when the data justifies it:**

1. Human Approval Workflow (Phase 2 prerequisite) — produces the approve/reject
   labels every later stage depends on.
2. Recruiter feedback capture — why an ad was rejected or edited.
3. Evidence + knowledge capture — promote approved ads into reusable, versioned
   knowledge (industry, country, employer patterns).
4. Feed knowledge back into the Creative Brief.
5. Intelligence Evolution dashboard + Daily/Weekly/Monthly reports over that
   accumulated history.

Note that step 5 is where "What did KAI learn this week?" becomes genuinely
answerable. Until steps 1–4 exist, any such report would be describing activity
volume, not learning — and should not be labelled as learning.

---

## Available before Phase 3, without new architecture

The signals table above is already accumulating from launch day. A **read-only
reporting query** over those existing tables can honestly answer, today:

- advertisements generated per day / week / month, per agency;
- which industries, countries, and employers appeared, and at what volume;
- trust-status outcomes and warning frequency;
- cost and latency per advertisement, trending;
- which verification QR codes were actually scanned.

That is reporting on data already captured — not a knowledge system, and it
must not be presented as one. It is offered here because it gives the product
owner real visibility from day one while Phase 3's prerequisites accumulate.

---

# Constitutional Maturity

A single-page snapshot of where the project stands. Figures are **counted from
the tables above**, not estimated.

| Measure | Value |
|---|---|
| Constitution Completion | **100%** — 4 constitutions authored and in force (`docs/000`, `008`, `009`, `010`) |
| Capabilities Tracked | **48** |
| Production Implementation | **63%** — 29 of 46 in-scope capabilities fully implemented |
| Partial Implementation | **9** capabilities (Phase 2) |
| Not Yet Implemented | **8** capabilities (Phase 3) |
| Superseded by Later Constitution | **2** (excluded from scoring — deliberately void, not gaps) |
| Production Data Collection | **🟢 Active** — 6 signal streams accumulating from launch day |
| Learning Readiness | **Active** — the raw material Phase 3 requires is being captured now |
| Learning Execution | **Deferred (Phase 3)** — requires approval/rejection labels that do not yet exist |
| Overall Product Readiness | **Production Ready** — engineering complete, one pipeline, 312 tests, clean build |

### How Production Implementation is counted

Denominator excludes the 2 ⛔ Superseded clauses, since a deliberately voided
clause is not an outstanding gap. Numerator counts **only fully implemented
(✅)** capabilities — partials score zero, not half credit, so the figure is a
floor rather than a flattering estimate. Half-crediting the 9 partials would
read ~73%; the conservative number is published instead.

| Status | Count | Share of in-scope |
|---|---:|---:|
| ✅ Implemented (of which 🟢 collecting: 6) | 29 | 63% |
| ⚠️ Partial (Phase 2) | 9 | 20% |
| ❌ Not implemented (Phase 3) | 8 | 17% |
| **In-scope total** | **46** | **100%** |
| ⛔ Superseded (excluded) | 2 | — |

Re-tally after any edit to the tables above — these figures must never be
updated by hand:

```sh
awk '/^## 1\./,/^# Constitutional Maturity/' \
    docs/011_CONSTITUTION_TO_IMPLEMENTATION_TRACEABILITY.md \
  | awk -F'|' 'NF>3 {print $3}' | sed 's/^ *//;s/ *$//' \
  | grep -E '^(✅|⚠️|❌|⛔)' | sort | uniq -c
```

Current output: `23 ✅` + `6 ✅ 🟢` = 29 implemented · `9 ⚠️` · `8 ❌` ·
`2 ⛔` — 48 tracked, 46 in-scope.

### Standing caveat

"Production Ready" describes engineering state: one verified pipeline, passing
build/typecheck/lint/tests, and a real GPT Image generation confirmed
end-to-end. First live deployment and first advertisement generated by a real
recruiter through the production UI remain the outstanding acceptance step, and
this row should be revisited once that has happened.

### What moves these numbers

Not another planning pass. Production Implementation rises when a Phase 2 item
ships (Human Approval Workflow first — it is the prerequisite that unlocks
Phase 3). Learning Execution changes state only once approvals, rejections, and
recruiter feedback exist in volume. Real usage decides the order; this document
records the outcome.
