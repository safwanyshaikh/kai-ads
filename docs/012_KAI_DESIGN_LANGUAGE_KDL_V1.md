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

KAI's palette is **already shipping** in the Branding Engine. KDL formalises
it and adds only the derived steps needed for contrast compliance.

| Token | Hex | Role |
|---|---|---|
| `--kai-navy-900` | `#0B1F33` | Primary brand, footer band, header, dark cards |
| `--kai-navy-700` | `#16324D` | Card fill on dark, hover/second-level surface |
| `--kai-navy-500` | `#24486B` | Dividers on dark, tertiary surface |
| `--kai-slate-500` | `#4A5A6C` | Muted body text on cream |
| `--kai-cream-100` | `#F3EEE3` | Footer band, light card fill |
| `--kai-cream-050` | `#FAF7F1` | Page-level light surface |
| `--kai-gold-400` | `#F3D98B` | Accent — **on navy only** |
| `--kai-gold-600` | `#C9A94E` | Accent — **on cream only** |
| `--kai-divider` | `#C9C0AB` | Hairlines on cream |
| `--kai-white` | `#FFFFFF` | Display type over photography |

> **Contrast law.** `--kai-gold-400` on `--kai-cream-100` is approximately
> 1.4:1 — illegible. Gold text appears **only** on navy surfaces. On cream,
> use `--kai-gold-600`. This single rule prevents the most likely brand
> misuse.

**Colour ratio:** 60% navy / 30% cream / 10% gold. Gold is a *punctuation*
colour — vacancy counts, section rules, the QR caption, the scan prompt.
Never a background, never body text.

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
| `divider-rule` | `0.004W` `--kai-gold-400` | Under section headings, 20% width |

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
Fill `--kai-navy-900`, text `--kai-white`, one `divider-rule` in gold beneath.

### 4.3 Hero

Full-bleed Atmosphere Layer photograph, overlaid with a **navy scrim**:
linear gradient `--kai-navy-900` at 88% opacity (left) → 35% (right) for
`KAI-SQ`/`KAI-PT`; top-to-bottom for `KAI-DOC`.

**Reason:** the scrim guarantees a known contrast floor for `D1`/`H1`
regardless of what the image model produced. Without it, headline legibility
depends on a non-deterministic background — unacceptable under Rule 0.1.

Hero carries, in order: `D1` destination/campaign line, `H1` employer,
`H3` project type, then the **total-positions badge** (§6.3).

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

Fill `--kai-cream-100` on light layouts, `--kai-navy-700` on dark.
`radius-card`, padding `space-4`, heading `H3`, `divider-rule` beneath
heading, rows separated by `divider-hair`. No shadow on dark.

### 6.2 Job row

`[vacancy badge] [job title] ................ [detail]`

- Badge left, fixed width `0.06W`, vertically centred
- Title `BodyL`/`Body`, `--kai-navy-900` on cream / `--kai-white` on navy
- Detail right-aligned, `Caption`, `--kai-slate-500`
- Row padding `space-2` vertical, separated by `divider-hair`
- **Rows are never numbered.** Sequence numbers add no information and were
  observed to render incorrectly; the vacancy badge carries the useful number.

### 6.3 Badges

| Badge | Fill | Text | Use |
|---|---|---|---|
| **Count** | `--kai-gold-400` | `--kai-navy-900` | Vacancies per role |
| **Total** | `--kai-navy-900` | `--kai-gold-400` | "127 positions available" |
| **Attribute** | transparent, `1px --kai-divider` | `--kai-slate-500` | Visa type, contract type, rotation |
| **Urgency** | `--kai-navy-900` | `--kai-white` | "Urgent" — **only if the source says so** |

All badges: `radius-badge`, padding `space-1` × `space-2`, text `Caption`
uppercase.

> **KDL Rule 6.1** — An urgency badge is a factual claim. It renders only
> when urgency is present in the verified source. KAI never manufactures
> scarcity.

### 6.4 Status labels

`Open` · `Closing soon` · `Interview scheduled` — rendered only from verified
data, `Caption`, gold dot `0.006W` + label. Absent by default.

### 6.5 Icons

Line icons, `1.5px` stroke at `0.024W` box, `--kai-gold-600` on cream /
`--kai-gold-400` on navy. Permitted set is **fixed**: accommodation, food,
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
| **Agency name** | `0.35 ×` band height, weight 700, `--kai-navy-900`, baseline at `0.46 ×` band height |
| **Licence number** | Prefixed `REG.`, `0.16 ×` band height, `--kai-slate-500`, baseline `0.76 ×` band (lifts to `0.68 ×` when an address line follows) |
| **Address / website** | `0.13 ×` band height, `--kai-slate-500`, baseline `0.88 ×` band. Optional |
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

## 10. Anti-patterns — never ship

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

## 11. Pre-release checklist

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

## 12. Implementation note

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
