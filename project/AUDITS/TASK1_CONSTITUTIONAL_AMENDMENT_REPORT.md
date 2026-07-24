# TASK 1 — Constitutional Amendment Report

**Scope:** Documentation amendments only. No features implemented, no business
logic written, no code modified. Product-owner authorization: explicit CEO
instruction ratifying the Supreme Constitution and directing that all lower
constitutions be aligned to it.

## Conflicts resolved (from the Constitutional Compliance Audit)

| # | Conflict | Resolution | Files amended |
|---|---|---|---|
| 1 | 009 Principle 2 ("Never regenerate sections") vs 000 Rule 6 ("Only regenerate the edited section") and 007 ("Never regenerate entire advertisement") | Rule 6 / charter rule marked SUPERSEDED for the GPT-Native pipeline; reconciled doctrine recorded: edits change grounded FACTS on the Canvas; a visual refresh regenerates the COMPLETE artwork via GPT; version history preserves every prior artwork; the original rules continue to govern only the legacy deterministic pipeline while it remains in service | `docs/000_PRODUCT_CONSTITUTION.md` (Amendment 1, Rule 6 annotation), `docs/007_PROJECT_CHARTER.md` (Amendment 1 annotation) |
| 2 | 009 Principle 2 vs 008 Article V ("DETERMINISTIC FACTUAL COMPOSITION" mandatory for every advertisement) and Article IX (`composeAdvertisement()` as the single dispatch) | 008 Amendment 1 (header): Articles I–IV, VI–VIII apply to EVERY pipeline as evaluation criteria; Articles V and IX scoped to the legacy deterministic pipeline only; the GPT-Native governing sequence is defined in the amendment (Truth → Constitutions → Creative Director → Commercial Brief → Master Prompt → GPT full composition → Trust Layer → quality gates); in-place scope annotations added to Articles V and IX | `docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md` |
| 3 | 009 Success Criteria ("No manual editing") vs 000 Rule 5 ("must always remain editable") | Harmonized in place: editing must always remain POSSIBLE (Rule 5) but never REQUIRED (Supreme Success Criteria) | `docs/000_PRODUCT_CONSTITUTION.md` (Rule 5 clarification) |
| 4 | 001 Functional Spec's Review Screen / Style Selection steps vs the shipped Sprint 006 canvas workflow and 009 Principle 13 | 001 Amendment 1 (header) + in-place SUPERSEDED marker on the Review Screen section; historical text preserved | `docs/001_FUNCTIONAL_SPECIFICATION.md` |
| 5 | 008 Registry authority line placed 000 at the top of the hierarchy | Authority line updated to place 009 above 000 | `docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md` |
| 6 | CLAUDE.md's composition-constitution paragraph mandated `composeAdvertisement()` enforcement without pipeline scope, contradicting Supreme Principle 2 on the GPT-Native path | Paragraph rewritten: Articles I–IV/VI–VIII apply everywhere; V/IX scoped to legacy; explicit prohibition on reintroducing deterministic recomposition into the GPT-Native pipeline | `CLAUDE.md` |

## Conflicts acknowledged but NOT resolvable by documentation

| Conflict | Why deferred |
|---|---|
| 009 Principle 8 (auto-correct spelling) vs `src/server/ai/openai/prompts.ts:60` (verbatim-spelling extraction law) | Resolving this requires a CODE change (a presentation-correction layer alongside verbatim source capture). Task 1's mission explicitly forbids business-logic changes. The doctrine is already recorded in 009's Principle 8 note (presentation-level only, facts never altered); implementation is roadmap work (see Master Roadmap, Task 8). |
| 009 Principle 15 ("zero placeholder docs") vs empty docs/002–006, architecture/, decisions/ | Filling placeholder docs is substantive authoring work beyond conflict resolution; scheduled in the Master Roadmap. Their emptiness is recorded as a standing violation, not silently accepted. |

## Final precedence validation

`009 (SUPREME) → 000 (v1.1, subordinated) → 008 (v1.1, subordinated + scoped) →
001/007 (v1.1, subordinated, superseded clauses marked) → code`.

Every subordinate document now: (a) names 009 in its status line, (b) carries an
explicit amendment note, (c) marks each superseded clause IN PLACE with the
superseding principle named, and (d) preserves the original text for historical
context. No contradictory clause remains unmarked. CLAUDE.md instructs every
future task to read 009 first and encodes the Article V/IX pipeline scoping.
