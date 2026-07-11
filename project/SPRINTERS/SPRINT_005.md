# SPRINT 005 — KAI Ads MVP Completion

Starts strictly from `a35c9d0`. Sprints 001–004 closed, not reopened.
Every piece below reuses and extends existing schema/services/RBAC/
rate-limiting/pagination/cost-tracking/QR/trust/quota/verification/
contact-directory logic — no parallel systems.

## Objective

Complete the real, usable MVP: Agency Login → Dashboard → Create
Advertisement → Paste/Upload Requirement → KAI Extraction → Recruiter
Review/Correction → Contact Selection → Platform Selection → Type
Recommendation → Theme Selection → Generate → Review Final Advertisement
→ Edit Section → Trust Check → QR Validation → Download → Library. No
demo, no placeholders, no fake functionality.

## Critical Scope — closing the Sprint 004 gap

Visual style must produce one finished, downloadable advertisement: AI-
generated background/asset + deterministic composition of exact text
(positions, salary, contact, agency name, RA license number), agency
logo, the Unified Verification QR Badge, and trust information — never
the image model rendering critical text itself.

## Three Real Advertisement Types

Visual, Typography, DTP/Newspaper — all three must produce a finished
downloadable advertisement. None may remain architecture-only or return
"not implemented."

## Visual Advertisement Rules

Background relevant to industry/country/project type/trade/position
count/density (Oil & Gas → industrial plant/refinery/pipelines/offshore;
Construction; Hospitality; Healthcare; Automotive; Manufacturing; etc.).
No irrelevant generic corporate imagery, no fake employer logos/branding,
no critical text inside the AI-generated background.

## Multiple Positions / Density

1 position through 20–30 positions must all be handled. High-density
requirements never get text shrunk to unreadable — Typography/DTP is
recommended automatically, and choosing Visual anyway triggers a warning
rather than a silently broken advertisement.

## Production UI/UX

The recruiter is not a designer, developer, or AI expert. Minimize
typing: selections, cards, visual choices, smart defaults, saved agency
info, saved contacts, AI recommendations. Never ask for hex codes, font
names, model/provider names, or rendering parameters.

## Required Screens (complete and production-polished)

Landing, Registration, Pending Approval, Login, Join Agency, Dashboard,
Agency Profile, Contact Directory, Create Advertisement, Requirement
Input, AI Extraction Review, Style Selection, Theme Selection, Platform
Selection, Advertisement Preview, Section Editor, Advertisement Library,
Advertisement Detail, Agency Verification Admin, KAI Super Admin Agency
Management, Usage/Quota Display.

## Export

Real PNG/JPG/PDF download preserving exact text, readable typography, QR
scannability, correct dimensions, agency identity. Useful file names
(e.g. `saudi-arabia-oil-gas-pipe-fitter-kai-ads.png`), never leaking
secrets or internal IDs into public file names.

## Bootstrap Trial + Global Cost Safety

10 free successful full generations per agency (not per user, all
employees share it) — reuses Sprint 004's `AgencyGenerationQuota`. Only
successful generations count; provider/system failures and system-caused
QR failures don't. Global AI kill switch, daily budget guard, admin
usage visibility — reuses Sprint 004's architecture. No payments yet.

## QR Quality Gate

QR must decode successfully and trust check must pass before download is
allowed. Never export a knowingly broken verification QR.

## Lovable Alignment / Mobile / Accessibility / Performance

Audit and reuse the existing design system (shadcn/ui tokens, components)
rather than redesigning blindly. Every major journey must work on
desktop/tablet/mobile, with keyboard navigation, visible focus, labels,
contrast, and touch targets intact. No full-resolution assets in list
views; real (not fake) progress states during generation.

## Testing

Unit tests for composition (all three styles), exact-text/RA-
number/contact/salary preservation, multi-position/high-density layouts,
theme/platform selection, quota enforcement (agency-shared, failure-non-
billing, kill switch, budget guard), PNG/JPG/PDF export, QR-decode-
before-download, trust-check-before-download, section editing, tenant
isolation. Integration test for the complete journey end-to-end, plus
"10 successful generations → 11th blocked" and "provider failure → quota
not consumed."

## Real OpenAI Test

If `OPENAI_API_KEY` is available: one controlled real Visual generation,
minimal cost, verifying background relevance, composition, exact text,
QR decode, trust check, download — recorded in the Sprint 005 report.

## Do Not Build

Payments, subscriptions, candidate application/registration/database,
marketplace, analytics dashboard, social auto-publishing, platform
partnerships, guaranteed moderation claims. Sprints 001–004 not reopened.

## Completion

Typecheck, lint, unit tests, integration tests, build where environment
permits. `SPRINT_005_FINAL.md`, README/CHANGELOG/this file updated.
Commit; push if credentials available. Stop before Sprint 006.

---

## Implementation notes (added after build)

See `project/SPRINTERS/SPRINT_005_FINAL.md` for the complete report. The
headline fix: Visual style now genuinely completes — AI background (or an
honest deterministic gradient fallback) rasterized together with the
deterministic text/QR/badge composition into one real PNG, exportable to
PNG/JPG/PDF. A real architecture bug was caught and fixed by this
sprint's own audit: the agency logo was being embedded via a remote URL
in SVG, which `sharp`'s renderer silently renders blank (verified
directly) rather than fetching — now fetched and inlined as base64
first. 241/241 tests passing, including a test that decodes the QR from
the *fully rasterized final advertisement* for all three styles, not
just the standalone QR. No live OpenAI test was possible from this
sandbox (no API key, no network path to `api.openai.com`) — stated
plainly in the final report rather than assumed away.
