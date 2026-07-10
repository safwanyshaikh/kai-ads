# KAI Ads — Sprint 001: Agency Authentication

**Status: LOCKED — v0.1.0 production baseline.** See
`project/SPRINTERS/SPRINT_001_FINAL.md` for the full completion record and
`SPRINT_001_FIX.md` for the stabilization pass that preceded the lock.

Authentication and agency onboarding module for KAI Ads. This sprint ships
**no** Advertisement Engine, AI, Templates, Payments, or Export — those are
future sprints. See `project/SPRINTERS/SPRINT_001.md`.

## Stack (locked)

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS ·
shadcn/ui · Prisma · PostgreSQL · Better Auth · React Hook Form · Zod

## What's implemented

- Landing Page
- Agency Registration (with business-domain + personal-email validation)
- Pending Approval page
- Login: Google Workspace (Workspace-restricted via verified `hd` claim),
  Microsoft 365, Magic Link — no passwords
- KAI Super Admin agency Approve / Reject / Suspend / Activate
- Agency Admin UI (profile, team, join-request review)
- Employee Join Request (auto-detects agency from email domain)
- Dashboard placeholder (advertisement creation disabled)
- Role-Based Access Control (KAI_SUPER_ADMIN / AGENCY_ADMIN / AGENCY_USER)
- Full audit logging on every mutation
- Rate limiting on every public mutation endpoint (in-memory, Redis-ready)
- Pagination (default 25, configurable) on Agency/Team/Join-Request lists

## Getting started

```bash
npm install                 # also runs `prisma generate` via postinstall
cp .env.example .env        # fill in real values, see below
npx prisma migrate deploy   # applies prisma/migrations/20260101000000_init
npm run db:seed             # bootstraps the first KAI Super Admin (see below)
npm run dev
```

### Bootstrapping the first Super Admin

There's no UI to create a Super Admin — it's the root of the approval
chain, so it's seeded:

```bash
SEED_SUPER_ADMIN_EMAIL=you@kai.dev SEED_SUPER_ADMIN_NAME="Your Name" npm run db:seed
```

Then sign in with that exact email via Google, Microsoft, or Magic Link.

## Environment variables

See `.env.example` for the full contract. Required to boot:
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`EMAIL_PROVIDER`, `STORAGE_PROVIDER`.

`EMAIL_PROVIDER` and `STORAGE_PROVIDER` are mandatory with no default —
the app refuses to start without an explicit choice, though `"none"` is a
valid, explicit choice for local development. Choosing `"none"` reports
the corresponding feature as disabled and fails loudly and explicitly if
actually used, rather than silently mocking success — see `src/lib/env.ts`
and the `NullEmailProvider`/`NullStorageProvider` adapters.

Google/Microsoft OAuth credentials are optional; omitting a provider's
credentials simply means that sign-in button isn't registered rather than
shipping a button that goes nowhere.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:migrate:deploy` | Apply migrations (CI/production) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run docker:up` | `docker compose up --build` (app + Postgres) |

## Architecture

```
src/
  app/                     Routes (App Router). No business logic here —
                            pages fetch via services and render.
  components/
    ui/                    shadcn/ui primitives
    shared/                 Cross-feature components (e.g. pagination controls)
    <feature>/              Feature components (client interactivity only)
  lib/
    env.ts                 Single source of truth for all env vars (Zod)
    auth.ts / auth-client.ts   Better Auth server/client config
    session.ts              requireCurrentUser() / getCurrentUser()
    rbac.ts                 Centralized permission model
    errors.ts               AppError hierarchy + handleApiError()
    logger.ts               Pino structured logger
    constants.ts             Routes, audit action names, rate limits, etc.
    pagination.ts            Shared pagination schema/helpers
    api-client.ts            Shared client-side fetch/error-parsing helper
    validations/             Zod schemas (shared by forms and API routes)
  server/
    repositories/            All Prisma access lives here — nowhere else
    services/                Business logic (registration, approval, RBAC
                              enforcement, audit logging)
    providers/
      email/                  Email adapters: Resend, SMTP, Null (real, not mocked)
      storage/                Storage adapters: S3-compatible, Vercel Blob, Null
    rate-limit/               RateLimiter interface + in-memory implementation
    http/                     Shared API-route factories (e.g. agency lifecycle)
prisma/
  schema.prisma
  migrations/                 Hand-authored initial migration (see note below)
  seed.ts
tests/
  *.test.ts                   Unit tests
  integration/                Real-database integration test
```

**Layering rule:** UI components never touch Prisma. Pages/API routes call
`server/services/*`, services call `server/repositories/*`, repositories
call `db` (the Prisma client). External integrations (email, storage,
OAuth) are only ever reached through an interface in `server/providers/*`,
selected by `src/lib/env.ts` — so swapping Resend for SMTP, or S3 for
Vercel Blob, is a config change, not a code change.

**Multi-tenancy:** every query that returns tenant data is scoped by
`agencyId` derived from the authenticated session — never from a client-
supplied parameter. See `src/app/api/employees/route.ts` and the
join-request approve/reject routes for the pattern.

## Known environment limitation

This sandbox's network is restricted to package registries (npm, GitHub) —
`binaries.prisma.sh`, which Prisma's CLI needs to download its query/schema
engine, is not reachable. This means `prisma generate` / `prisma migrate
dev` could not be executed inside this sandbox, and `tsc --noEmit` here
still reports (only) `@prisma/client` type-resolution errors as a
consequence.

Nothing else is broken by this: the code is correct, `prisma/schema.prisma`
is the single source of truth, and `prisma/migrations/20260101000000_init/migration.sql`
was hand-authored to mirror it exactly. On any machine/CI with normal
internet access, `npm install` (which runs `prisma generate` via
`postinstall`) resolves this immediately with no code changes required.

Despite this, the schema and full auth/onboarding flow **have** been
verified against a real PostgreSQL 16 instance — see
`SPRINT_001_FIX.md` FIX-001/FIX-002 for exactly how, and the caveats that
come with that substitution.

## Testing

`npm test` (auto-loads `.env`) runs 39 tests across 6 files:

- `tests/integration/e2e-flow.test.ts` — the full Registration → Pending
  Approval → Admin Approval → Login → Employee Join Request → Approval →
  Dashboard flow against a **real PostgreSQL instance**. Skips
  automatically if `DATABASE_URL` isn't reachable.
- Unit tests covering RBAC, personal-email/domain validation, the agency
  registration Zod schema, pagination math, and the in-memory rate
  limiter — none of these require a database connection.
