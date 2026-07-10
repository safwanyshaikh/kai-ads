# SPRINT 002 — Advertisement Intelligence Engine

## Objective

Build the complete Advertisement Creation Engine.

- No AI Image Generation yet.
- No Export.
- No Payments.
- No Candidate Module.

## Screens

```
Dashboard
  ↓
Create Advertisement
  ↓
Paste Requirement
  ↓
Upload PDF
  ↓
Upload DOCX
  ↓
Upload Image
  ↓
Upload WhatsApp Screenshot
  ↓
AI Extraction Review
  ↓
Style Selection
  ↓
Preview
  ↓
Save
```

## Build

- Advertisement Entity
- Advertisement Service
- Advertisement Repository
- Advertisement APIs
- Advertisement Validation
- Advertisement Draft
- Advertisement Library
- Advertisement Versioning
- Advertisement Status
- Advertisement Search
- Advertisement Filters
- Advertisement Duplicate
- Advertisement Archive
- Advertisement Restore

## AI Extraction

Architecture only. Provider Interface only. **No GPT implementation.**

Create:

- Requirement Extraction Interface
- Trade Summary Interface
- Industry Detection Interface
- Country Detection Interface
- Employer Detection Interface
- Salary Detection Interface
- Interview Detection Interface

Everything must be provider independent.

## Advertisement Schema

- Header
- Industry
- Country
- Employer (Optional)
- Positions
- Benefits
- Interview
- Contact
- Footer
- Theme
- Advertisement Style
- Status
- Created By
- Created Date
- Updated Date

## Styles

- Visual
- Typography
- Newspaper

Store only. No rendering.

## Status

- Draft
- Review
- Approved
- Archived

## Database

- Advertisement
- AdvertisementVersion
- AdvertisementHistory
- AdvertisementDraft

## Rules

- Everything editable.
- No image generation.
- No export.
- No rendering.
- Only architecture.

## Acceptance

- CRUD complete.
- Search.
- Filters.
- Pagination.
- Version history.
- Soft delete.
- Restore.
- Audit Log.
- Unit Tests.
- Integration Tests.
- Production Ready.

## Self Audit

- Architecture
- Security
- Performance
- Scalability
- Code Quality
- Technical Debt

Automatically fix everything. Commit locally. Stop. Wait.

---

## Implementation notes (added after build)

This section records the engineering decisions made while turning the
brief above into code — kept here rather than only in commit messages so
the reasoning survives independently of git history.

- **Restore is a single action**, not two. The brief lists "Advertisement
  Archive" and "Advertisement Restore" as build items, and "Soft delete" /
  "Restore." separately under Acceptance. Rather than building two
  parallel restore mechanisms, `advertisementService.restore()` inspects
  the record and does the right thing: clears `deletedAt` if the ad was
  soft-deleted, otherwise moves `ARCHIVED` back to `REVIEW`.
- **Screens were consolidated**, not cut. AI Extraction Review, Style
  Selection, and Preview are one page (`/dashboard/advertisements/drafts/
  [draftId]`) with three sections, because all three edit the same
  `AdvertisementDraft` record — each section still persists to its own
  API endpoint (`/review`, `/style`, `/save`), so nothing is UI-only
  state. Paste/PDF/DOCX/Image/WhatsApp are one page
  (`/dashboard/advertisements/new`) with a method switcher, for the same
  reason: they all produce the same kind of Draft.
- **AI Extraction is genuinely unimplemented**, not a disguised mock.
  Every one of the seven provider interfaces has exactly one
  implementation in this sprint — a `NotImplemented*Provider` that throws
  `AiProviderNotImplementedError`. `advertisementDraftService.runExtraction()`
  expects this, catches it, and resolves the draft to
  `EXTRACTION_FAILED` with a human-readable `extractionError` — the
  review screen's fallback-to-manual-entry path is therefore a tested,
  first-class code path in this sprint, not a placeholder for later.
- **Content blocks are JSON columns** (`positions`, `benefits`,
  `interview`, `contact`, `theme`), validated by Zod at the API boundary
  but not rigid SQL columns. This matches "Everything editable" and
  avoids a schema migration every time a block's shape changes before the
  rendering engine (a later sprint) settles what each style actually
  needs.
- Real-database verification follows the same substitution used in
  `SPRINT_001_FIX.md`: this sandbox cannot run `prisma generate`
  (`binaries.prisma.sh` is outside its network allowlist), so
  `tests/integration/advertisement-flow.test.ts` runs the equivalent SQL
  directly against a real PostgreSQL 16 instance instead of through the
  generated Prisma Client.
