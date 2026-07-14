# KAI Ads — Sprint 001–005

**Status:** Sprint 001–004 closed (see each sprint's `_FINAL.md`). Sprint
005 (MVP Completion — Visual composition, real PNG/JPG/PDF export,
production UI) complete — see
`project/SPRINTERS/SPRINT_005_FINAL.md`.

No Payments, Candidate Module, advanced analytics dashboard, or social
auto-publishing — all explicitly out of scope through Sprint 005.

## Stack (locked)

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS ·
shadcn/ui · Prisma · PostgreSQL · Better Auth · React Hook Form · Zod ·
OpenAI (KAI Intelligence Engine / KAI Creative Engine) · `qrcode` / `jsqr`
· `sharp` (SVG rasterization, PNG/JPG export) · `pdf-lib` (PDF export)

## What's implemented

**Sprint 001 — Agency Authentication:** registration, approval workflow,
Google/Microsoft/Magic-Link login, RBAC, audit logging, rate limiting,
pagination.

**Sprint 002 — Advertisement Intelligence Engine:** Advertisement CRUD,
versioning, search/filter, duplicate/archive/restore/soft-delete,
Advertisement Draft flow (paste/upload → review → style → preview →
save), AI extraction provider architecture (interfaces only at this
stage).

**Sprint 003 — KAI Recruitment Intelligence Engine:** the Sprint 002
provider interfaces connected to a real OpenAI implementation (Responses
API, structured outputs), PDF/DOCX/image input processing, Contact
Directory, AI cost tracking. Externally verified against a live OpenAI
API — see `project/SPRINTERS/SPRINT_003_FINAL.md`.

**Sprint 004 — Generation Engine + Trust Layer:**
- Advertisement Generation Flow: platform format selection → density-
  based type recommendation → deterministic Typography/Newspaper
  rendering (real SVG, no AI dependency) → Unified Verification QR Badge
  → automated QR decode verification → Social Trust Check → versioned save
- Section-based editing (Critical Editing USP): one section changes at a
  time, tracked with before/after data, never a full silent regeneration
- Agency Verification Workflow (KAI Super Admin), Bootstrap Trial Quota
  (10 free generations, shared per agency), QR Scan Intelligence
  (privacy-preserving), KAI Creative Engine (OpenAI GPT Image)
  architecture for the Visual style — see `SPRINT_004_FINAL.md` for what's
  fully wired vs. architecture-only

**Sprint 005 — MVP Completion:**
- Visual style closed the loop: real AI background (or an honest
  deterministic gradient fallback) rasterized together with the exact
  recruitment text/QR/badge into one finished PNG — all three
  advertisement styles now produce a real, downloadable result
- Real PNG/JPG/PDF export, gated on the QR decoding successfully and the
  trust check passing, with useful and secret-free filenames
- Theme selection has a genuine effect on the rendered output
- Section Editor UI, Usage/Quota display, Admin usage visibility

## Getting started

```bash
npm install                 # also runs `prisma generate` via postinstall
cp .env.example .env        # fill in real values, see below
npx prisma migrate deploy   # applies every migration under prisma/migrations/
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
valid, explicit choice for local development.

Optional, feature-gated (the app runs without them, the corresponding
feature reports itself unavailable): `GOOGLE_CLIENT_ID`/`SECRET`,
`MICROSOFT_CLIENT_ID`/`SECRET`, `OPENAI_API_KEY` (gates both the KAI
Intelligence Engine's text/vision extraction and the KAI Creative
Engine's image generation), `KAI_TEXT_MODEL`, `KAI_VISION_MODEL`,
`KAI_IMAGE_MODEL`. `KAI_PUBLIC_DOMAIN` controls the QR tracking URL's
host. `AI_KILL_SWITCH` and `AI_DAILY_BUDGET_USD` are the Sprint 004 cost-
control guards.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest tests (auto-loads `.env`) |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:migrate:deploy` | Apply migrations (CI/production) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run docker:up` | `docker compose up --build` (app + Postgres) |

## Architecture

```
src/
  app/                     Routes (App Router). No business logic here.
    v/[agencyVerificationId]/  Public QR redirect endpoint (Sprint 004)
  components/
    ui/                    shadcn/ui primitives
    shared/                 Cross-feature components
    <feature>/              Feature components (client interactivity only)
  lib/
    env.ts                 Single source of truth for all env vars (Zod)
    platform-formats.ts     Centralized platform/aspect-ratio registry (Sprint 004)
    rbac.ts / errors.ts / logger.ts / constants.ts / pagination.ts / api-client.ts
    validations/             Zod schemas (shared by forms and API routes)
  server/
    repositories/            All Prisma access lives here — nowhere else
    services/                Business logic
    providers/                Email/storage adapters (Sprint 001)
    ai/
      openai/                 KAI Intelligence Engine — real OpenAI text/vision (Sprint 003)
      image/                  KAI Creative Engine — real OpenAI image generation (Sprint 004)
    generation/               Density/type/theme/badge intelligence, QR gen+decode,
                              deterministic section renderer, trust check (Sprint 004)
    rate-limit/ / http/
prisma/
  schema.prisma
  migrations/                 Hand-authored (see "Known environment limitation")
  seed.ts
decisions/
  ADR-006 Advertisement Rendering Architecture.md   AI background + deterministic
                                                     text/QR/badge composition, and why
tests/
  *.test.ts                   Unit tests
  integration/                Real-database integration tests
```

**Layering rule:** UI components never touch Prisma. Pages/API routes call
`server/services/*`, services call `server/repositories/*`, repositories
call `db`. External integrations (email, storage, OAuth, AI text/vision,
AI image) are only ever reached through an interface in
`server/providers/*` or `server/ai/*`, selected by `src/lib/env.ts`.

**Multi-tenancy:** every query that returns tenant data is scoped by
`agencyId` derived from the authenticated session — never from a client-
supplied parameter.

## Governance & source-of-truth registry

| Document | Authority | Scope |
| --- | --- | --- |
| `docs/000_PRODUCT_CONSTITUTION.md` | Product law (LOCKED) | Whole product |
| `docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md` | Primary commercial design authority | Every advertisement layout, archetype, typography, imagery, footer/CTA, visual-QA decision |
| `decisions/ADR-*.md` | Architecture decisions | As titled |

If any code, prompt, AI instruction, or older document conflicts with the
Advertisement Composition Constitution, the Constitution wins unless the
product owner amends it. Runtime enforcement:
`src/server/generation/archetypes/composition-constitution.ts` (wired
through `composeAdvertisement()`); regression lock:
`tests/composition-constitution.test.ts`.

## Known environment limitation

This sandbox's network is restricted to package registries — neither
`binaries.prisma.sh` (Prisma's engine binaries) nor `api.openai.com` are
reachable from here, and no OpenAI API key is available in this
environment either. `prisma generate` therefore could not run here, and
every real OpenAI-backed implementation (Sprint 003's text/vision
extraction, Sprint 004's image generation) is architecturally complete
and type-checks against the real SDK but has never executed against a
live model *from this sandbox*. Sprint 003's implementation *was*
externally verified against a live OpenAI API afterward — see
`project/SPRINTERS/SPRINT_003_FINAL.md`'s "External Production
Verification" section.

Nothing else is broken by this: `prisma/schema.prisma` is the single
source of truth, and every migration under `prisma/migrations/` was
hand-authored to mirror it exactly, then applied and verified against a
real PostgreSQL 16 instance. `npm install` (which runs `prisma generate`
via `postinstall`) resolves the Prisma half of this automatically on any
machine with normal network access.

## Testing

`npm test` runs 241 tests across 31 files, including real-database
integration tests (Sprint 001 auth flow, Sprint 002 advertisement
lifecycle, Sprint 003 KAI Intelligence Engine + tenant isolation, Sprint
004 generation engine + Agency Verification + Bootstrap Trial Quota + QR
Scan Intelligence, Sprint 005 quota-exhaustion scenarios), genuine QR
generate-and-decode-verify tests against the real `qrcode`/`jsqr`/`pngjs`
libraries, and — critically — a test that rasterizes the full advertisement
composition (background + text + QR + badge) for all three styles and
decodes the QR from that final image, not just the standalone QR. None
of this is simulated. Deterministic dependency-injected fake providers
(`tests/fakes/`) stand in for OpenAI in every automated test; no live API
key is required to run the suite.
