# GPT-Native Fabrication Incident Audit

**Type:** Real-generation incident audit (not a hypothetical review).
**Method:** Every finding below was caught on an actual GPT Image
generation run through GitHub Actions, using the real `OPENAI_API_KEY`
secret and the real KAI Trust Layer — never simulated, never guessed.
**Scope:** Two real product-owner JDs, tested end-to-end across 5
generations total as fixes landed:

| # | Fixture | Pipeline | Commit tested against | Real image reviewed |
|---|---|---|---|---|
| 1 | Welder — Abu Dhabi | Legacy (`STRUCTURED_PROFESSIONAL`) | pre-fix | `welder-v1.png` |
| 2 | Welder — Abu Dhabi | GPT-Native | `86816ee` | `welder-gpt-native-v1.png` |
| 3 | Welder — Abu Dhabi | GPT-Native | `0280a1c` | `welder-gpt-native-v2.png` |
| 4 | Power & Energy — Saudi Arabia | GPT-Native | `a2bc3ea` | `power-energy-v1.png` |
| 5 | Power & Energy — Saudi Arabia | GPT-Native | `0a85eb7` | `power-energy-v2.png` |
| 6 | Power & Energy — Saudi Arabia | GPT-Native | `ee38bf3` | `power-energy-v3.png` |

---

## Fundamental principle these are all measured against

Supreme Constitution / CLAUDE.md non-negotiable law:

> **Truth Brain: every advertisement fact must be source-grounded; never
> fabricate salary, vacancies, urgency, or benefits.**

Every finding below is a violation of this exact law, on a real render,
not a theoretical risk.

---

## Finding-by-finding differential

### F1 — Fabricated salary figure ("EARNING 3,800 AED")
- **Where:** Welder GPT-Native run #1 (`86816ee`).
- **Source truth:** No salary was ever given — only a "Food Allowance —
  300 AED" benefit.
- **Root cause:** `salaryIntelligence` (offer.ts) matched the bare
  currency code `\baed\b` inside the allowance line and set
  `hasSalary=true`, which told the Commercial Brief "salary presence:
  commanding" — GPT then invented a number to satisfy that instruction.
- **Fixed:** commit `aeb6447` — only explicit salary/wage language
  (`salary`, `basic pay`, `wage`, `remuneration`) counts now.
- **Verified:** welder-gpt-native-v2.png — headline reads "UNITED ARAB
  EMIRATES · Construction · Earning opportunity", no invented figure.

### F2 — Missing/wrong currency ("$5,000 to 7,000" for a Saudi Arabia posting)
- **Where:** Power & Energy run #4 (`a2bc3ea`).
- **Source truth:** "5K to 7K Basic" — no currency stated at all.
- **Root cause (two-stage):** First fix (never invent ANY currency) was
  too conservative — left the figure completely unlabeled. Correct
  behaviour: Saudi Arabia's real currency (SAR) is a known, deterministic
  fact (already in `COUNTRIES` / `creative-director/knowledge.ts`), not
  a guess, and must be applied.
- **Fixed:** commit `0a85eb7` — `applyDestinationCurrency()` labels a
  bare figure with the destination's real currency before it ever
  reaches the prompt or renderer.
- **Verified:** power-energy-v2.png — benefit line reads "Salary Range:
  SAR 5K to 7K Basic...".

### F3 — Fabricated headline number ("EARNING SAR 50-700")
- **Where:** Power & Energy run #5 (`0a85eb7`), same image that fixed F2.
- **Source truth:** "SAR 5K to 7K Basic" — correctly rendered elsewhere
  on the SAME image.
- **Root cause:** `SalaryDecision` only ever carried a boolean
  `hasSalary` flag. `candidatePsychology`'s SALARY case wrote the
  unparameterized phrase `"Earning — salary opportunity"` — no number —
  leaving GPT to invent one for the headline even though the correct
  figure existed elsewhere in the same prompt.
- **Fixed:** commit `ee38bf3` — `SalaryDecision.salaryText` carries the
  real grounded figure; both dominant and secondary SALARY hooks embed
  it literally (`"Earning ${salaryText}"`).
- **Verified:** power-energy-v3.png — headline reads "Earning 5K to 7K
  Basic (varies based on interview assessment)" — the real figure.

### F4 — Agency name/trust footer silently vanishing
- **Where:** Power & Energy run #6 (`ee38bf3`) — confirmed missing by
  both direct visual inspection and the acceptance fact-checker
  ("Agency: Al Yousuf Enterprises LLP — not visible anywhere").
- **Root cause:** `trust-layer.ts`'s overlay SVG is rasterized at
  *exactly* the reserved zone's pixel dimensions. Text drawn past that
  boundary isn't visual overflow — `sharp` crops it clean out of the PNG
  with no error, no warning, nothing in the logs. "MEA VERIFIED AGENCY"
  and the agency name were drawn at a **fixed font size with no
  width-fitting**, against a text column often only ~150px wide (the QR
  takes the rest of the reserved zone) — the entire trust identity could
  vanish with zero signal that anything was wrong.
- **Fixed:** commit `a56e053` — reuses the same `fitFontSize` helper the
  legacy renderer already had for exactly this problem. New regression
  test (`gpt-native-trust-layer.test.ts`) proves ink actually lands in
  the raster for a deliberately long name, not just that dimensions match.
- **Verified:** not yet re-run against a real image (pending — see Open
  Items).

### F5 — Invented position count + altered requirement figure
- **Where:** Same image as F4 (`ee38bf3`).
- **Source truth:** positions were given with **no** count at all;
  requirement note said "5+ Years of Experience is must."
- **What rendered:** "Testing & Commissioning Engineer **(10 openings)**"
  (invented) and "Electrical (**3+** yrs) required" (altered from 5+).
- **Root cause:** the fidelity block only named specific fields
  (headline/salary/benefit/date/contact) — position counts and the
  footer/requirement-note text were never covered by an explicit
  no-invention rule.
- **Fixed:** commit `a56e053` — broadened to an unqualified "every
  field, no exceptions" rule, plus an explicit no-invented-count
  instruction.
- **Verified:** not yet re-run against a real image (pending).

### F6 — Recurring QR/dead-canvas overlap (open, not fully solved)
- **Where:** every GPT-Native run so far, in varying severity.
- **Nature:** GPT does not always respect the reserved bottom-right
  30%×22% "keep clean" zone the master prompt asks for — its own text
  sometimes runs into where KAI later composites the QR.
- **Status:** this is stochastic model behaviour, not a deterministic
  code defect — matches the already-documented D4 finding from the
  original 30-ad certification report. **Mitigated in production**, not
  eliminated: `gpt-native-generation.service.ts`'s 2-attempt
  regenerate-with-feedback loop, and downgrade to
  `REVIEW_RECOMMENDED` rather than presenting a defective ad as ready.
  The adhoc single-shot test harness deliberately does NOT use that
  retry loop (mirrors certification's single-shot measurement design),
  so this finding is expected to look worse in adhoc tests than in
  production.

---

## Regression fixture suite (this audit's deliverable)

Per the instruction to "save the fixtures as a run — if a similar
concern gets fixed, [it] gets caught before generation" — added:

- `tests/fixtures/real-world-welder-jd.ts` — the exact welder JD, frozen
  as a permanent fixture, annotated with which real defect it caught.
- `tests/fixtures/real-world-power-energy-jd.ts` — the exact Power &
  Energy JD, same treatment, annotated with all three defects it caught
  in sequence (F2, F3, F5).
- `tests/real-world-fabrication-regression.test.ts` — runs the full
  **deterministic** half of the pipeline (Creative Director → Commercial
  Brief → master prompt text) against both fixtures on every `npm test`,
  with **no OpenAI call**, asserting:
  - a bare currency code in a non-salary benefit never sets `hasSalary`
  - a real salary IS detected when genuinely given
  - the destination's real currency is applied to an unlabeled figure
  - the dominant hook embeds the actual figure, never a blank phrase
  - the master prompt's guardrail sentences are present verbatim (so a
    future edit can't silently delete them without a test failing)

**What this suite cannot catch:** GPT choosing to hallucinate on a given
day — the model is stochastic, and F6 above is proof that instruction
compliance is probabilistic, not guaranteed. This suite guards the
KAI-controlled half of the system: the facts and instructions GPT is
actually given. That's exactly why production's retry-loop +
`REVIEW_RECOMMENDED` flagging exists as the second layer, not a
substitute for the first.

---

## Constitutional compliance verdict

| Principle | Status |
|---|---|
| Truth Brain — never fabricate salary/benefits (F1, F2, F3) | **Fixed & verified** on real renders |
| Truth Brain — never fabricate vacancy counts / alter given figures (F5) | **Fixed**, verification pending |
| Trust Layer — agency identity always present (F4) | **Fixed**, verification pending |
| Composition Constitution — reserved trust zone respected (F6) | **Open** — inherent model-compliance limitation, mitigated not eliminated |

## Open items

1. Run one more real GPT Image generation to confirm F4 and F5 actually
   hold on a live image (not yet done — paused pending product-owner
   go-ahead given repeated real API spend this session).
2. F6 (QR/dead-canvas overlap) has no further deterministic fix
   available — the only lever left is prompt-tuning iteration against
   real generations, which itself costs API credit with no guaranteed
   payoff (matches the earlier first-principles research paper's honest
   conclusion: exact-fact-fidelity at 100% is not currently achievable
   with image models under heavy content, only convergently improvable).
