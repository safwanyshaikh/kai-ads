# Changelog

All notable changes to KAI Ads are documented here.

## [0.5.0] — Sprint 005 — MVP Completion

### Added

- Visual style now produces a real, finished, downloadable advertisement:
  AI-generated background (via the real `KaiCreativeEngineProvider`) or,
  when unconfigured/unavailable, a deterministic industry-themed gradient
  fallback — Visual never returns "not implemented"
- Real SVG-to-PNG rasterization (`sharp`) and multi-format export
  (`sharp` for JPG, `pdf-lib` for a real single-page PDF) — the
  advertisement is now an actual image, not an SVG data URI
- `GET /api/advertisements/[id]/export?format=png|jpg|pdf`, gated on the
  trust check (which itself already encodes "QR must decode
  successfully"), with useful, secret-free filenames
- Theme selection now has a real, tested effect on the rendered output
  (accent color applied to the DTP rule, section headings, badge border)
- Section Editor UI (Header/Footer), Usage/Quota display on the
  Advertisement Library, Admin Usage Visibility on the Agency
  Verification page
- High-density + Visual style now surfaces an explicit recruiter warning
  rather than silently degrading
- 27 new tests (241/241 total), including a test that rasterizes the
  full composition for all three styles and decodes the QR from the
  final image, not just the standalone QR

### Fixed (self-audit)

- Real architecture bug: the agency logo was embedded via a remote URL
  in SVG; `sharp`'s renderer silently produces a blank image for remote
  `<image href>` URLs (verified directly before writing any composition
  code) — now fetched and inlined as base64 first
- `usedAiBackground` was computed but never used — now recorded in the
  version snapshot

### Known limitations

- No live OpenAI Visual generation test was possible from this sandbox —
  no `OPENAI_API_KEY` and no network path to `api.openai.com` (confirmed
  directly, same as every prior sprint's disclosed limitation)
- Section Editor UI covers Header/Footer directly; Positions/Benefits/
  Interview/Contact remain edited through the existing full-form editor
- Not verified on real mobile/tablet/desktop browsers — no browser
  available in this sandbox; every new component reuses the same
  responsive patterns established since Sprint 001

## [0.4.0] — Sprint 004 — Generation Engine + Trust Layer

### Added

- Advertisement Generation Flow: platform format selection, KAI density-
  based type recommendation, deterministic Typography/Newspaper
  rendering (real SVG composition, no AI dependency), Unified
  Verification QR Badge, automated QR decode verification, Social Trust
  Check, versioned save — reusing Sprint 002's Advertisement/
  AdvertisementVersion/AdvertisementHistory rather than a parallel system
- Section-based editing (Critical Editing USP): regenerate/edit exactly
  one section, with `changedSection`/`previousSectionData`/
  `newSectionData`/`regenerationMethod` tracked per version
- Real QR generation + self-decode-verification (`qrcode`, `jsqr`,
  `pngjs`) — blocks `TRUST_READY` if KAI can't decode its own QR
- QR Redirect Flow (`/v/[agencyVerificationId]`, public, rate-limited):
  records privacy-preserving scan intelligence, redirects immediately to
  the agency's official verification destination, honest fallback page
  if unavailable
- Agency Verification Workflow (KAI Super Admin): verify / suspend /
  restore / require-reverification, fully audit-logged
- Bootstrap Trial Quota: 10 free generations shared per agency (not per
  employee), real AI kill switch, honestly-stubbed daily budget guard
- KAI Creative Engine: real OpenAI GPT Image provider architecture
  (interface + Null stand-in + real implementation), genuinely called by
  the generation flow for the Visual style
- Density/Type/Theme/Badge Intelligence — named, recruiter-facing choices
  only; no hex codes, font names, or design terminology ever surfaced
- Critical Legal Language / government-branding-restriction detection,
  enforced as a hard `BLOCKED` trust-check failure, not a soft warning
- `AgencyVerification`, `AgencyGenerationQuota`, `QrScanEvent` tables;
  extended `Advertisement`, `AdvertisementVersion`, `AiUsageLog` rather
  than duplicating them
- ADR-006 (Advertisement Rendering Architecture) — the required decision
  record for AI-background + deterministic-composition over full-image
  AI generation, written before the renderer was built
- 74 new tests (214/214 total), including a 12-test real-database
  integration test and genuine (non-mocked) QR generate/decode tests

### Fixed (self-audit)

- `GenerateAdvertisementInput` was defined twice with the same shape in
  two different files — consolidated to one Zod-derived source of truth
- The KAI Creative Engine's real provider factory was built but never
  called anywhere — the Visual-style generation path now genuinely
  exercises it instead of a hardcoded rejection string
- `regenerateSection()` silently fell back to an arbitrary request-body
  value if the expected section field key was missing — now requires the
  exact key and fails clearly if absent
- Added a rate limit to the public QR redirect endpoint (previously
  unlimited)
- De-exported 17 more zero-consumer types/interfaces, consistent with
  the rule enforced in every prior sprint

## [0.3.0] — Sprint 003 — KAI Recruitment Intelligence Engine

Connected Sprint 002's provider-independent AI architecture to a real
OpenAI implementation (Responses API, structured outputs). Added PDF/DOCX
text extraction, image/WhatsApp-screenshot vision input, Contact
Directory, AI usage/cost tracking, and an SSRF fix found during this
sprint's own security review. 140 tests. Externally verified against a
live OpenAI API after this sandbox's own build — see
`project/SPRINTERS/SPRINT_003_FINAL.md`.

## [0.2.0] — Sprint 002 — Advertisement Intelligence Engine

Advertisement CRUD, versioning, search/filter/pagination, duplicate/
archive/restore/soft-delete, the Advertisement Draft flow (paste/upload →
review → style → preview → save), and the seven AI extraction provider
interfaces (architecture only — no GPT implementation yet). See
`project/SPRINTERS/SPRINT_002.md`.

## [0.1.0] — Sprint 001 Final — Production Baseline

**Status: LOCKED.**

### Added

- Next.js 15 App Router / React 19 / TypeScript strict project scaffold
- Prisma schema (Agency, User, Domain, JoinRequest, Approval, AuditLog,
  Better Auth tables) and hand-authored initial migration
- Better Auth integration: Google Workspace (restricted via verified `hd`
  claim), Microsoft 365, Magic Link — no passwords
- Landing Page, Agency Registration, Pending Approval, Login, Employee
  Join Request, Dashboard placeholder, Agency Admin UI, KAI Super Admin
  agency approval UI
- Role-Based Access Control (`KAI_SUPER_ADMIN` / `AGENCY_ADMIN` /
  `AGENCY_USER`), centralized in `src/lib/rbac.ts`
- Repository + service layer; UI never touches Prisma directly
- Real (non-mocked) email adapters (Resend, SMTP) and storage adapters
  (S3-compatible, Vercel Blob), selected by environment variable
- Audit logging on every mutation
- Rate limiting (in-memory, Redis-ready interface) on all public mutation
  endpoints
- Pagination (default 25, configurable) on Agency List, Team List, and
  Join Request List
- Docker + docker-compose (app + Postgres)
- 39 automated tests, including a real-PostgreSQL integration test
  covering the full Registration → Approval → Login → Join Request →
  Approval → Dashboard flow
- `SPRINT_001_FIX.md` and `SPRINT_001_FINAL.md` documenting the
  stabilization and final-cleanup passes

### Fixed

- Join-request approve/reject routes previously checked agency ownership
  *after* mutating the record instead of before
- `DuplicateDomainError` / `DomainNotFoundError` extended plain `Error`
  instead of the app's `AppError` hierarchy, so `handleApiError()` mapped
  both to a generic 500 instead of the correct 409/404
- `EMAIL_PROVIDER` / `STORAGE_PROVIDER` silently defaulted to Resend/S3
  respectively when unset instead of failing loudly — now mandatory, no
  default, with explicit `NullEmailProvider`/`NullStorageProvider`
  adapters for an intentional `"none"` choice

### Removed

- Unused `APP_NAME` environment variable (declared, never read)
- Unused dependencies: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-select`, `@radix-ui/react-toast`, `lucide-react`,
  `@aws-sdk/s3-request-presigner`, `@vitejs/plugin-react`
- Duplicated `MAX_LOGO_SIZE_BYTES` constant (real one lives in
  `storage.service.ts`)
- Duplicated `callAction`/fetch-error-parsing logic across 5 components,
  consolidated into `src/lib/api-client.ts`
- Dead `APP_ROUTES.dashboardEmployees`, `API_ROUTES.auth`,
  `SESSION_COOKIE_NAME`, `AUDIT_ACTIONS.userSignedIn` constants

### Known Limitations

See `project/SPRINTERS/SPRINT_001_FINAL.md` → "Known Limitations" for the
full list, most notably: `prisma generate` cannot run inside the sandbox
this was built in (network-restricted), documented and worked around with
real-database verification rather than hidden.
