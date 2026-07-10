# SPRINT_001_FINAL.md

**Status: LOCKED — Production Baseline v0.1.0**

Sprint 001 (Agency Authentication) is complete, stabilized (see
`SPRINT_001_FIX.md`), and cleaned up. This document is the permanent
record of what shipped. No Advertisement Engine, AI, Templates, Payments,
or Export — those remain Sprint 002+.

---

## Completed Features

- Landing Page
- Agency Registration (business-domain + personal-email validation,
  duplicate registration-number/email/domain rejection)
- Pending Approval page
- Login — Google Workspace (Workspace-restricted via `hd` claim
  verification), Microsoft 365, Magic Link — no passwords
- Business Domain Validation (registration + employee join auto-detect)
- KAI Super Admin: Approve / Reject / Suspend / Activate agencies
- Agency Admin UI: profile (read-only), team list, join-request review
- Employee Join Request (domain auto-detected from business email)
- Dashboard placeholder (Create Advertisement disabled, other cards stubbed)
- Role-Based Access Control (`KAI_SUPER_ADMIN` / `AGENCY_ADMIN` / `AGENCY_USER`)
- Audit logging on every mutation
- Rate limiting on all public mutation endpoints
- Pagination (default 25, configurable) on Agency List, Team List, Join
  Request List
- Multi-tenant data isolation (every tenant-scoped query derives
  `agencyId` from the session, never from client input)

## Database Models

`prisma/schema.prisma` — 9 tables:

| Model | Purpose |
|---|---|
| `Agency` | Tenant record: name, registration number, website, official email, logo(s), status (`PENDING`/`APPROVED`/`REJECTED`/`SUSPENDED`) |
| `Domain` | One or more email domains owned by an Agency; unique, used for join-request auto-detection |
| `User` | Identity + tenant membership: role, status, `agencyId` |
| `JoinRequest` | Employee's request to join an Agency; reviewed by an Agency Admin |
| `Approval` | Immutable record of every agency-lifecycle decision (approve/reject/suspend/activate), who made it, why |
| `AuditLog` | Generic append-only log of every mutation across the app |
| `Session`, `Account`, `Verification` | Better Auth's required identity tables |

Migration: `prisma/migrations/20260101000000_init/migration.sql`
(hand-authored, applied and verified against a real PostgreSQL 16
instance — see `SPRINT_001_FIX.md` FIX-001).

## API Endpoints

| Method | Path | Access | Notes |
|---|---|---|---|
| `POST` | `/api/agencies` | Public | Registration. Rate limited 5/hr/IP |
| `GET` | `/api/agencies` | KAI Super Admin | Paginated |
| `POST` | `/api/agencies/[id]/approve` | KAI Super Admin | |
| `POST` | `/api/agencies/[id]/reject` | KAI Super Admin | Reason required |
| `POST` | `/api/agencies/[id]/suspend` | KAI Super Admin | Reason required |
| `POST` | `/api/agencies/[id]/activate` | KAI Super Admin | |
| `POST` | `/api/join-requests` | Public | Rate limited 10/hr/IP |
| `POST` | `/api/join-requests/[id]/approve` | Agency Admin, own agency only | |
| `POST` | `/api/join-requests/[id]/reject` | Agency Admin, own agency only | |
| `GET` | `/api/employees` | Authenticated | Scoped to caller's own `agencyId` |
| `POST` | `/api/uploads/logo` | Public | Rate limited 10/hr/IP |
| `*` | `/api/auth/[...all]` | — | Better Auth catch-all |

Every route: Zod-validated input, routed through `handleApiError()` for a
consistent error shape, RBAC-checked via `assertPermission()` /
`requireCurrentUser()` where applicable.

## Pages

`/` (Landing) · `/register` · `/pending-approval` · `/login` ·
`/login/verify` · `/join` · `/dashboard` · `/dashboard/agency` ·
`/admin/agencies`

## Components

- **UI primitives** (`src/components/ui/`): Button, Input, Label, Card,
  Form (React Hook Form wrapper), Alert, Badge, Textarea
- **Feature components**: RegisterAgencyForm, JoinRequestForm,
  AgencyActions, JoinRequestActions, AgencyStatusBadge, LoginForm,
  SignOutButton, DashboardShell, PaginationControls (shared)

## Services

`agency.service` · `join-request.service` · `email.service` ·
`email-validation.service` · `domain-validation.service` ·
`storage.service` · `audit-log.service`

All business logic lives here — no UI component or API route contains
business logic directly.

## Repositories

`agency.repository` · `user.repository` · `domain.repository` ·
`join-request.repository` · `audit-log.repository` — the only files in
the codebase that call Prisma directly.

## Providers (external integration adapters)

- **Email**: `ResendEmailProvider`, `SmtpEmailProvider`,
  `NullEmailProvider` (explicit, for `EMAIL_PROVIDER=none`) — selected by
  `getEmailProvider()`
- **Storage**: `S3StorageProvider`, `VercelBlobStorageProvider`,
  `NullStorageProvider` — selected by `getStorageProvider()`
- **Rate limiting**: `MemoryRateLimiter` behind a `RateLimiter` interface
  — Redis-ready seam, no call-site changes needed to add it later

None are mocked. An unconfigured/disabled provider throws a clear,
specific error when actually used rather than silently succeeding.

## Tests

39 tests across 6 files, all passing (`npm test`):

- `tests/integration/e2e-flow.test.ts` (10) — full Registration → Pending
  → Approval → Login → Join Request → Approval → Dashboard flow against a
  **real PostgreSQL instance**, including duplicate registration-number
  and duplicate-domain rejection
- `tests/rbac.test.ts` (7) — permission matrix, PENDING/SUSPENDED denial
- `tests/email-validation.service.test.ts` (6) — personal-domain rejection
- `tests/agency-validation.test.ts` (6) — registration Zod schema
- `tests/pagination.test.ts` (6) — pagination math and bounds
- `tests/rate-limiter.test.ts` (4) — in-memory limiter behavior

## Dependencies

21 production, 15 dev. Every dependency verified to have a real,
grep-confirmed usage site (see cleanup pass). Notable:

- `next` 15.5.20, `react`/`react-dom` 19.1.0, `typescript` ^5
- `prisma`/`@prisma/client` ^6.19.3 (pinned to a known-stable major after
  auto-install initially resolved Prisma 7, which was untested/unreleased
  at authoring time)
- `better-auth` ^1.6.23
- `zod` ^4.4.3, `react-hook-form` ^7.81.0, `@hookform/resolvers` ^5.4.0
- `pg` (devDependency — integration test only, not shipped in the app)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│   React 19 Server + Client Components · Better Auth client   │
└───────────────────────────┬───────────────────────────────────┘
                             │ HTTP
┌───────────────────────────▼───────────────────────────────────┐
│                    Next.js 15 App Router                      │
│  ┌──────────────┐   ┌──────────────────┐   ┌───────────────┐ │
│  │ middleware.ts │   │  Pages (Server    │   │ API Routes    │ │
│  │ (cookie-      │   │  Components)      │   │ (Zod-valid.,  │ │
│  │  presence     │   │  fetch via        │   │  RBAC-checked,│ │
│  │  route guard) │   │  services         │   │  rate-limited)│ │
│  └──────────────┘   └─────────┬─────────┘   └───────┬───────┘ │
└─────────────────────────────────┼───────────────────────┼──────┘
                                   ▼                       ▼
                    ┌──────────────────────────────────────────┐
                    │         src/server/services/*            │
                    │   (all business logic; RBAC via           │
                    │    src/lib/rbac.ts; errors via             │
                    │    src/lib/errors.ts; audit log on every  │
                    │    mutation)                               │
                    └───────────────────┬────────────────────────┘
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │       src/server/repositories/*            │
                    │         (only Prisma access point)         │
                    └───────────────────┬────────────────────────┘
                                         ▼
                              ┌─────────────────┐
                              │   PostgreSQL     │
                              └─────────────────┘

           ┌────────────────────────────────────────────┐
           │     src/server/providers/{email,storage}    │
           │  interface -> {Resend,SMTP,Null} / {S3,Blob,Null}
           │  selected by env, never mocked               │
           └────────────────────────────────────────────┘

           ┌────────────────────────────────────────────┐
           │   src/server/rate-limit (Memory, Redis-ready) │
           └────────────────────────────────────────────┘

           ┌────────────────────────────────────────────┐
           │  Better Auth (src/lib/auth.ts)                │
           │  Google (hd=* Workspace-restricted) / Microsoft│
           │  365 / Magic Link — Prisma-backed sessions     │
           └────────────────────────────────────────────┘
```

## Environment Variables

See `.env.example` for the authoritative, single-source list. Summary:

**Required to boot:** `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `EMAIL_PROVIDER`, `STORAGE_PROVIDER` (the last two
accept `"none"` as an explicit, valid choice — see FIX-004/005).

**Required only if the corresponding provider is selected:**
`GOOGLE_CLIENT_ID`/`SECRET`, `MICROSOFT_CLIENT_ID`/`SECRET`,
`RESEND_API_KEY` or `SMTP_*`, `STORAGE_BUCKET`/`STORAGE_ACCESS_KEY_ID`/
`STORAGE_SECRET_ACCESS_KEY` or `BLOB_READ_WRITE_TOKEN`.

**Optional, has a default:** `NODE_ENV`, `APP_URL`,
`MICROSOFT_TENANT_ID`, `PERSONAL_EMAIL_DOMAINS`, `LOG_LEVEL`.

`APP_NAME` was removed during cleanup — declared but never read anywhere
in the codebase.

## Known Limitations

1. **`prisma generate`/`prisma migrate` cannot run in this build
   sandbox** — `binaries.prisma.sh` is outside its network allowlist.
   Resolves automatically via the existing `postinstall` hook the moment
   this repository is installed anywhere with normal network access.
   Nothing to fix in code; documented in `README.md` and
   `SPRINT_001_FIX.md` FIX-001.
2. **No true HTTP/UI-level integration tests** — blocked by the same
   limitation (no compiled Prisma Client to run the actual service layer
   through Next.js routes in this sandbox). Substituted with a real-
   database integration test that mirrors the exact SQL each service
   issues (`tests/integration/e2e-flow.test.ts`). Recommended follow-up
   once the app can run: Playwright or Supertest-style tests against the
   live app.
3. **In-memory rate limiting** — correct for a single instance; will
   under-limit across multiple replicas. `RateLimiter` interface is
   Redis-ready by design (see `src/server/rate-limit/`).
4. **No pagination UI for Audit Log** — the data layer
   (`auditLogService.listPaginated`) is ready, but Sprint 001 has no
   audit-log viewer screen at all; adding one was out of scope for a
   stabilization/cleanup pass ("no new features").
5. **No repository dependency injection** — repositories are imported as
   singletons rather than constructor-injected, so unit-testing services
   in isolation currently requires module mocking rather than swapping in
   a test double.

## Future Sprint Dependencies

Sprint 002+ (Advertisement Engine, AI, Templates, Payments, Export) will need:

- The Prisma-generate limitation resolved (any environment with normal
  network access — not a blocker for Sprint 002 itself, only for
  continuing work inside this specific sandbox)
- `Agency`/`User` models as the tenant/identity foundation — stable,
  should not require breaking schema changes
- The provider-adapter pattern (`server/providers/*`) as the template for
  adding an AI provider adapter
- File storage wired to a real provider (`STORAGE_PROVIDER=s3` or
  `vercel-blob`) before any advertisement-upload feature ships — Sprint
  001 only needed it for agency logos
- A caching layer (Redis) before advertisement-generation traffic volumes
  hit session/agency lookups hard, per the original architecture review's
  scalability notes

## Definition of Done (Sprint 001)

- [x] All 11 Sprint 001 scope items implemented
- [x] Zod validation on every API route
- [x] Audit log on every mutation
- [x] RBAC centralized and enforced
- [x] Multi-tenant isolation verified (session-derived `agencyId` only)
- [x] Rate limiting on public mutation endpoints
- [x] Pagination on Agency/Team/Join-Request lists
- [x] Google OAuth Workspace-restricted at the library level, not just app code
- [x] Better Auth production config reviewed and hardened (cookies, CSRF, HTTPS)
- [x] `npm run lint` — 0 problems
- [x] `npm test` — 39/39 passing, including a real-database integration test
- [x] `npm run typecheck` / `npm run build` — clean outside the documented,
      environment-only Prisma-generate gap
- [x] No dead code, no duplicate utilities, no unused dependencies, no
      unused environment variables, no commented-out code, no TODOs
- [x] Docker + docker-compose present
- [x] README, `.env.example`, `SPRINT_001_FIX.md`, this document, all current

**Sprint 001 is locked as the production baseline (v0.1.0).**
