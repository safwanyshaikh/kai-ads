# Changelog

All notable changes to KAI Ads are documented here.

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
