# SPRINT 004 — KAI Advertisement Generation Engine + Unified Verification QR Badge + Trust Layer + Section-Based Editing

Starts strictly from `cdc578d`. Sprints 001–003 are verified, closed, and
not reopened. This sprint reuses and extends existing schema, services,
repositories, providers, and validation wherever the brief's needs
already exist in the codebase — it does not duplicate them.

## Objective

Transform an approved structured recruitment requirement (Sprint 002/003)
into a professional overseas recruitment advertisement. Not a generic AI
image generator, not Canva, not a poster maker. Advertisement first,
verification second, decoration last.

## Core Product Rule

A recruiter must not repeatedly type known information — agency name, RA
license number, registered address, official email/website, logo(s),
selected contacts, and the official verification URL all come from the
approved agency profile (Sprint 001) or saved contact directory (Sprint
003), never retyped.

## Advertisement Generation Flow

Approved Structured Requirement → Select Platform/Aspect Ratio → KAI
Recommends Advertisement Type → Accept or Change Type → Select Theme →
Generate → Review → Edit Individual Section if Required → Regenerate
Only Changed Section → Trust Validation → QR Decode Validation → Save
Version → Ready for Export (future sprint).

## Three Advertisement Types

Reuses the existing `AdvertisementStyle` enum (`VISUAL`, `TYPOGRAPHY`,
`NEWSPAPER`) introduced in Sprint 002 — no new enum needed.

1. **Visual Poster** — industry/trade imagery, human characters where
   appropriate, strong recruitment hierarchy. For single critical
   requirements, small position counts, high-impact social ads. No
   generic AI visual clichés, no repeated identical layouts.
2. **Typography Poster** — strong fonts, clear hierarchy, minimal/no
   photography, high readability. For urgent/salary-focused/multi-
   position/information-heavy ads.
3. **DTP / Newspaper Poster** — a core KAI Ads USP. Dense, structured
   columns/boxes/rules/headings, traditional recruitment-ad hierarchy,
   high information density, minimal decoration. Must feel authentic to
   newspaper recruitment advertising, not a modern AI poster or SaaS
   dashboard.

## Advertisement Density Intelligence

Classifies every requirement LOW / MEDIUM / HIGH (roughly: 1 critical
position → LOW, ~5 positions → MEDIUM, 20–30 positions → HIGH) and uses
that to recommend type, layout, font hierarchy, columns, image usage,
section compression, and badge size. Never forces a high-density
requirement into a visual-heavy layout that makes positions unreadable.

## Platform Formats

WhatsApp Status, Instagram Post/Story, Facebook Post, LinkedIn Post,
YouTube Community Post, Generic Square/Portrait/Landscape. Aspect ratios
and dimensions centralized in one place — never hardcoded per component.
Architecture supports adding platforms without rewriting the generation
engine.

## Theme Intelligence

No hex codes, font names, gradients, or design terminology shown to the
recruiter. When a logo exists, dominant/supporting colors are analyzed
and suitable themes recommended as visual choices. Minimum theme
families: Corporate, Industrial, Urgent Hiring, Premium, Minimal, High
Contrast, Newspaper Classic, Newspaper Modern, Country Inspired, Industry
Inspired. Agencies aren't locked to one color scheme forever, but their
identity (logo, name) stays recognizable.

## AI Image Provider Architecture (KAI Creative Engine)

Reuses the Sprint 003 provider-abstraction pattern exactly: an interface,
a real OpenAI-backed implementation (GPT Image API), a Null stand-in when
unconfigured, and a factory that never exposes provider/model names to
agency users. Centralizes provider, model, quality, size, cost settings,
retry rules, timeout, and fallback behavior — no hardcoded model names,
no silent fallback to a different provider.

## Image Generation Cost Control

Reuses the Sprint 003 `AiUsageLog` table and `costTrackingService` — new
`AiOperationType` values (`FULL_AD_GENERATION`, `SECTION_REGENERATION`,
`THEME_VARIATION`, `RETRY`, `SYSTEM_RETRY`) rather than a parallel
tracking table. Failed provider executions never consume billable quota.

## Bootstrap Trial Quota

Architecture for 10 free successful full-advertisement generations per
*agency* (shared across every employee, not per-user) — usage tracking
now, no payment collection. Includes a global AI kill switch and daily
budget guard architecture, admin-visible usage data, no billing UI yet.

## Section-Based Advertisement Architecture

Every advertisement is divided into editable sections: HEADER,
COUNTRY_INDUSTRY, POSITIONS, BENEFITS, INTERVIEW, CONTACT, AGENCY_FOOTER,
VERIFICATION_BADGE. Sections with no data disappear cleanly — never "N/A"
or "Information Missing" outside an explicit review workflow.

## Critical Editing USP

Editing one section creates a new `AdvertisementVersion` (Sprint 002,
extended) tracking the changed section, previous/new content, who/when,
reason, and whether AI regeneration or a manual edit was used. Unchanged
approved content, advertisement identity, and layout intent are
preserved. If the image provider cannot truly perform isolated regional
regeneration, the architecture must say so honestly rather than claim a
capability it doesn't have.

## Unified Verification QR Badge

One compact badge, not a separate badge and a separate QR. Contains: "MEA
REGISTERED AGENCY", "RA LICENSE ID: {number}" (from the approved agency
profile only — never editable inside the ad editor), a scannable QR,
"VERIFY AGENCY", optional "KAI ADS" micro-mark. Shapes: circular, rounded
square, compact rectangle. Sizes: compact/standard/large, auto-selected
by KAI based on dimensions/density/positions/whitespace/style/platform.

## Legal Language / Government Branding Restriction

No "Government Approved", "MEA Approved", "Official Government QR",
"Meta/Facebook/WhatsApp/LinkedIn Approved", "Platform Safe", "Ban Proof",
or guaranteed-reach/approval claims. Allowed: "MEA REGISTERED AGENCY",
"RA LICENSE ID: {number}", "VERIFY AGENCY", "Scan to verify agency
details on the official Government of India source", "Designed for
recruitment transparency." No imitation of the Ashoka Emblem, Government
of India emblem, or any official government seal — the KAI badge must be
visually original.

## QR Architecture

The QR never encodes the official MEA/eMigrate URL directly. It points to
a KAI tracking URL (`https://{KAI_PUBLIC_DOMAIN}/v/{agencyVerificationId}?a={advertisementTrackingId}`)
that records permitted scan intelligence, then immediately redirects to
the agency's official government verification destination — so existing
printed/shared QR codes keep working even if that destination changes
later.

## Agency Verification Workflow

KAI Super Admin (reusing the Sprint 001 `KAI_SUPER_ADMIN` role) verifies
an agency: status, official government verification URL, verification
date, verified-by, evidence reference, license validity, reverification-
required flag, notes, suspension status. Agency receives a permanent
Agency Verification ID. Every action audit-logged (reusing the Sprint 001
`AuditLog`).

## Advertisement-Level Tracking + QR Scan Intelligence

Every advertisement gets a unique tracking identifier — not one shared
agency QR for everything. Scan events are privacy-preserving: no
candidate identity, login, or registration required; no raw IP stored
indefinitely; approximate geography only where legally/technically
appropriate.

## QR Redirect Flow

Scan → KAI tracking endpoint → record event → immediate redirect. No
interstitial screen. If the official destination is unreachable, a
minimal fallback page shows agency name, RA license ID, and KAI
verification status — never a false claim of official verification.

## QR Scannability / Social Compression Readiness

Every generated advertisement must pass automated QR decode verification
before it can be marked ready — if KAI can't decode its own QR, ready
status is blocked. Tested against representative compression/resize
transformations; no guaranteed-platform-compatibility claims without
evidence.

## Social Trust Check

Before "ready": agency identity present, RA License ID present,
verification QR decodable, contact info present, no misleading/false-
approval/unauthorized-branding/deceptive-impersonation content. Status:
`TRUST_READY` / `REVIEW_RECOMMENDED` / `BLOCKED`. Never called "Facebook/
WhatsApp/Meta/LinkedIn Approved."

## KAI Knowledge Capture

Preserve advertisement type, theme, platform format, density, industry,
country, positions, badge type/size, QR scan events, trust check result
and warnings, generation provider/model/cost/latency, section
regeneration events, recruiter corrections, and (if later voluntarily
reported) publication/flag/rejection/restriction events. No analytics
dashboard yet — architecture only.

## Important Architectural Decision

Before final poster rendering: evaluate AI-generated background/assets +
deterministic HTML/SVG/Canvas composition for exact text (recruitment
facts, agency data, QR, badge) vs. asking an image model to render the
entire advertisement including all text. Choose whichever best
guarantees correct spelling, exact salary/phone/RA number/position
names, reliable QR scanning, section editing, multi-position support, DTP
layouts, and version control — not whichever is simplest. Documented in
an ADR.

## Do Not Build

Payments, paid subscriptions, candidate application/registration/
database, recruitment marketplace, advanced analytics dashboard, social
media auto-publishing, platform partnerships, guaranteed moderation
claims. Do not reopen Sprints 001–003.

## Completion

Typecheck, lint, unit tests, integration tests, build where environment
permits. Final Sprint 004 implementation report. Update README.md,
CHANGELOG.md, this file. Commit locally. Push to main if credentials are
available. Do not start Sprint 005. Stop.

---

## Implementation notes (added after build)

See `project/SPRINTERS/SPRINT_004_FINAL.md` for the complete implementation
report and self-audit findings, and `decisions/ADR-006 Advertisement
Rendering Architecture.md` for the required architecture decision made
before building the renderer. Summary: deterministic SVG composition
(Typography/Newspaper) is real and fully working end-to-end today,
including a genuine QR generate-and-decode-verify step using real
libraries (`qrcode`/`jsqr`/`pngjs`), not a simulated one. The Visual
style's AI background generation is a real, complete OpenAI GPT Image
implementation that is genuinely called — but composing that background
with the deterministic text/QR/badge layers into one finished
advertisement is not built this sprint, and requesting Visual generation
says so honestly rather than faking a result. Agency Verification,
Bootstrap Trial Quota (agency-level, not per-user), and QR Scan
Intelligence are all real, tenant-isolated, and covered by a 12-test
real-database integration test alongside 214/214 tests passing overall.
