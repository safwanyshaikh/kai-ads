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
layout engine, template engine, renderer, or graphics engine. Its
responsibility ends at producing a complete, accurate, structured Creative
Brief. GPT Image owns all layout, typography, visual hierarchy, background,
color, composition, and creativity — never recreate these through code.
There is exactly ONE production advertisement pipeline, implemented in
`src/server/generation/pipeline/`: Requirement Intelligence -> Creative
Brief -> one GPT Image call -> Branding Overlay (only if required) ->
return. Never create a layout engine, template engine, theme engine,
composer, canvas generator, section renderer, or a second prompt builder.
No feature flag may route generation through a second engine. Quality
issues are fixed by improving Requirement Intelligence, the Creative
Brief, or the Branding Overlay only — never by adding architecture.

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
