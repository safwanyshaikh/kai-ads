# KAI Design Language — KDL v1.0

**Status:** Permanent design system for every KAI advertisement.
**Authority:** Subordinate to `009_KAI_ADS_SUPREME_CONSTITUTION.md` and
`010_KAI_ADS_V2_FINAL_PRODUCT_CONSTITUTION.md`. Where those govern *what may
be said*, KDL governs *how it is shown*. It never overrides a truth rule.

This document is written so that another system can reproduce a KAI
advertisement without guessing. Every value is either an exact token or a
formula. Every decision states its reason.

---

## 0. The one law that makes everything else work

> **Constitutional status.** This section is not a KDL design preference. It
> is the **Factual Integrity Law**, issued by the product owner and binding
> as Amendment 1 of `010_KAI_ADS_V2_FINAL_PRODUCT_CONSTITUTION.md`, where it
> supersedes every conflicting clause. KDL implements it; KDL cannot relax
> it.

**KAI advertisements are composed of two layers, and factual text never
belongs to the generated one.**

| Layer | Owner | Contains | Nature |
|---|---|---|---|
| **Atmosphere Layer** | Image model | Background photography, industrial scene, lighting, colour grade, depth | Generated, non-deterministic |
| **Fact Layer** | Branding Engine | Every character the reader must trust — titles, counts, salaries, dates, contacts, licence, footer | Rendered deterministically |

**Reason — measured, not assumed.** Across this project's live generation
runs, the deterministically rendered elements (agency name, licence number,
QR, footer, contact row) were correct in **every single run**. In the same
images, model-rendered text dropped a verified role ("Field Professional
Level II"), broke list numbering (1,2,3,4,5,**7**,8,9,10), invented a role
line that was not in the brief, clipped an email address, and produced
unreadable strings ("EXACT POITIOES", "STABLE CULF CARPEDIAATE CAREER",
"advancementes"). No prompt rule closed this; the failure is intrinsic to
generative text rendering.

A recruitment advertisement is a **legal and commercial instrument** — a
wrong digit in a phone number or a dropped role is not a cosmetic flaw. So:

> **KDL Rule 0.1** — The image model receives no factual string and renders
> no glyph the reader is expected to act on. If it renders text at all, that
> text is decorative and sits behind the Fact Layer.
>
> **KDL Rule 0.2** — Every fact is drawn by the Branding Engine, from
> structured data, at a known coordinate, in a known font, at a known size.
>
> **KDL Rule 0.3** — If a fact cannot be laid out inside its zone, the
> layout tier changes (§5). Text is never shrunk below the legibility floor
> and never allowed to overflow.

Everything below assumes this split. A KAI ad is a **typeset document with a
photographic background**, not a picture with words in it.

---

## 1. Canvas formats

All geometry is expressed as a fraction of canvas width `W` or height `H`, so
one specification serves every format.

| Token | Dimensions | Ratio | Primary use |
|---|---|---|---|
| `KAI-SQ` | 1080 × 1080 | 1:1 | WhatsApp, Facebook, LinkedIn, IG feed |
| `KAI-PT` | 1080 × 1350 | 4:5 | Instagram portrait — maximum feed area |
| `KAI-DOC` | 2480 × 3508 | A4 @ 300 dpi | Print, PDF, client presentation |

`KAI-PT` is the **default** for requirements of 13+ roles: it grants 25% more
vertical body area than `KAI-SQ` at the same width, which is exactly the axis
that dense lists need.

**Reason for width-relative units:** the Branding Engine already computes
every band dimension as a fraction of canvas size. Fixed pixel values would
break the moment a tenant requests A4.

---

## 2. Grid system

- **Columns:** 12
- **Outer margin:** `0.065W` (left and right)
- **Gutter:** `0.02W`
- **Column width:** `(W − 2×0.065W − 11×0.02W) / 12 = 0.0542W`
- **Baseline grid:** `0.01W` — every vertical position snaps to a multiple

**Content column groupings**

| Tier | Columns used | Reason |
|---|---|---|
| Single column | 12 | Longest line length, best for 1–12 roles |
| Two column | 6 + 6 | Halves list height; titles up to ~28 chars fit |
| Three column | 4 + 4 + 4 | Index density; titles up to ~18 chars |

**Line-length rule:** no text line exceeds **62 characters**. Beyond that,
readability falls sharply at social-feed scale. If a title exceeds the column
width, the tier changes — the title is never truncated with an ellipsis,
because a truncated job title is a factually incomplete job title.

---

## 3. Design tokens

### 3.1 Colour

KAI's palette is **already shipping** in `branding-overlay.ts`. KDL documents
it. It does not extend it.

**Locked tokens — immutable. No KDL revision may alter or add to these.**

| Token | Hex | Role | Source constant |
|---|---|---|---|
| `--kai-navy` | `#0B1F33` | Primary brand: footer text, contact row fill, header, dark surfaces | `BAND_TEXT`, `CONTACT_ROW_BACKGROUND` |
| `--kai-cream` | `#F3EEE3` | Light surface: footer band, light card fill | `BAND_BACKGROUND` |
| `--kai-gold` | `#F3D98B` | Accent — **on navy only** | `CONTACT_ROW_TEXT` |
| `--kai-slate` | `#4A5A6C` | Muted secondary text on cream | `BAND_MUTED_TEXT` |

**Supporting tokens — also already in the implementation:**

| Token | Hex | Role | Source constant |
|---|---|---|---|
| `--kai-divider` | `#C9C0AB` | Hairline rules on cream | `BAND_DIVIDER` |
| `--kai-white` | `#FFFFFF` | Display type over the Atmosphere Layer only |

**That is the entire palette — six values.** There is no navy-700, no
cream-050, no secondary gold. Depth is created by **opacity of a locked
token**, never by a new hex:

| Derivation | Definition | Use |
|---|---|---|
| Navy scrim | `--kai-navy` @ 88% → 35% | Hero gradient |
| Navy surface | `--kai-navy` @ 92% | Card fill on photography |
| Navy hairline | `--kai-white` @ 18% | Dividers on dark surfaces |
| Cream surface | `--kai-cream` @ 96% | Card fill on light |
| Watermark | tenant logo @ 7% | `WATERMARK_OPACITY` |

**Reason:** opacity derivations stay correct if a locked token is ever
revised, and they cannot drift into a parallel palette. A new hex is a new
brand; an opacity is the same brand at a different weight.

> **Contrast law.** `--kai-gold` on `--kai-cream` measures approximately
> **1.4:1** — illegible, and below every accessibility threshold. Gold
> therefore appears **only on navy**, which is exactly what the shipping
> implementation does: gold is used for one element, the contact-row text,
> on a navy fill. KDL states the constraint rather than solving it with a
> second gold. Where an accent is needed on cream, use `--kai-navy` at
> display weight — emphasis through weight and size, not hue.

### 3.1.1 Amendment 2 — Palette roles and the Contrast Law (Design DNA)

> **Status.** Issued by the product owner alongside the Design DNA
> directive, which requires five visually distinct production packs. It
> supersedes §3.1's "no KDL revision may alter or add to these" as it
> applies to the *number* of palettes, and only that. Everything else in
> §3.1 stands.

§3.1 locked four hexes because a locked list is a **provable** guarantee:
every foreground/background pair was checked once, by hand, and could never
drift. Design DNA introduces many palettes, so the guarantee moves from
*"these four hexes"* to *"this property, checked mechanically, for every
palette that ships"*. Nothing is relaxed; the proof is mechanised.

**Palette roles.** The Rendering Engine never names a colour. It asks the
palette for the ROLE it needs, and a Design DNA supplies the nine roles:

| Role | What the engine paints with it |
|---|---|
| `ink` | Bars, rules, headings, primary factual text |
| `accent` | Straps, vacancy cells, the hero numeral |
| `accentText` | Text sitting on `accent` |
| `muted` | Secondary factual text — role detail, salary column |
| `paper` | Card and table-field fill |
| `surface` | The body surface beneath the hero |
| `tint` | Alternating band / soft fill |
| `rule` | Hairlines and dividers |
| `reversed` | Text sitting on `ink` |

The KAI palette of §3.1 remains the **default** (`KDL_PALETTE`), and is
what a caller gets when it names no DNA.

**The Contrast Law.** Every DNA palette must satisfy these pairs — the
exact pairs the engine actually paints, read off the drawing code — before
the registry will accept it:

| Pair | Minimum |
|---|---|
| `ink` on `surface`, `paper`, `tint` | 4.5:1 |
| `muted` on `surface`, `paper` | 4.5:1 |
| `reversed` on `ink` | 4.5:1 |
| `accentText` on `accent` | 4.5:1 |
| `accent` on `ink` (display marks only) | 3.0:1 |

4.5:1 is WCAG AA for normal text. A recruitment fact rendered below it is
a fact the candidate cannot act on, which the Factual Integrity Law treats
as an omission — so a failing DNA is not a style problem, it is a truth
problem.

**Enforcement.** `validateDesignDna()` runs for every DNA at module load in
`registry.ts`, and throws. An illegible palette fails the build, not the
candidate's eyes. Agency brand colours go through the same law
(`applyAgencyBrand()`): a brand colour that cannot carry factual text is
declined, the DNA's own value stands, and the agency is told why.

**What a DNA still may not do.** It may make type larger; it may not lower
the legibility floor (§3.2). It may loosen or tighten the row rhythm; it
may not buy itself artwork space at the cost of the position list. Every
capacity solve, anti-clipping rule and `LayoutCapacityError` is unchanged
and lives in the one Rendering Engine.

Implementation: `src/server/generation/dna/contrast.ts`,
`design-dna.ts`, `registry.ts`, `packs/palettes.ts`.

---

**Colour ratio:** 60% navy / 30% cream / 10% gold. Gold is *punctuation* —
vacancy counts, the total badge, section rules, the QR caption. Never a
background, never body text, never on cream.

**Reason for this palette:** deep navy reads as institutional and licensed
(the ad is a regulated instrument); cream avoids the clinical coldness of
pure white in print; restrained gold signals premium without the gold-gradient
look of low-trust recruitment marketing.

### 3.2 Typography

**Family:** `KaiSans` (the family already embedded for band rendering), with
`sans-serif` fallback. A single humanist sans across the system — a second
display family is the fastest route to looking like a template.

**Scale** — modular, ratio 1.25, expressed against `W`:

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `D1` | `0.072W` | 800 | −2% | Country / campaign headline |
| `H1` | `0.052W` | 700 | −1% | Employer name |
| `H2` | `0.038W` | 700 | 0 | Section headings |
| `H3` | `0.028W` | 600 | 0 | Category names, card titles |
| `BodyL` | `0.024W` | 500 | 0 | Job titles (T1–T2) |
| `Body` | `0.020W` | 400 | 0 | Job titles (T3), detail lines |
| `Caption` | `0.016W` | 500 | +2% | Labels, badges, counts |
| `Micro` | `0.013W` | 400 | +3% | Licence, disclaimer, QR caption |

**Legibility floor:** `0.016W`. No factual text renders below this at any
tier. When a list cannot fit at the floor, the tier changes (§5).

**Line height:** 1.15 for `D1`–`H2`, 1.35 for `H3`–`Body`, 1.4 for
`Caption`/`Micro`. Tight display, generous body — dense lists need the
leading far more than headlines do.

**Case:** `D1` and section headings in uppercase; job titles in **sentence
case as supplied**. Job titles are never re-cased — "Fld Svc Rep-Fluid Perf
III Level II" is a controlled designation, and normalising it corrupts it.

### 3.3 Spacing

Base unit `u = 0.01W`. Permitted values only:

`1u · 2u · 3u · 4u · 6u · 8u · 12u`

| Token | Value | Use |
|---|---|---|
| `space-1` | `1u` | Icon-to-label, badge padding (vertical) |
| `space-2` | `2u` | List row padding, badge padding (horizontal) |
| `space-3` | `3u` | Between list rows, card inner padding |
| `space-4` | `4u` | Card inner padding (comfortable) |
| `space-6` | `6u` | Between cards, between sub-sections |
| `space-8` | `8u` | Between major zones |
| `space-12` | `12u` | Header-to-hero, hero-to-body |

**Reason:** an arbitrary spacing scale is how layouts drift. Seven values are
enough to build every tier and few enough to keep rhythm visible.

### 3.4 Radius, shadow, dividers

| Token | Value | Notes |
|---|---|---|
| `radius-card` | `0.008W` | All cards and panels |
| `radius-badge` | `0.5 × badge height` | Full pill |
| `radius-strip` | `0` | Footer band, contact row, full-bleed strips |
| `shadow-card` | `0 0.004W 0.012W rgba(11,31,51,0.10)` | Light surfaces only |
| `shadow-none` | — | **Default.** Cards on navy use borders, not shadows |
| `divider-hair` | `1px` `--kai-divider` @ 60% | Between list rows |
| `divider-rule` | `0.004W` `--kai-gold` | Under section headings, 20% width |

**Shadows are near-absent by design.** Print and WhatsApp compression both
destroy soft shadows; separation comes from **fill contrast and whitespace**,
which survive both.

---

## 4. Layout zones

Vertical zones as fractions of `H`. The bottom 20% is owned by the Branding
Engine and is inviolable.

| Zone | Range | Owner |
|---|---|---|
| **Header** | `0 → 0.11H` | Fact Layer |
| **Hero** | `0.11H → 0.42H` (T1/T2) · `0.11H → 0.30H` (T3/T4) | Atmosphere + Fact |
| **Body** | end of hero `→ 0.80H` | Fact Layer |
| **Reserved strip** | `0.80H → 1.0H` | Branding Engine — **nothing else may enter** |

### 4.1 Reserved strip composition

| Element | Height | Position |
|---|---|---|
| Clearance gap | `0.025H` | Top of strip — pure breathing room |
| Contact row | `0.045H` | Navy, gold text, centred |
| Footer band | `0.130H` | Cream |

`0.025 + 0.045 + 0.130 = 0.20H`.

**Reason for the clearance gap:** the Branding Engine paints its band
opaquely. When the reserve advertised to the composition layer equalled the
band height exactly, content landed flush against the boundary and was cut in
half. The gap converts a hard edge into a tolerance.

### 4.2 Header

Left-to-right: agency logo (`0.07H` tall) · agency name (`H3`) · flexible
space · destination flag treatment (optional) · `KAI` verification mark.
Fill `--kai-navy`, text `--kai-white`, one `divider-rule` in gold beneath.

### 4.3 Hero

Full-bleed Atmosphere Layer photograph, overlaid with a **navy scrim**:
linear gradient `--kai-navy` at 88% opacity (left) → 35% (right) for
`KAI-SQ`/`KAI-PT`; top-to-bottom for `KAI-DOC`.

**Reason:** the scrim guarantees a known contrast floor for `D1`/`H1`
regardless of what the image model produced. Without it, headline legibility
depends on a non-deterministic background — unacceptable under Rule 0.1.

Hero carries, in order: `D1` destination/campaign line, `H1` employer,
`H3` project type, then the **total-positions badge** (§6.3).

### 4.4 Information hierarchy

Reading order is fixed. A candidate scanning a feed decides in under two
seconds, and that decision needs three facts: *where*, *who*, *what work*.

| Rank | Content | Zone | Token | Rule |
|---|---|---|---|---|
| **1** | Destination country | Hero | `D1` | Always the largest element on the canvas |
| **2** | Employer / client | Hero | `H1` | Never smaller than 70% of `D1` |
| **3** | Total positions | Hero | Total badge | Always present, always the true total |
| **4** | Project type, industry | Hero | `H3` | Omitted entirely if unverified |
| **5** | Job titles | Body | `BodyL`/`Body` | The substance — largest share of body area |
| **6** | Per-role detail (vacancies, experience, salary) | Body | `Caption` | Degrades first under density pressure (§5) |
| **7** | Benefits, visa, rotation, duty hours | Body | `Caption` | Grouped, icon-led, omitted when absent |
| **8** | Interview date and venue | Body | `Caption` | Promoted to rank 4 when a date is imminent |
| **9** | Contact | Contact row | `Caption` | Branding Engine, fixed position |
| **10** | Agency, licence, address, QR | Footer band | `Micro` | Branding Engine, fixed position |

> **KDL Rule 4.4** — Hierarchy is expressed through **size, weight and
> position only**. Never through colour alone (fails for colour-blind
> readers and in greyscale print), and never through a coloured background
> panel used purely for emphasis.

**Degradation order.** When space is short, detail is removed in this order:
rank 7 → 6 → 4. Ranks 1, 2, 3, 5, 9 and 10 are **never** removed — an
advertisement without them is not a KAI advertisement.

### 4.5 Section behaviour

A *section* is a titled group in the body zone (Positions, Benefits,
Interview, Requirements).

1. **Conditional existence.** A section renders only when it holds at least
   one verified fact. An empty section is not rendered empty — it does not
   exist. No heading, no card, no placeholder, no reserved space.
2. **Collapse.** When a section holds a single short fact, it renders as one
   inline row rather than a titled card. A card around one line wastes the
   vertical budget that the position list needs.
3. **Order.** Positions → Requirements → Benefits → Interview → Contact.
   Positions always lead: they are the reason the reader stopped.
4. **Promotion.** An imminent interview date (within 14 days of generation)
   promotes the Interview section above Benefits.
5. **No orphan headings.** A heading never renders without at least one row
   beneath it in the same column. If a column break would separate them,
   both move together.

**Reason for rule 5:** a live verification produced a `CONTACT DETAILS`
heading with nothing under it, and another produced `INTERVIEW DETAILS`
twice. An orphan heading reads as a rendering fault and undermines trust in
the facts that *did* render.

---

## 5. Density tiers — responsive scaling

The tier is selected from the **verified role count**, automatically.

| Tier | Roles | Columns | Per-role detail | Job title size |
|---|---|---|---|---|
| **T1 Spotlight** | 1–3 | 1 | Full: vacancies, experience, qualification, salary, certifications | `BodyL` → `H3` |
| **T2 Standard** | 4–12 | 1 | Vacancies, experience, salary | `BodyL` |
| **T3 Directory** | 13–40 | 2 | Vacancies only | `Body` |
| **T4 Index** | 41–150+ | 3, grouped by category | Category counts only | `Body` at floor |

### 5.1 T4 — the enterprise tier

At 41+ roles, listing every title legibly is geometrically impossible. T4
therefore **groups by department/discipline** into section cards:

- Each card: category name (`H3`), vacancy count badge, and as many role
  titles as fit at the legibility floor.
- A card that cannot show all its titles shows the count and the phrase
  `+N more in this department`.
- The hero badge always states the **true total** (`127 positions available`).
- The QR resolves to the complete, authoritative list.

> **KDL Rule 5.1** — Summarisation is permitted. Silent omission is not.
> Any role not printed must be accounted for by a visible count, and the
> full list must be reachable via the QR.
>
> **KDL Rule 5.2** — Roles are never merged, never renamed, never
> re-numbered, and never deduplicated across differing designations.
> "Level I" and "Level II" are distinct roles.

**Reason:** the Halliburton reference handles 126 roles by grouping into 19
numbered departments — that is the correct structural answer and the reason
its density works. KDL adopts the *strategy* (categorical grouping with
counts) while rejecting its execution (dense red/white body text at print
scale, unreadable on a phone).

### 5.2 Tier overflow

Tier selection is by count, but **fit is verified after layout**. If measured
content exceeds the body zone, the engine escalates one tier (T2→T3→T4) and
re-lays out. It never shrinks below the floor and never spills into the
reserved strip.

---

## 6. Components

### 6.1 Section card

Fill `--kai-cream` on light layouts, `--kai-navy` at 92% on dark.
`radius-card`, padding `space-4`, heading `H3`, `divider-rule` beneath
heading, rows separated by `divider-hair`. No shadow on dark.

### 6.2 Job row

`[vacancy badge] [job title] ................ [detail]`

- Badge left, fixed width `0.06W`, vertically centred
- Title `BodyL`/`Body`, `--kai-navy` on cream / `--kai-white` on navy
- Detail right-aligned, `Caption`, `--kai-slate`
- Row padding `space-2` vertical, separated by `divider-hair`
- **Rows are never numbered.** Sequence numbers add no information and were
  observed to render incorrectly; the vacancy badge carries the useful number.

### 6.3 Badges

| Badge | Fill | Text | Use |
|---|---|---|---|
| **Count** | `--kai-gold` | `--kai-navy` | Vacancies per role |
| **Total** | `--kai-navy` | `--kai-gold` | "127 positions available" |
| **Attribute** | transparent, `1px --kai-divider` | `--kai-slate` | Visa type, contract type, rotation |
| **Urgency** | `--kai-navy` | `--kai-white` | "Urgent" — **only if the source says so** |

All badges: `radius-badge`, padding `space-1` × `space-2`, text `Caption`
uppercase.

> **KDL Rule 6.1** — An urgency badge is a factual claim. It renders only
> when urgency is present in the verified source. KAI never manufactures
> scarcity.

### 6.4 Status labels

`Open` · `Closing soon` · `Interview scheduled` — rendered only from verified
data, `Caption`, gold dot `0.006W` + label. Absent by default.

### 6.5 Icons

Line icons, `1.5px` stroke at `0.024W` box, `--kai-slate` on cream /
`--kai-gold` on navy. Permitted set is **fixed**: accommodation, food,
transport, medical, insurance, salary, duty hours, rotation, visa, interview,
location, phone, email, web.

An icon appears **only** beside a benefit that exists in the source. An icon
without a verified benefit behind it is fabrication in pictorial form.

---

## 7. Branding elements

Values below match the shipping Branding Engine.

| Element | Spec |
|---|---|
| **Logo** | Footer band, left. `0.69 ×` band height. Left margin `0.03W`. Gap to text `0.03W`. |
| **Agency name** | `0.35 ×` band height, weight 700, `--kai-navy`, baseline at `0.46 ×` band height |
| **Licence number** | Prefixed `REG.`, `0.16 ×` band height, `--kai-slate`, baseline `0.76 ×` band (lifts to `0.68 ×` when an address line follows) |
| **Address / website** | `0.13 ×` band height, `--kai-slate`, baseline `0.88 ×` band. Optional |
| **QR** | Footer band, right. `0.60 ×` band height. Right margin `0.03W`. Caption `SCAN TO VERIFY` in `Micro` beneath. Vertical `divider-hair` to its left |
| **Contact row** | Full-width navy strip above the band, `0.045H`, gold text centred |
| **Watermark** | Tenant logo, `7%` opacity, tile width `0.16W`, spacing factor `1.7`, rotated `30°`, tiled across the full canvas beneath the Fact Layer |

**QR law (non-negotiable, inherited):** the QR always encodes the
KAI-controlled `/v/` route on the canonical public domain. Never a third-party
destination, never a deployment-specific host.

**Watermark reason:** 7% is deliberately below conscious notice — it is an
attribution and copy-protection device, not decoration. Raising it competes
with the Fact Layer.

---

## 8. White space rules

1. Body zone maintains **≥ 22% empty area**. Density is achieved by
   *structure*, not by filling every pixel.
2. Minimum `space-3` between any two text elements of differing hierarchy.
3. Minimum `space-6` between cards.
4. No factual element within `space-4` of a canvas edge.
5. The clearance gap above the contact row (`0.025H`) is never encroached.

**Reason:** the failure mode of dense recruitment advertising is edge-to-edge
text. Whitespace is what separates an enterprise document from a classified
listing — and it is the first thing sacrificed without an explicit floor.

---

## 9. Channel readability

| Channel | Constraint | KDL response |
|---|---|---|
| **WhatsApp** | Heavy recompression; often viewed at ~400px | Legibility floor `0.016W` ≈ 17px at 1080 — survives. No hairline-only separation; every division also uses fill contrast |
| **Facebook / LinkedIn** | Feed crops, dark-mode UI chrome | Navy header/footer anchor the composition in both light and dark surrounds |
| **Instagram** | Feed preview may crop `KAI-PT` toward square | All identity-critical content (employer, total, QR) sits within the **central square** of `KAI-PT` |
| **PDF / client deck** | Viewed at 100% and zoomed | `KAI-DOC` at 300 dpi; all type vector-rendered, never rasterised text |
| **Print** | Trim variance, ink spread | `5mm` bleed, `8mm` safe margin. Gold on cream avoided (§3.1) as it degrades in CMYK |

**Universal:** minimum contrast **4.5:1** for all factual text. This is why the
hero scrim (§4.3) is mandatory rather than aesthetic.

---

## 10. Anti-clipping and anti-overflow

These are the two failure modes that have actually reached generated output
in this project. They are stated as engine rules, not aspirations.

### 10.1 Anti-clipping

**Clipping** = a glyph intersecting a boundary that will be painted over or
trimmed away.

| Rule | Definition |
|---|---|
| **10.1.1** | No factual glyph may render below `0.80H`. The reserved strip is painted opaquely; anything beneath it is destroyed, not overlapped |
| **10.1.2** | The advertised reserve always **exceeds** the painted band. Currently `0.20H` advertised vs `0.175H` painted — a `0.025H` tolerance |
| **10.1.3** | The reserve is **derived from the band constants, never hardcoded**. A literal percentage in a prompt or layout is a defect |
| **10.1.4** | Measure the rendered text box, not the estimated one. Descenders (`g`, `y`, `Q`, `@`) and diacritics extend below the baseline; `@` appears in every email address |
| **10.1.5** | Print: no factual glyph within `8mm` of trim on `KAI-DOC` |
| **10.1.6** | On any clipping detection, the tier escalates (§5.2). Never scale type below the floor to force a fit |

**Reason for 10.1.2 and 10.1.3:** the brief once advertised a 12% reserve
while the engine painted 17.5%. Content composed into the 5.5% gap and the
band cut it in half — costing a whole position line, a phone number, and half
a benefits list across different runs. Two numbers that must agree were
maintained in two places.

### 10.2 Anti-overflow

**Overflow** = content requiring more space than its zone provides.

| Rule | Definition |
|---|---|
| **10.2.1** | Every zone has a hard height budget. Content is measured before commit |
| **10.2.2** | On overflow, resolution order is: (a) drop rank-7 detail, (b) drop rank-6 detail, (c) escalate column count, (d) escalate density tier. **Never** shrink below the legibility floor |
| **10.2.3** | Job titles never truncate. A truncated designation is factually wrong (§2) |
| **10.2.4** | Horizontal overflow is impossible by construction: a title that cannot fit its column triggers a tier change |
| **10.2.5** | Any role removed by tier escalation must remain accounted for in a visible count (§5.1) |
| **10.2.6** | Overflow resolution is **deterministic**. The same input yields the same layout every time |

> **KDL Rule 10.3** — An advertisement that cannot fit its verified content
> at the legibility floor, in the densest tier, is a **generation failure**.
> It is reported, not shipped. KAI never ships an ad that silently dropped a
> fact it was given.

---

## 11. Anti-patterns — never ship

1. Marketing prose on the canvas ("seize the opportunity", "stable rewarding
   career"). Sells nothing, and is the highest-risk text to render.
2. Placeholder text — `N/A`, `—`, `TBD`, empty labels. An absent field means
   an absent **section**.
3. Fabricated logos or brand marks for the client company.
4. Sequence numbering of job rows.
5. Truncated job titles with ellipses.
6. Gold text on cream.
7. Drop shadows on dark surfaces.
8. More than two type weights in one zone.
9. Stock-photo "handshake" or "corporate ladder" imagery — the Atmosphere
   Layer shows the **actual work environment** of the industry hiring.
10. Any factual glyph produced by the image model.

---

## 12. Pre-release checklist

An advertisement ships only when all pass:

- [ ] Every printed fact traces to verified source data
- [ ] No fabricated role, salary, benefit, certification, or contact
- [ ] True total positions stated, and reconciles with roles shown + counted remainder
- [ ] No role merged, renamed, re-numbered, or duplicated
- [ ] No text below the legibility floor
- [ ] Nothing enters the reserved strip
- [ ] No clipped or overlapping text
- [ ] Logo, watermark, QR, licence, footer, contact row present
- [ ] QR decodes to the KAI `/v/` route on the canonical domain
- [ ] Contrast ≥ 4.5:1 on all factual text
- [ ] Absent fields omitted entirely, with no placeholder
- [ ] Legal disclaimer verbatim, where supplied

---

## 13. Implementation note

KDL v1.0 is achievable within the existing single production pipeline
(`src/server/generation/pipeline/`). It requires no new engine, no second
prompt builder, and no architectural addition — the Branding Engine already
renders the Fact Layer deterministically for the footer band, licence, QR and
contact row, with a 100% correctness record.

Reaching full KDL compliance means **extending that same deterministic
renderer upward** from the footer band into the header, hero and body zones,
and reducing the image model's remit to the Atmosphere Layer alone. That is a
change in the division of labour between two existing components, not a new
architecture, and it is the only route to the "no manual editing" standard —
model-rendered facts have failed that standard in every list-heavy run
measured.

Until that extension ships, KDL §0 marks the boundary between what is
currently guaranteed (footer band and below) and what is currently
best-effort (everything above it).

### 13.1 Compliance status — stated plainly

Amendment 1 is **binding law as of now**. The implementation is **not yet
compliant with it**. Recording that honestly is the point of this section;
a constitution is not weakened to match what happens to be built.

| Fact category | Rendered by | Compliant |
|---|---|---|
| Agency name, licence number, address, website | Rendering Engine | ✅ |
| Contact row | Rendering Engine | ✅ |
| QR + caption | Rendering Engine | ✅ |
| Watermark, logo | Rendering Engine | ✅ |
| Headings, job titles, vacancy counts | Image model | ❌ |
| Salary, benefits, qualifications, certifications | Image model | ❌ |
| Interview date and venue | Image model | ❌ |
| Disclaimer | Image model | ❌ |
| `LAYOUT_CAPACITY` fail-closed error | Not implemented | ❌ |

**Required to reach compliance**, in dependency order:

1. Extend the Rendering Engine's deterministic text renderer from the footer
   band into the body, hero and header zones, using the KDL grid (§2), type
   scale (§3.2) and tiers (§5).
2. Reduce the Creative Brief's remit to the Atmosphere Layer — background,
   mood, photography — and stop passing it factual strings to print.
3. Implement measure-before-commit with the tier-escalation ladder (§10.2)
   and the `LAYOUT_CAPACITY` error (§10.3).
4. Retire the on-canvas position cap and the "print EXACTLY N" prompt rules;
   both are mitigations for model-rendered text and become dead once facts
   are typeset deterministically.

This is a change in the division of labour between two components already in
the pipeline. It adds no engine and no prompt builder, and so does not
conflict with the Engineering Rules.

**Until step 3 ships, KAI can silently omit a verified fact.** Advertisements
generated before then should be treated as requiring human verification of
every printed fact against the source requirement.
