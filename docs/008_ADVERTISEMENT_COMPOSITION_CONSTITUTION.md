# KAI ADS

## Advertisement Composition Constitution

Version: 1.2

Status: SUPERSEDED for architecture by
`docs/010_KAI_ADS_V2_FINAL_PRODUCT_CONSTITUTION.md` — that document is now
authoritative on generation architecture (KAI/GPT Image responsibility
split, the one production pipeline, engineering rules). This document's
Articles I–IV and VI–VIII remain ACTIVE as quality-evaluation criteria for
GPT Image's output; Articles V and IX are void (see Amendment 2, and
docs/010). Subordinate to `docs/009_KAI_ADS_SUPREME_CONSTITUTION.md`.

Owner: KAI Platform (product owner)

Last Updated: July 2026

> **Amendment 1 (July 2026, product owner) — Scope under the Supreme
> Constitution.** *(Superseded by Amendment 2 below — kept for history.)* The
> Supreme Constitution's Golden Rule ("GPT is the Creative Artist. KAI is the
> Creative Director.") and Principle 2 ("GPT Must Create the Entire
> Advertisement") now govern all advertisement generation. Articles I–IV, VI,
> VII, and VIII applied to every pipeline as evaluation criteria; Article V's
> mandatory engine sequence and Article IX's `composeAdvertisement()` runtime
> enforcement were scoped to the legacy deterministic pipeline for as long as
> that pipeline remained in service, alongside the (then-parallel) GPT-Native
> pipeline.

> **Amendment 2 (July 2026, product owner) — One production pipeline.** The
> legacy deterministic pipeline (`composeAdvertisement()`, the four archetype
> engines, the acceptance loop) is RETIRED and deleted from the codebase.
> There is no longer a pipeline choice, no feature flag, and no parallel
> engine — every advertisement, from the UI and from the batch/certification
> scripts alike, goes through exactly one production pipeline:
>
> `RECRUITER MESSAGE → REQUIREMENT INTELLIGENCE (Truth Brain facts) →
> CREATIVE BRIEF (one text call) → ONE GPT IMAGE CALL (GPT owns full
> composition) → MINIMAL BRANDING OVERLAY (logo + QR + footer) → RETURN
> ADVERTISEMENT`
>
> implemented in `src/server/generation/pipeline/`. Accordingly:
>
> 1. **Articles I–IV, VI, VII, and VIII apply to this one pipeline** as
>    evaluation criteria — candidate-first law, information hierarchy,
>    typography law, canvas law, Agency Visual DNA, anti-patterns, and the
>    Final Commercial Acceptance Question. A GPT-generated advertisement that
>    violates them fails.
> 2. **Article V's mandatory engine sequence and Article IX's
>    `composeAdvertisement()` runtime-enforcement clause are RETIRED along
>    with the legacy pipeline they governed** — there is no deterministic
>    factual composition step, and none may be reintroduced (Supreme
>    Principle 2: KAI never rebuilds, redraws, or partially re-renders GPT's
>    artwork — including "regenerate just this section").
> 3. Nothing in this amendment weakens the Truth Brain, the QR/verification
>    laws, or the anti-fabrication laws — those remain absolute.

---

# Registry Entry (Source of Truth)

- **Canonical path:** `docs/008_ADVERTISEMENT_COMPOSITION_CONSTITUTION.md`
- **Authority level:** Primary commercial design authority for all KAI Ads advertisements. Sits under `docs/009_KAI_ADS_SUPREME_CONSTITUTION.md` (supreme law) and `docs/000_PRODUCT_CONSTITUTION.md` (product law), and above all archetype code, Creative Brain prompts, Visual QA prompts, design documents, and prior layout conventions.
- **Scope:** Every advertisement layout, archetype, Creative Direction Plan, typography decision, imagery decision, footer, CTA, verification block, visual composition, and rendered advertisement produced by KAI Ads — current and future.
- **Systems governed:**
  - `src/server/generation/pipeline/` (the one production pipeline: Requirement Intelligence, Creative Brief, GPT Image call, Minimal Branding Overlay)
  - `src/server/services/advertisement-generation.service.ts` (persistence/quota/audit wrapper around the pipeline)
  - `tests/` constitutional/regression tests
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

# Article V — RETIRED (Amendment 2)

This Article previously mandated a deterministic composition engine
sequence (Information Priority Engine, Typography Scale Engine, Content
Density Engine, archetype selection, deterministic factual composition,
Footer Composition System) for the legacy pipeline. That pipeline is
deleted; the sequence is retired with it and MUST NOT be reintroduced —
under Supreme Principle 2, GPT owns full composition and KAI never
rebuilds, redraws, or deterministically re-renders the advertisement. The
one production pipeline's actual sequence is stated in Amendment 2 above.

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

*(Amendment 2: the `composeAdvertisement()` runtime-enforcement clause
that previously governed the legacy pipeline is RETIRED along with that
pipeline — see Amendment 2 above. Enforcement of Articles I–IV/VI–VIII on
the one production pipeline happens through review against this
Constitution and the Final Commercial Acceptance Question — never by KAI
rebuilding or redrawing GPT's artwork.)*

- Runtime: the one production pipeline (`src/server/generation/pipeline/`) never deterministically recomposes an advertisement; GPT owns full composition of every generated image.
- QA: advertisements are judged against this Constitution's mandatory rejection conditions and the Final Commercial Acceptance Question.
- Truth: nothing in this Constitution weakens the Truth Brain. Grounded-facts-only, anti-fabrication, QR/verification, and export laws remain absolute.
