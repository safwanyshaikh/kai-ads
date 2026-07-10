# SPRINT 003 — KAI Recruitment Intelligence Engine

## Objective

Connect the existing provider-independent AI architecture (Sprint 002) to
OpenAI GPT. Turn raw overseas recruitment requirements into precise
structured advertisement data.

The recruiter may provide: plain text, a long job description, multiple
positions, PDF, DOCX, image, WhatsApp screenshot, or email content. KAI
must understand the requirement and extract only useful advertisement
information.

## Core Rule

Do not build a generic document summarizer. This is an Overseas
Recruitment Intelligence Engine. The output must be optimized
specifically for recruitment advertisement creation.

## OpenAI Integration

- Use the official OpenAI API.
- Do not hardcode model names throughout the application. Centralize AI
  provider and model configuration.
- Required environment variables: `OPENAI_API_KEY`, `KAI_TEXT_MODEL`,
  `KAI_VISION_MODEL`.
- Users must never see provider names or model names. The product-facing
  name is **KAI Intelligence Engine**.

## Input Processing

Support: Plain text, PDF, DOCX, PNG, JPG, JPEG, WEBP, WhatsApp
screenshots. Use the appropriate extraction method based on file type.
Do not send unnecessary content to the AI provider. Validate MIME type,
file size, empty files, corrupt files.

## Extract

Return structured data for: Country, Industry, Project Type, Employer
Name (optional), Positions, Quantity (optional), Salary (optional),
Currency (optional), Benefits (optional), Interview Mode/Date/Time/Venue
(optional), Age Limit (optional), Experience (optional), Qualification
(optional), Contact (never invent), Original Source Text, Extraction
Confidence, Warnings.

## Recruiter Reality Rules

Employer name, salary, vacancy quantity, interview details, eligibility,
and benefits are all optional — never force disclosure, never reduce
extraction quality because optional information is missing.

## Industry Intelligence

Detect: Oil & Gas, Petrochemical, Construction, Marine, Shipyard,
Offshore, Power & Energy, Manufacturing, Automotive, Healthcare,
Hospitality, Retail, FMCG, Logistics, Infrastructure, Water, Mining,
Aviation, Other. Do not confuse closely related industries. Low
confidence → warning. The recruiter can always correct manually.

## Position Intelligence

Handle single position, multiple positions, 20–30 positions, duplicate
names, different salary/quantity/experience/qualification per position.

## Trade Summary Rule

One precise, technically recognizable sentence per position — never a
copy-pasted job description, never generic AI language, never invented
technical requirements.

## Multiple Positions

Preserve every unique position. Never silently drop one. Never merge
technically different trades. Detect obvious duplicates and flag possible
duplicates for recruiter review.

## Confidence

Every extracted field carries HIGH / MEDIUM / LOW confidence.
Low-confidence fields are visibly flagged. Never silently convert
uncertain information into fact.

## No Hallucination

Never invent Salary, Quantity, Employer, Country, Interview Date/Venue,
Benefits, Age, Experience, Qualification, Contact, or Registration
Number. Missing → `null`, never a fake placeholder.

## Review Screen

Recruiter sees extracted structured data, can edit every field, approves
before advertisement generation. Low-confidence fields are visually
highlighted.

## Contact Directory

Saved agency contacts (Name, Mobile, WhatsApp, Email, Designation),
selectable — no retyping contact info per advertisement.

## KAI Knowledge Capture

Preserve original requirement, source type, original extracted text, AI
structured output, recruiter corrections, final approved data, industry,
country, positions, salary/quantity/interview geography if available, AI
confidence. No analytics UI yet — just store it for future KAI modules.

## Data Governance

Every extraction belongs to exactly one agency. No cross-tenant leakage
of requirements, contacts, advertisements, or corrections. Employer
confidentiality preserved.

## Cost Tracking

Record per AI operation: provider, model, input/output tokens, estimated
cost, latency, success/failure, operation type, agency ID, user ID,
advertisement ID. Never expose provider details to normal agency users.
Architecture must support future credit calculation.

## Error Handling

Handle missing API key, provider timeout, rate limit, invalid response,
malformed structured output, unsupported document, corrupt/empty/
oversized file, partial extraction. Never lose the recruiter's original
input because AI processing failed.

## Testing

Unit tests for text extraction, industry/country detection, position
extraction (incl. multiple), every optional field, trade summaries,
duplicate detection, confidence handling, no-hallucination rules, tenant
isolation, cost tracking, error handling. Integration test for the full
flow: Input → Document Processing → KAI Intelligence Engine → Structured
Extraction → Recruiter Review → Corrections → Approval → Saved
Advertisement Draft. No live OpenAI key required for normal automated
tests — dependency injection + deterministic test providers. Do not fake
production implementation.

## Self Audit

Architecture, Security, Recruitment Logic, Hallucination, Tenant
Isolation, Performance, Cost Control, Code Quality, Dependency, Test
Review. Fix all Critical/High/Medium automatically, repeat until zero.

## Do Not Build

AI image generation, advertisement rendering, DTP/typography/visual
poster rendering, export, payments, government compliance engine, MEA
badge rendering.

## Completion

Typecheck, lint, unit tests, integration tests, build where environment
permits. Final Sprint 003 implementation report. Commit locally. Do not
start Sprint 004. Stop.

---

## Implementation notes (added after build)

See `project/SPRINTERS/SPRINT_003_FINAL.md` for the complete implementation
report, self-audit findings, and the one security fix (SSRF) found and
resolved during this sprint's own review. Summary: the seven Sprint 002
provider interfaces now have a real OpenAI-backed implementation
(`src/server/ai/openai/`), sharing one memoized API call across all seven
plus an optional 8th "composite" capability for the full rich result in
one round trip. PDF/DOCX are converted to text before reaching the model;
images go to the vision model directly. Contact Directory and Cost
Tracking (`AgencyContact`, `AiUsageLog`) shipped as new tables. 140 tests
pass using a deterministic, dependency-injected fake provider — the real
implementation has never executed against a live OpenAI API in this
sandbox (network-restricted, same category of limitation as the
Prisma-generate gap documented since Sprint 001), so treat it as
structurally correct and unit-verified, not live-verified.
