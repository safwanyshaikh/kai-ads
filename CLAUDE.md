# KAI Ads — Project Instructions

## Supreme Constitution (highest law — read first)

**`docs/009_KAI_ADS_SUPREME_CONSTITUTION.md`** is the highest-level document in
the entire project. Every feature, prompt, model change, UI decision, and
engineering task must be evaluated against it BEFORE being built. If a proposed
change does not move KAI closer to its principles, do not implement it. Where
any other document, prompt, code, or prior decision conflicts with it, the
Supreme Constitution wins. Only the product owner may amend it, and only by
editing that file directly.

## Advertisement Composition Constitution (mandatory)

Before modifying, creating, testing, evaluating, or accepting any advertisement
generation, composition, archetype, layout, typography, imagery, footer, CTA,
or visual-QA code, you MUST first read and comply with the repository's
Advertisement Composition Constitution:

**`docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md`** (canonical for
composition detail, subordinate only to the Supreme Constitution above)

No advertisement work may bypass or contradict it. If any code, prompt,
document, or prior layout conflicts with it, the Constitution wins unless the
product owner explicitly amends that file. Its Articles I–IV and VI–VIII apply
to EVERY pipeline as evaluation criteria; Articles V and IX (the deterministic
engine sequence and `composeAdvertisement()` runtime enforcement, implemented
in `src/server/generation/archetypes/composition-constitution.ts`) are scoped
by Amendment 1 to the legacy deterministic pipeline only — do not weaken or
route around them there, and do not reintroduce deterministic recomposition
into the GPT-Native pipeline (Supreme Principle 2 forbids it).

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
