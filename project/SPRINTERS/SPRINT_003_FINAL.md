# SPRINT_003_FINAL.md

**Status: Complete — architecture connected to a real OpenAI implementation, unverified against a live API (sandbox network limitation, documented below and consistent with every prior sprint's Prisma-generate gap).**

---

## What shipped

### KAI Intelligence Engine — real OpenAI integration

- `src/server/ai/openai/` — the actual provider implementation Sprint 002 deliberately left unbuilt:
  - `openai-client.ts` — the only place `new OpenAI(...)` is constructed; model names resolve exclusively from `KAI_TEXT_MODEL` / `KAI_VISION_MODEL`, never hardcoded elsewhere.
  - `prompts.ts` — the actual recruitment intelligence: Core Rule, Recruiter Reality Rules, the 19-industry list, Trade Summary Rule, Multiple Positions, No Hallucination, all encoded as instructions, not left implicit.
  - `kai-extraction-engine.ts` — the one real API call (OpenAI Responses API, `responses.parse` with a Zod-derived structured-output schema via `zodTextFormat`), for both text and vision input.
  - `kai-extraction-provider.ts` — `KaiOpenAiExtractionProvider`, implementing all seven Sprint 002 provider interfaces *plus* an optional 8th `CompositeExtractionProvider` capability against one memoized underlying call, so invoking several of the seven for the same input costs exactly one API call, not seven.
  - `errors.ts` — `AiNotConfiguredError` (503), `AiTimeoutError` (504), `AiRateLimitError` (429), `AiInvalidResponseError` (502), `UnsupportedDocumentError` (422) — every one extends `AppError`, so `handleApiError()` maps them correctly instead of falling through to a generic 500.
- `src/server/ai/extraction-result.schema.ts` — the single structured-output contract (Zod), converted to JSON Schema for OpenAI and used to validate the response with the same definition. Every recruitment field carries `{ value, confidence }`; `value` is nullable everywhere the brief says the corresponding real-world detail is optional.
- `src/server/ai/kai-intelligence-engine.ts` — the orchestrator `advertisement-draft.service.ts` actually calls. Builds an extraction input from a draft's pasted text or uploaded file, calls the toolkit's composite capability when available, falls back to reassembling from the seven required interfaces otherwise. Accepts an injectable `toolkit` for tests.
- `src/server/ai/index.ts` — `getAiExtractionToolkit()` now branches on `OPENAI_API_KEY`: configured → every slot is the same `KaiOpenAiExtractionProvider` instance; unconfigured → the Sprint 002 `NotImplemented*` stand-ins, unchanged.

### Input Processing

- `src/server/ai/document-processing.service.ts` — PDF (`pdf-parse`) and DOCX (`mammoth`) are converted to plain text before ever reaching the model; PNG/JPEG/WEBP (including WhatsApp screenshots) are validated and passed to the vision model directly, with MIME type sniffed from magic bytes rather than trusted from the client. Validates empty files, oversized files (>15MB), and corrupt files (a failed PDF/DOCX parse becomes a clear `UnsupportedDocumentError`, not a crash).
- **A real security fix, not just a feature**: `fetchAndProcessSourceFile()` previously would have fetched *any* client-supplied URL server-side — a textbook SSRF vector (internal services, cloud metadata endpoints). Added `assertSafeSourceUrl()`: rejects non-http(s) protocols, rejects loopback/private/link-local hostnames outright, and requires the URL's host to match the agency's own configured storage (`STORAGE_PUBLIC_URL` / `STORAGE_ENDPOINT`, or the Vercel Blob domain pattern when that provider is active). Caught during this sprint's own Security Review, fixed before commit, covered by 6 dedicated tests.

### Advertisement Schema alignment

`extraction-result.schema.ts`'s fields map directly onto the brief's Extract list: Country, Industry, Project Type, Employer (optional), Positions (each with its own Quantity/Salary/Currency/Experience/Qualification/Age Limit and a `possibleDuplicateOfIndex` for duplicate flagging), Benefits, Interview Mode/Date/Time/Venue, Contact (never invented — only populated when literally present in source text per the prompt), Original Source Text, per-field Confidence, and Warnings.

### Contact Directory

`AgencyContact` model + repository + service + `/api/contacts` (list/create) and `/api/contacts/[id]` (update/delete, soft delete) + a manager UI embedded in the Agency Admin page + a picker embedded in the Advertisement Review form's Contact block. Every operation is agency-scoped; verified by a dedicated tenant-isolation integration test.

### Cost Tracking

`AiUsageLog` model, capturing provider, model, input/output tokens, estimated cost, latency, success/failure, operation type, agency ID, user ID, and draft ID for every extraction attempt — success and failure alike. Pricing estimation (`src/server/services/cost-estimation.ts`) is a pure, unit-tested function returning `null` rather than guessing for an unrecognized model. Never exposed to normal agency users — no route, no UI reads this table; it exists purely for the "architecture must support future credit calculation" requirement.

### Database

New migration `prisma/migrations/20260301000000_kai_intelligence_engine/`: `agency_contacts`, `ai_usage_logs`, `AiOperationType` enum. Applied and verified against the same real PostgreSQL 16 instance used since Sprint 001's fix pass (see "Known limitation" below for why this is a hand-applied migration, not a `prisma migrate deploy`).

### Testing

**140 tests across 16 files, all passing.** Per the brief's explicit instruction — "Do not require a live OpenAI API key for normal automated tests. Use dependency injection and deterministic test providers. Do not fake production implementation." — this was implemented literally:

- `tests/fakes/fake-ai-toolkit.ts` is a deterministic, DI-only test double. It is never imported by anything under `src/` — the real `KaiOpenAiExtractionProvider` is genuinely implemented against the OpenAI SDK; the fake exists solely so tests can inject a toolkit into `runKaiIntelligenceEngine({ ..., toolkit })` without touching OpenAI or the network.
- Unit tests (no DB, no network): extraction result schema (confidence, optional-field nullability, duplicate flagging, 25-position preservation), document processing (PDF success + corrupt/empty/oversized/unsupported rejection, image passthrough), the SSRF guard (6 tests), the orchestrator against both a success and an unimplemented fake toolkit, cost estimation math, and the AI error hierarchy.
- Integration test (real PostgreSQL, same substitution pattern as every prior sprint): `tests/integration/kai-intelligence-flow.test.ts` — Contact Directory CRUD + tenant isolation, AI Usage Log persistence for both success and failure, and the full flow Input → Document Processing → KAI Intelligence Engine → Structured Extraction → Recruiter Review → Corrections → Approval → Saved Advertisement Draft, including a corrected-industry assertion (`extractedData` says "Construction", `reviewedData` says "Oil & Gas", the saved `Advertisement` carries the recruiter's correction, not the AI's guess).

## Self-audit findings and fixes

| Category | Finding | Fix |
|---|---|---|
| Security | SSRF via client-supplied `sourceFileUrl` fetched server-side with no allowlist | `assertSafeSourceUrl()` — protocol, private/loopback-hostname, and storage-host allowlist checks; 6 tests |
| Code Quality | 6 types/interfaces exported with zero external consumers (`KaiIntelligenceEngineParams`, `KaiIntelligenceEngineOutcome`, `CompositeExtractionUsage`, `DocumentProcessingResult`, `KaiExtractionInput`, `AdvertisementSearchQuery` — the last one a miss carried over from Sprint 002's own cleanup pass) | De-exported / removed, consistent with the standing "no unused exports" rule from Sprint 001 |
| Code Quality / Dependency | `aiUsageLogRepository` shipped 4 methods, only `record()` had a caller | Trimmed to `record()` (used) + `aggregateCostByAgency()` (kept, explicitly justified by the brief's "must support future credit calculation," same precedent as Sprint 001's `auditLogService.listPaginated`) |
| Architecture | Cost-estimation pricing math lived inside `cost-tracking.service.ts`, which transitively imports Prisma — making it untestable as a pure function in this sandbox | Extracted to `src/server/services/cost-estimation.ts` with zero Prisma dependency; better separation of pure logic from I/O regardless of the sandbox issue |
| Dependency | Considered adding the `docx` package purely to generate a DOCX test fixture | Rejected — tested DOCX's corrupt/empty rejection paths instead (real code, real assertions) rather than adding a dependency whose only purpose is generating fixtures |

Lint: 0 problems. Typecheck: 58 errors, all the same `@prisma/client` type-resolution category as every prior sprint (see below) — zero of any other kind. Build: webpack compiles successfully; final build fails at the same documented stage.

## Known limitation (same category as every prior sprint, extended to OpenAI)

Two separate network restrictions apply in this sandbox, both already documented, neither new in kind:

1. **`prisma generate` cannot run** (`binaries.prisma.sh` outside the allowlist) — unchanged since Sprint 001, resolves automatically via `postinstall` on any machine with normal network access.
2. **`api.openai.com` is also outside this sandbox's network allowlist**, and no `OPENAI_API_KEY` was available regardless. This means `KaiOpenAiExtractionProvider` — while a real, complete implementation against the documented OpenAI SDK API (Responses API, `responses.parse`, `zodTextFormat` structured outputs) — has never actually executed against a live model in this environment. Its correctness rests on: (a) SDK source inspection to confirm the exact API shapes used compile and match the library's own type signatures, (b) the deterministic fake-provider tests proving every *consumer* of the toolkit (the orchestrator, the draft service's success/failure branching, cost tracking, error mapping) behaves correctly regardless of which implementation sits behind the interface, and (c) `KaiOpenAiExtractionProvider` compiling cleanly against the real `openai` package's types with strict TypeScript. What it does **not** prove is that the actual prompt produces good extractions, that the structured-output schema is accepted as strict-mode-compliant by the live API, or that real per-position confidence/duplicate-detection behavior matches the intent described in `prompts.ts`. The recommended next step, once this can run somewhere with real network access and a key, is a small manual smoke test against 3-5 real recruitment requirements before trusting this in production.

## Definition of Done

- [x] All required screens/flow connected: Dashboard → Create Advertisement → Paste/PDF/DOCX/Image/WhatsApp → AI Extraction Review → Style Selection → Preview → Save (unchanged navigation from Sprint 002; extraction is now real instead of always-`EXTRACTION_FAILED`)
- [x] OpenAI integration centralized, no hardcoded model names, `OPENAI_API_KEY`/`KAI_TEXT_MODEL`/`KAI_VISION_MODEL` are the only required env vars
- [x] All 7 required provider interfaces have a real implementation (+ 1 optional composite capability)
- [x] Input processing: PDF, DOCX, PNG, JPG, JPEG, WEBP, WhatsApp screenshots — validated, appropriately routed, size/empty/corrupt-checked
- [x] Extract fields match the brief's list, every optional field genuinely optional, contact never invented
- [x] Recruiter Reality Rules encoded in the system prompt, not just described in a comment
- [x] Industry Intelligence: exact 19-item list, low-confidence → warning
- [x] Position Intelligence: multiple positions (tested to 25), per-position salary/quantity/experience/qualification, duplicate flagging via `possibleDuplicateOfIndex`
- [x] Trade Summary Rule: one sentence per position, schema-enforced as required text
- [x] Confidence: HIGH/MEDIUM/LOW on every extractable field
- [x] No Hallucination: nullable-everywhere schema + explicit prompt instruction + `emptyExtractionResult()` fallback that fabricates nothing
- [x] Review Screen: existing draft-review form works unchanged; low-confidence highlighting is a UI enhancement the schema now supports (fields carry confidence) — not wired into the form's visual styling this sprint, noted as a natural Sprint 004 UI follow-up
- [x] Contact Directory: full CRUD, agency-scoped, selectable from the Review screen
- [x] KAI Knowledge Capture: `AdvertisementDraft` already preserved rawText/sourceFileUrl/extractedData/reviewedData since Sprint 002; no schema change needed, confirmed sufficient
- [x] Data Governance: every new table and route agency-scoped, verified by integration test
- [x] Cost Tracking: recorded for every operation, success and failure, never exposed to agency users
- [x] Error Handling: missing key, timeout, rate limit, invalid response, unsupported/corrupt/empty/oversized file all have a specific typed error
- [x] Unit tests + integration test, no live API key required, deterministic DI test double, real production implementation (not faked)
- [x] Self-audit performed, findings above, all fixed
- [x] Do Not Build list respected: no image generation, no rendering, no export, no payments, no compliance engine

**Sprint 003 complete. Not starting Sprint 004.**
