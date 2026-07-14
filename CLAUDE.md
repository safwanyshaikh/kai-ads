# KAI Ads — Project Instructions

## Advertisement Composition Constitution (mandatory)

Before modifying, creating, testing, evaluating, or accepting any advertisement
generation, composition, archetype, layout, typography, imagery, footer, CTA,
or visual-QA code, you MUST first read and comply with the repository's
Advertisement Composition Constitution:

**`docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md`** (canonical, single source of truth)

No advertisement work may bypass or contradict it. If any code, prompt,
document, or prior layout conflicts with it, the Constitution wins unless the
product owner explicitly amends that file. Runtime enforcement lives in
`src/server/generation/archetypes/composition-constitution.ts` and is wired
through `composeAdvertisement()`; do not weaken or route around it.

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
