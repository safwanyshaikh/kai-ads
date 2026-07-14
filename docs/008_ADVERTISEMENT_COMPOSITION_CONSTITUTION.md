# KAI ADS

## Advertisement Composition Constitution

Version: 1.0

Status: ACTIVE — amendable only by the product owner

Owner: KAI Platform (product owner)

Last Updated: July 2026

---

# Registry Entry (Source of Truth)

- **Canonical path:** `docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md`
- **Authority level:** Primary commercial design authority for all KAI Ads advertisements. Sits directly under `docs/000_PRODUCT_CONSTITUTION.md` (product law) and above all archetype code, Creative Brain prompts, Visual QA prompts, design documents, and prior layout conventions.
- **Scope:** Every advertisement layout, archetype, Creative Direction Plan, typography decision, imagery decision, footer, CTA, verification block, visual composition, and rendered advertisement produced by KAI Ads — current and future.
- **Systems governed:**
  - `src/server/generation/archetypes/` (all engines: Visual Hero, Structured Professional, High Density, DTP/Newspaper, and any future archetype)
  - `src/server/generation/archetypes/composition-constitution.ts` (runtime enforcement module)
  - `src/server/generation/archetypes/advertisement-intelligence.ts` (Brain B — hooks/copy)
  - `src/server/generation/archetypes/archetype-selection.ts` (Creative Brain archetype decision)
  - `src/server/generation/archetypes/visual-dna.ts` (Agency Visual DNA)
  - `src/server/ai/visual-qa/` (Brain D — commercial Visual QA)
  - `src/server/generation/acceptance/` (gates + acceptance loop)
  - `tests/` constitutional tests
- **Conflict rule:** If any archetype implementation, design prompt, AI instruction, Creative Brain output, Visual QA score, older documentation, or existing layout conflicts with this Constitution, **the Constitution wins**, unless the product owner explicitly amends this file. Passing engineering gates never overrides it.

---

# Article I — The Candidate-First Principle

1. Every advertisement is designed for the **candidate scrolling a phone** on Facebook, Instagram, WhatsApp, or LinkedIn — not for the agency's internal aesthetics, not for engineers, and not for AI scorers.
2. **First-second attention test:** within roughly one second of appearing in a feed, the advertisement must present a dominant, truthful, candidate-facing hook (project + destination, e.g. "BILFINGER SHUTDOWN PROJECT — IN SAUDI ARABIA") large enough to stop a relevant candidate's scroll.
3. **Three-second comprehension test:** within roughly three seconds a relevant candidate must understand: what the opportunity is, where it is, whether their trade is wanted, and how to act (interview/contact).
4. If either test fails, the advertisement fails — regardless of any other quality.

# Article II — Information Hierarchy (What Gets the Canvas)

5. **Primary headline:** the strongest truthful candidate-facing hook is always the single largest text on the canvas. It is never the agency name, never boilerplate ("Hiring for…", "We are pleased to announce…"), and never small.
6. **Country / hiring destination** must be immediately visible at headline-adjacent scale. Candidates decide by destination first.
7. **Project / employer / industry** (when source-grounded) is the next tier — it is the credibility of the hook.
8. **Positions / categories / vacancy counts** must be scannable at a glance. When the category list itself is the hook (e.g. one high-demand trade), it may be promoted into the headline tier.
9. **Salary, interview dates/venues, benefits, and genuine urgency** receive strong secondary prominence **only when source-grounded**. Fabricating salary, vacancies, urgency, or benefits is forbidden absolutely (Truth Brain law — unchanged by this Constitution).
10. **Contact CTA (phone/email/WhatsApp)** must be prominent and instantly findable — a candidate who wants to act must never hunt for it.
11. **Agency identity does NOT dominate the top of the advertisement by default.** The agency's name, logo, and registration belong in the trust architecture — normally the footer/verification band — unless the product owner or agency explicitly configures otherwise.

# Article III — Typography Law

12. **Proportional typography hierarchy:** font sizes must express information priority. Hook ≫ destination/secondary hooks ≫ positions/details ≫ trust small print. Uniform, timid, or "miniature" typography is a constitutional violation.
13. **Mobile readability floor:** the dominant headline must remain comfortably readable at feed-thumbnail scale on a phone. A headline too small for mobile social viewing is a mandatory rejection.
14. **Sparse content must scale UP, not shrink.** When the source contains only one or two positions, the typography grows and the composition tightens — a small category list must never produce miniature fonts floating in an empty document. (Typography Scale Engine, Article V.)

# Article IV — Canvas Law

15. **No unjustified empty canvas.** More than ~20% dead canvas without deliberate compositional purpose is a mandatory rejection.
16. **Sparse-content layouts** (1–2 positions, few blocks): enlarge the hook, the destination, the CTA, and the imagery/graphic presence to fill the canvas with signal. Never render a huge, mostly-empty table.
17. **Medium-density layouts** (typical 3–7 positions): benchmark poster grammar — dominant hook stack, interview ribbon, benefit banner, banded positions card, contact bar, trust footer.
18. **High-density vacancy tables** activate **only** for genuinely dense sources (many positions/columns). Forcing a dense table onto a five-position source, or a sparse source, is a violation. Density is decided by the Content Density Engine, never by habit.
19. **Visual storytelling for image-led archetypes:** the imagery must dominate and tell the work-environment story (e.g. refinery at dusk), with text zones designed into the image composition (clear sky for the hook) — never imagery suffocated under heavy washes, and never imagery as decoration behind a document.

# Article V — The Composition Engines (Mandatory Sequence)

Every advertisement MUST pass through this sequence. No archetype, script, or future feature may bypass or reorder the load/enforce step:

```
SOURCE INPUT
→ TRUTH EXTRACTION (Brain A)
→ LOAD/ENFORCE ADVERTISEMENT COMPOSITION CONSTITUTION
→ INFORMATION PRIORITY DECISION       (Information Priority Engine)
→ STRONGEST TRUTHFUL HOOK SELECTION   (Brain B)
→ TYPOGRAPHY SCALE DECISION           (Typography Scale Engine)
→ CONTENT DENSITY DECISION            (Content Density Engine)
→ ARCHETYPE/COMPOSITION DECISION      (Creative Brain)
→ AGENCY VISUAL DNA APPLICATION
→ IMAGE/CREATIVE GENERATION WHERE APPROPRIATE
→ DETERMINISTIC FACTUAL COMPOSITION   (Deterministic Truth Layer)
→ FOOTER + CTA + VERIFICATION INTEGRATION (Footer Composition System)
→ MOBILE READABILITY GATE
→ CANVAS UTILISATION GATE
→ COMMERCIAL VISUAL QA (Brain D)
→ ACCEPT / REGENERATE / BLOCK
```

Engine definitions (all implemented in or wired through `src/server/generation/archetypes/composition-constitution.ts` and the systems it governs):

20. **Information Priority Engine:** produces an ordered `informationPriority` list from the grounded facts; the hook and destination always outrank agency identity, which is always last.
21. **Typography Scale Engine:** produces `typographyScale` from the content density class (sparse → larger, dense → controlled) and folds it into every engine's headline sizing. Fonts follow priority, never habit.
22. **Content Density Engine:** classifies the source into `SPARSE | MEDIUM | HIGH` (`contentDensityClass`) from positions/benefits/interview volume; archetype suitability and layout rules key off it.
23. **Canvas Utilisation Engine:** dead-canvas is policed at two levels — composition (engines distribute leftover space into content, banners, and cards) and QA (Brain D mandatory rejection above ~20% unjustified dead canvas).
24. **Footer Composition System:** a flexible standard footer with controlled variants (`footerVariant`): the navy trust strip (agency name + registration + KAI verification panel) for poster archetypes, and print small-print (full RC verbatim) for the DTP/newspaper grammar. Every variant must contain agency identity, registration/RA, and the KAI verification QR with its scan caption.
25. **Mobile Readability Gate:** enforced in Brain D's mandatory rejection conditions — headline too small for mobile, information requiring careful reading, or hidden CTA blocks acceptance regardless of score.
26. **Commercial Visual QA:** Brain D judges against professional Gulf/overseas-recruitment benchmarks within each archetype's own grammar, with catastrophic defects blocking PASS at any score, and the 95/100 commercial launch threshold above the 85 technical minimum.

# Article VI — Agency Visual DNA

27. Agency Visual DNA (derived tenant palette + logo) provides **continuity, not sameness**: it colors identity elements, ribbons, and accents while each archetype keeps its own genuinely distinct structure. Repetitive template sameness across archetypes is a violation; so is discarding the tenant's identity entirely.
28. DNA influence is color/identity-level only. It never overrides the information hierarchy, never shrinks the hook, and never promotes the agency into the headline tier.

# Article VII — Anti-Patterns (Negative Benchmarks)

29. The rejected Bilfinger layouts of July 2026 are recorded as **negative anti-patterns**, never positive references:
   - agency name/logo as the dominant top headline with the hook demoted below it;
   - uniform small typography arranged like an internal memo, report, or SaaS settings card;
   - large empty white canvas around a small floating content card;
   - a huge sparse table for a short position list;
   - imagery suffocated under heavy opacity washes until the photo no longer reads;
   - hooks phrased as corporate boilerplate instead of candidate language;
   - contact details in body-text scale with no CTA treatment.
30. These patterns **cannot** pass commercial acceptance merely because source fidelity, QR decoding, tests, typecheck, lint, or build pass. Those are necessary engineering gates, not commercial acceptance.

# Article VIII — The Final Commercial Acceptance Question

Every advertisement must answer YES to:

> **"Would a relevant candidate stop scrolling, understand the opportunity within 1–3 seconds, and would a real overseas recruitment agency pay for and publish this advertisement without manually redesigning it?"**

If NO, the advertisement fails — regardless of engineering-gate results or numeric scores.

# Article IX — Enforcement

- Runtime: `composeAdvertisement()` (the single dispatch for all archetypes) computes `CompositionDirectives` via `buildCompositionDirectives()` and runs `enforceCompositionConstitution()` on every rendered output. A render that violates the footer trust architecture, drops the hook, or hides the CTA **throws** — it cannot become an advertisement.
- QA: Brain D's instructions embed this Constitution's mandatory rejection conditions and the final commercial acceptance question.
- Tests: `tests/composition-constitution.test.ts` locks these laws against regression.
- Truth: nothing in this Constitution weakens the Truth Brain. Grounded-facts-only, anti-fabrication, QR/verification, and export laws remain absolute.
