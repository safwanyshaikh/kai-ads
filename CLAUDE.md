# KAI Ads — Project Instructions

## Supreme Constitution (highest law — read first)

**`docs/009_KAI_ADS_SUPREME_CONSTITUTION.md`** is the highest-level document in
the entire project. Every feature, prompt, model change, UI decision, and
engineering task must be evaluated against it BEFORE being built. If a proposed
change does not move KAI closer to its principles, do not implement it. Where
any other document, prompt, code, or prior decision conflicts with it, the
Supreme Constitution wins. Only the product owner may amend it, and only by
editing that file directly.

## KAI Ads V2 Final Product Constitution (mandatory, architecture authority)

Before modifying, creating, testing, evaluating, or accepting any advertisement
generation, requirement-intelligence, creative-brief, image-generation, or
branding-overlay code, you MUST first read and comply with:

**`docs/010_KAI_ADS_V2_FINAL_PRODUCT_CONSTITUTION.md`** (canonical for
generation architecture; subordinate only to the Supreme Constitution above)

KAI is a Recruitment Intelligence Platform, NOT an advertisement designer,
layout engine, template engine, or graphics engine.

**Factual Integrity Law (docs/010 Amendment 1 — binding).** No verified
recruitment fact may depend solely on an AI image model for rendering. The
image model owns visual concept, background artwork, photography,
illustration, mood, composition, and visual enhancement. The KAI Rendering
Engine (`branding-overlay.ts`) deterministically renders every heading, job
title, salary, benefit, qualification, certification, contact detail,
licence number, QR, footer, address, website, disclaimer — every structured
fact. No verified information may be omitted, reordered, duplicated,
hallucinated, clipped, or modified by an image model. If the layout cannot
hold every verified fact at KDL's minimum readability, generation FAILS with
an explicit layout-capacity error; it never silently omits. Factual
integrity outranks decorative completeness.

Trust the image model for what an advertisement *looks like*, never for what
it *says*. `docs/012_KAI_DESIGN_LANGUAGE_KDL_V1.md` (KDL v1.0) is the single
visual source of truth: locked palette, type scale, spacing, density tiers,
anti-clipping and anti-overflow rules.

There is exactly ONE production advertisement pipeline, implemented in
`src/server/generation/pipeline/`: Requirement Intelligence -> Creative
Brief -> one image call -> Rendering Engine -> return. Never create a second
layout engine, template engine, theme engine, composer, canvas generator, or
a second prompt builder. Amendment 1 expands the scope of the ONE existing
Rendering Engine — satisfying it by adding a component would violate it.
No feature flag may route generation through a second engine. Quality
issues are fixed by improving Requirement Intelligence, the Creative
Brief, or the Rendering Engine only — never by adding architecture.

`docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md` is superseded for
architecture by docs/010; its Articles I–IV and VI–VIII remain active as
quality-evaluation criteria for GPT Image's output (candidate-first law,
information hierarchy, typography law, canvas law, Agency Visual DNA,
anti-patterns, Final Commercial Acceptance Question).

## Constitution → implementation traceability

`docs/011_CONSTITUTION_TO_IMPLEMENTATION_TRACEABILITY.md` records which
constitutional capabilities are implemented in code today and which are
Phase 2/Phase 3 roadmap. It has no authority of its own — it never weakens or
reinterprets a constitution. Constitutional sections are NEVER removed or
rewritten to match what happens to be built; an unimplemented capability is
recorded there as roadmap. Update it when a capability ships.

## Other governing documents

- `docs/000_PRODUCT_CONSTITUTION.md` — product law (LOCKED).
- `docs/` numbered series — functional spec, schema, API, UI/UX, AI engine, deployment, charter.
- `decisions/` — ADRs; `architecture/` — system architecture.

## Non-negotiable engineering laws

- Truth Brain: every advertisement fact must be source-grounded; never fabricate
  salary, vacancies, urgency, or benefits.
- Verification QR always encodes the KAI-controlled `/v/` route on the canonical
  public domain — never MEA/eMigrate directly, never deployment-specific hosts.
- Never expose, print, log, or commit secrets or API keys.
- Passing tests/lint/typecheck/build is necessary engineering hygiene, not
  commercial acceptance of an advertisement.
