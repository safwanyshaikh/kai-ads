# TASK 6 — Engineering Excellence Audit (Supreme Principle 15)

Ratings: /10, evidence-based. Principle 15 standard: zero dead code, zero
obsolete pipelines, zero unused APIs, zero placeholder docs, CI/CD, monitoring,
automated testing, rollback, feature flags, audit logs.

| Area | Rating | Evidence | Gap to close |
|---|---|---|---|
| **CI/CD** | **2/10** | 4 workflows exist, ALL `workflow_dispatch` or narrow-path (`.github/workflows/`); `lint`/`typecheck`/`test` npm scripts invoked by NO workflow; nothing runs on push/PR | One quality-gate workflow (lint + typecheck + vitest + build) on every push/PR; branch protection |
| **Monitoring** | **0/10** | No APM/error-tracking dependency in `package.json`; production errors discovered via user screenshots this very session (DOMMatrix, NUL-byte) | Error-tracking SDK + alerting on generation failures and quota/API errors |
| **Logging** | **7/10** | Structured pino everywhere (`src/lib/logger.ts`), scoped child loggers, secrets never logged; no aggregation/shipping story confirmed | Log drain/retention decision; correlate by request/generation ID |
| **Testing** | **8/10 coverage, 0/10 enforcement** | 53 files / 526 `it()` incl. real QR-decode, pixel-diff, live Better-Auth traces; 5 DB-gated integration suites. But un-run by any gate → protection is voluntary | CI gate (above); flip integration suites on in CI with a service database |
| **Security** | **7/10** | RBAC enforced on every non-public route (verified call-site table, Task audits); SSRF guard on file fetch; NUL-byte sanitization; rate limits on public endpoints; secure cookies/CSRF via Better Auth. Open items: `join_request:create` permission declared but unenforced (public creation is business-logic-gated only); contacts PATCH/DELETE reuse `advertisement:create` permission; no dependency-audit step in CI | Product decision on join-request gating; dedicated contact permissions; `npm audit`/Dependabot in CI |
| **Performance** | **6/10** | Indexed Prisma queries; pagination on all dashboard lists EXCEPT admin verification page (unbounded `listAll({})` + N+1 quota queries, `admin/agency-verifications/page.tsx:39-45`); base64 data-URI asset storage in the DB row (`generatedAssetUrl`) makes every advertisement row megabytes heavy — acceptable at pilot scale, a scaling liability later | Paginate + batch admin page; move generated assets to object storage (schema field already a string URL — additive change) |
| **Production readiness** | **4/10** | Boot-time env validation with descriptive errors (`env.ts`); honest degraded modes for unconfigured providers. But: no `maxDuration` anywhere vs 600s SDK default (Task 2 Blocker 1); daily budget guard a stub; deployment state unverifiable in-repo | Task 2 blockers; budget enforcement via existing `aggregateCostByAgency` |
| **Rollback** | **6/10** | Feature-flag rollback for both new pipelines is instant and clean (env var); no schema-destructive migrations to date; but no scripted DB rollback and no deploy-pinning runbook | Document flag-first rollback runbook; migration down-path policy |
| **Feature flags** | **9/10** | Three flags, all defined AND consumed at single dispatch points, all default OFF, drift-tested (`tests/*feature-flag*`, `*pipeline-adapter*`); pattern is exemplary | Retire flags per Task 7 once decisions land |
| **Audit logs** | **8/10** | Every lifecycle action recorded (`AUDIT_ACTIONS`, 30 actions incl. quota grants); fire-and-forget so it never breaks the primary transaction; pagination built | No admin UI to read them (`listPaginated` has zero callers — planned) |
| **Dead code / obsolete pipelines / unused APIs / placeholder docs** | **4/10** | 3 orphaned components, ~13 unused repo methods, 1 dead permission, 2 unused env vars, 8 UI-unreached API routes, 3-deep prompt cascade, 12 zero-byte docs (full inventory: Production Readiness Audit + Task 7) | Execute Task 7's plan in order |

**Overall Principle 15 rating: 5/10.** The strongest areas (flags, audit logs,
test authorship, validation-at-boot) are genuinely excellent; the constitution
is failed by what's *absent* (CI gate, monitoring, budget enforcement) rather
than what's badly built.

## Implementation roadmap (order of blast-radius, no implementation here)

1. CI quality gate on push/PR + branch protection — hours of work, removes the
   single largest ongoing risk.
2. Error tracking + alerts — before the GPT-native pilot generates real spend.
3. `maxDuration`/SDK timeout config (Task 2 blockers) — prerequisite to the pilot.
4. Daily budget enforcement wired to `aggregateCostByAgency`.
5. Admin verification page pagination + batched quota query.
6. Generated-asset storage migration off base64 rows (pre-scale).
7. Dead-code retirement per Task 7's sequenced plan.
8. Documentation backfill (002–006, ADRs, architecture) — last, so it records
   the post-decision architecture.
