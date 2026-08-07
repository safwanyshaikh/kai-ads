# Founder Acceptance Testing Guide — /internal/fat

Task 006.5. How to validate Tasks 001–006 against real recruitment requirements
using the Founder-only console at `/internal/fat`.

## 1. Sign in

Go to `{PREVIEW_URL}/login` and sign in as `founder@kariger.ai` (or whichever
email `SEED_SUPER_ADMIN_EMAIL` is set to on this environment) via magic link,
Google Workspace, or Microsoft 365 — whichever this environment has configured.
You'll land on `/dashboard`; navigate to `/internal/fat` directly.

If `/internal/fat` redirects you to `/dashboard`, your signed-in account is not
`KAI_SUPER_ADMIN`. Only the seeded Super Admin can reach this page.

## 2. What you're testing, and what each card means

RUN PIPELINE walks one requirement through five stages. Each renders as an
expandable card with **Decision / Confidence / Reason / Source**. Two of the
five are real, existing engines exposed as-is; one is a real pre-render
decision; one is a real compliance check; one genuinely doesn't exist yet:

| # | Card | What you're actually validating |
|---|---|---|
| 1 | **Requirement Intelligence** | Did the KAI Intelligence Engine correctly read your pasted/uploaded requirement — country, industry, positions, salary, benefits, interview, contact — with sensible per-field confidence? |
| 2 | **Job Order** | Was a valid Advertisement record created from what was extracted? This is the same record type every real agency's advertisements are stored as. |
| 3 | **Compliance Intelligence** | Does the saved Job Order pass the real trust check (licence present, contact present, QR decodable, no prohibited claims)? |
| 4 | **Campaign Intelligence** | Always reports "Not implemented" — there is no Campaign Intelligence engine in Tasks 001–006. This is expected, not a bug. |
| 5 | **Layout Intelligence** | Does the requirement classify into the right density tier (LOW/MEDIUM/HIGH) and get a sensible badge shape/size? |

**If you want to see the actual rendered advertisement and the real
footer/branding layout decision** (the deeper half of Layout Intelligence),
click **Generate Full Advertisement** after a run produces a Job Order. This
calls the real image-generation pipeline — it costs one generation credit and
takes 30–120 seconds, which is why it's a separate opt-in button, not part of
RUN PIPELINE itself.

## 3. Test requirements to run

Use real, varied requirements — pasted text today; PDF/DOCX/Image once you
have sample files. A few to start with, in increasing difficulty:

**A. Clean, simple (should extract HIGH confidence, no warnings)**
```
Urgently required for Saudi Arabia — Oil & Gas Running Plant Maintenance.
Client interview on 25th August 2026 at our Mumbai office.
Instrument Technician — 5 nos, min. 5 years experience, Diploma in
Instrumentation, salary SAR 3500.
Electrical Technician — 3 nos, min. 5 years experience, ITI Electrical,
salary SAR 3200.
Free food, accommodation and transportation. 2 year contract.
Send CV to jobs@testagency.com or call +91 9876543210.
```

**B. Multiple interview cities/dates (tests interviewEvents, not just
interviewDate)**
```
Required for Dubai construction project.
Client interview: Baroda on 14th & 15th July, Mumbai on 18th July.
Site Civil Engineer — min. 5 years, degree in Civil Engineering.
Construction Foreman — 5-7 years Gulf experience.
```

**C. Graduated pay scale (tests salaryTiers, not a single salary figure)**
```
Welder required for Qatar. 6G TIG & ARC Welder (CS).
8 to 9 years experience: SAR 10,000. 9 to 10 years: SAR 11,000.
10+ years: SAR 12,500.
```

**D. Deliberately sparse (tests honest nulls, not invented data)**
```
Electricians needed. Contact us.
```
Expect LOW confidence, most fields null, and warnings — not fabricated
country/salary/interview data. This is the most important negative test:
**the extraction engine must never invent a fact it wasn't given.**

**E. Ambiguous/duplicate positions (tests possibleDuplicateOfIndex)**
```
Hiring: Pipe Fitter (5 nos), Piping Fitter (3 nos), for Saudi Arabia oil & gas.
```

## 4. What "pass" looks like

- Requirement Intelligence: fields you can verify by eye against the source
  text match, confidence is HIGH where the source was explicit and LOW/MEDIUM
  where it was vague or absent, and `warnings` names anything genuinely
  ambiguous.
- Job Order: a real Advertisement ID is returned; the positions/benefits/
  interview/contact blocks match what Requirement Intelligence extracted.
- Compliance Intelligence: TRUST_READY for a complete requirement with
  contact info; REVIEW_RECOMMENDED (not BLOCKED) for one missing only
  non-critical fields; BLOCKED only for a genuinely undecodable QR or a
  prohibited claim.
- Layout Intelligence: density tier matches your intuition for the position
  count/headcount (1 critical role → LOW, 5 roles → MEDIUM, 20+ → HIGH).

## 5. Exporting evidence

Every run gets three export links once it completes:
- **Export JobOrder JSON** — just the saved Advertisement record.
- **Export Intelligence JSON** — every stage except the Job Order (useful for
  comparing extraction quality across requirements without the noise of the
  saved-record shape).
- **Export Complete Result** — everything, exactly as stored in the run's
  history row.

**Run History** at the bottom of the page lists every run (yours and any other
Founder's) with a one-click Complete Result export — use it to compare runs
across a testing session without re-running anything.

## 6. Known gaps to expect, not report as bugs

- **Excel, Voice Note, Google Sheet URL, Website URL** are shown as disabled
  buttons with an explanation. These are not wired to any extraction logic —
  intentionally out of scope for Task 006.5.
- **Campaign Intelligence** will always say "Not implemented." There is no
  such engine in Tasks 001–006.
- If this Preview has no `OPENAI_API_KEY` / Gemini key configured,
  Requirement Intelligence will report `EXTRACTION_FAILED` with a clear
  reason, and every downstream stage will correctly report `SKIPPED` rather
  than fabricate a result. That's the system behaving honestly under a
  missing-configuration condition, not a defect in the FAT console.

## 7. Reporting a real defect

If a card's Decision doesn't match what the source text actually says —
especially an invented fact, a dropped position, or a wrong country/salary —
export the Complete Result JSON for that run and share it verbatim. The raw
JSON viewer on the page (and the export) is byte-for-byte what the engine
returned; nothing is reformatted for display.
