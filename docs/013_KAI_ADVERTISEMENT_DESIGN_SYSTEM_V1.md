# KAI Advertisement Design System v1

**Status:** Proposed. Branch `experiment/kai-design-system`. Not merged, not implemented.
**Scope:** The visual language only. No code, no rendering logic, no architecture.

---

## 0. Evidence base

This system is derived from three concrete sources, not from taste:

1. **Five live Gulf recruitment advertisements** actually published by agencies —
   M. Gheewala newspaper classified, Al-Yousuf Royal Palace classified, Al-Yousuf
   MEGA welder drive, Al-Yousuf general labour campaign, Al-Yousuf FMD handover
   campaign.
2. **Thirty generated concepts** from the Creative Lab experiment, clustered into
   five design families, with every defect recorded.
3. **The current KAI output**, diagnosed below.

Where this document references the visual language of Aramco, ADNOC, Petrofac,
NES Fircroft, Brunel or Airswift, it is describing the well-established
conventions of energy-sector recruitment communication — heavy display type,
single-accent discipline, worksite realism, trust-dense footers — not a claim to
have audited their current campaign assets.

---

## 1. Diagnosis: why the current output reads as a document

This is the problem to solve. Six specific, fixable causes:

| # | Cause | Why it reads as PowerPoint / Word |
|---|---|---|
| 1 | **Stacked full-bleed horizontal bands** | Every element is a 100%-width strip in strict vertical sequence. That is literally the structure of a slide deck and a Word document. |
| 2 | **Every shape is an axis-aligned rectangle at 0°** | No curve, no diagonal, no overlap, no depth. Design software defaults look like design software defaults. |
| 3 | **Compressed type scale (~2.5:1)** | Headline is only ~2.5× body size. Premium campaigns run **6:1 to 10:1**. Low scale contrast is the single strongest "document" signal. |
| 4 | **No focal point** | Nothing dominates, so the eye has nowhere to land and scans top-to-bottom like a page of text. |
| 5 | **Uniform repeating rows** | Identical card rows at identical intervals read as a spreadsheet, not a campaign. |
| 6 | **Photography as wallpaper** | Artwork sits *behind* everything at low visibility rather than being a subject that interacts with the type. |

Fixing 3, 4 and 6 alone changes the category of the output.

---

## 2. Typography hierarchy

All sizes are fractions of canvas width `W` — resolution-independent.

| Role | Size | Weight | Case | Purpose |
|---|---|---|---|---|
| **Display** | `0.115W` | 800 | UPPER | The campaign verb. "WE ARE HIRING", "URGENT REQUIREMENT". One per advertisement. |
| **H1 — Campaign** | `0.062W` | 700 | UPPER | The role family + destination. |
| **H2 — Section** | `0.030W` | 700 | UPPER, tracked +2 | "POSITIONS", "REQUIREMENTS". |
| **Position title** | `0.034W` | 700 | Title | The product being sold. |
| **Value** | `0.026W` | 700 | As written | Salary figures, dates. Always larger than its own label. |
| **Body** | `0.020W` | 400 | Sentence | Qualifications, descriptions. |
| **Micro-label** | `0.013W` | 700 | UPPER, tracked +1 | "SALARY", "EXPERIENCE". Always accent-coloured. |
| **Legal** | `0.012W` | 400 | Sentence | Licence, disclaimer. |

**Three binding laws:**

- **Scale-contrast law.** Display ÷ Body ≥ **5:1**. Below this the advertisement
  reads as a document regardless of everything else.
- **Legibility floor.** Nothing a candidate must act on renders below `0.016W`.
  Legal-only text may go to `0.012W`.
- **Two-family maximum.** One sans for everything structural; an optional second
  family only for editorial display. Never three.

**Value pairing.** Every fact with a label is set as a pair: micro-label in
accent above, value in Value size below. The value is always ≥ 1.6× its label.
This is what makes a salary read as an offer instead of a table cell.

---

## 3. Visual rhythm

Rhythm is the difference between designed and generated.

- **Never repeat the same interval more than three times.** Four identical
  intervals is a table. Break with a rule, a colour shift, or a scale change.
- **Alternating density.** A dense block must be followed by an open one.
  Dense → open → dense. Uniform density is a wall of text.
- **Group spacing ratio 1 : 3.** Space *within* a semantic group (label to its
  value) is one unit; space *between* groups is three. This single ratio does
  more for perceived quality than any other spacing rule.
- **One rhythm break per advertisement.** Exactly one element deliberately
  violates the grid — an overlapping badge, a hero bleeding past a margin, a
  number set enormous. This is what signals a human designed it.

---

## 4. White-space rules

- **Ink coverage ≤ 62%** in any horizontal band. Above this the design suffocates.
- **Component padding ≥ 0.04W** on every internal edge. The most common cheapness
  tell is text too close to the edge of its container.
- **Outer margin 0.055W minimum**, and it is never violated except by a
  deliberate hero bleed.
- **One dominant void.** Every premium layout contains one conspicuously empty
  area. Empty space is not wasted space — it is what makes the focal point read
  as a focal point.
- **Whitespace is not distributed evenly.** Even distribution is the document
  signature. Concentrate it.

---

## 5. Grid philosophy

- **12 columns, asymmetric use.** The grid exists to be divided unevenly:
  **8/4** and **7/5** splits, never 6/6. A centred, symmetric layout is a
  certificate, not a campaign.
- **Vertical: 3 zones, not 7 bands.** Impact (hero + display), Substance
  (positions + requirements), Action (CTA + trust). Three zones with internal
  structure — not seven stacked strips.
- **Optical alignment over mathematical.** Large type is aligned by how it looks,
  not by its bounding box.
- **The grid is a scaffold, not a cage.** Exactly one element per advertisement
  breaks it (see §3).

---

## 6. Hero image usage

- **Occupies 28–42%** of the canvas. Below 28% it is decoration; above 42% it
  crowds the facts.
- **Organic edge, always.** The hero never terminates in a horizontal line. It
  ends in a curve, a diagonal, or an angled mask. *This single rule does more to
  kill the PowerPoint look than any other in this document.*
- **The subject is real work.** A person performing one of the actual listed
  trades, or the actual worksite. Never a handshake, never a posed studio
  portrait, never a generic smiling model.
- **Subject on the outer third**, facing inward toward the type. Never centred.
- **Guaranteed contrast under type.** Where text crosses the hero, a scrim or
  plate guarantees legibility. Contrast is never left to chance.
- **Depth via layering.** Hero, then a translucent plate, then type. Three
  layers create depth; one layer creates a slide.

---

## 7. Colour system

**Four roles. No more.**

| Role | Use | Coverage |
|---|---|---|
| **Anchor** | Deep, authoritative base. Headers, CTA, footer. | 30–45% |
| **Surface** | Near-white field carrying the facts. | 35–50% |
| **Accent** | *All* emphasis: micro-labels, rules, CTA fill, active states. | **≤ 12%** |
| **Neutral** | Secondary text, dividers, muted detail. | remainder |

**Laws:**

- **One accent.** A second accent halves the power of the first. The accent is
  the advertisement's signature — it must mean "look here" every single time.
- **Accent never carries body text.** It labels, rules and fills; it does not
  set paragraphs.
- **Contrast ≥ 4.5:1** for every fact a candidate must read. Non-negotiable.
- **Colour is a hierarchy signal, not decoration.** If a colour is not
  communicating importance, remove it.

---

## 8. Component language

A closed vocabulary. Nothing outside this list appears in a KAI advertisement.

| Component | Form | Carries |
|---|---|---|
| **Flag** | Pill or angle-ended bar, accent-filled | Section headings, urgency, status |
| **Plate** | Rounded rectangle, surface-filled, generous padding | A position and its attributes |
| **Value pair** | Micro-label above, value below | Salary, experience, qualification |
| **Icon badge** | Circle, accent or anchor filled, single glyph | Benefits, trust marks |
| **Rule** | Hairline or 4–6px accent bar | Division, emphasis under a heading |
| **Ribbon** | Angled band crossing the composition | Urgency, single campaign claim |
| **Chip** | Small rounded outline | Nationality, visa type, licence |
| **Strip** | Full-width icon + micro-label row | Benefits summary at the base |

**Icon law.** An icon appears only where it carries meaning the text does not.
A generic wrench beside every trade is noise. If one icon cannot be made
meaningful per row, use none.

---

## 9. CTA behaviour

- **The CTA is a shape, not a band.** A full-width strip is a document footer.
  A pill, angled flag, or plate is a button.
- **Highest contrast object on the canvas.** If anything competes with it, the
  advertisement has no call to action.
- **Contains a verb.** "APPLY NOW", "SEND CV", "WALK IN". Not "Contact".
- **Contact details sit beside it, at Value size** — never smaller than the
  position titles. The phone number is the conversion.
- **One CTA.** Multiple calls to action mean none.

---

## 10. Position presentation

Four density tiers. The presentation changes with count — one system cannot
serve 1 role and 150 roles.

| Tier | Count | Treatment |
|---|---|---|
| **T1 Feature** | 1–3 | Each role is a hero statement. Title at Display-adjacent scale, full attribute set, generous space. The role *is* the campaign. |
| **T2 Plate grid** | 4–12 | One Plate per role, title at Position size, attributes as value pairs across the plate. **This is the default and the strongest tier.** |
| **T3 Compact rows** | 13–40 | Two columns, title + one key attribute, alternating surface tint for rhythm. |
| **T4 Index** | 41+ | Three columns, titles only, grouped by discipline under Flag headings. Attributes move to a shared block. |

**Universal rules:** uniform title size within a tier (mixed sizes imply a
hierarchy that does not exist); never truncate; the count is stated as a fact
("7 POSITIONS", not "MULTIPLE").

---

## 11. Salary presentation

Salary is the primary conversion driver in Gulf recruitment. It gets promoted,
never buried.

- Set as a **value pair**, accent micro-label above, figure at Value size.
- **Currency always explicit** — "SAR 6,000 – 7,500", never "6,000 to 7,500".
- Ranges use an en-dash, never "to".
- When salary is absent, the space is **closed**, not filled with "Negotiable"
  unless the source says so. Never fabricate.
- When every role shares a range, promote it **once, large**, above the position
  block rather than repeating it per row. Repetition destroys its impact.

---

## 12. Benefits presentation

- **Icon strip at the base**, never prose, never bullets.
- **Four to six maximum.** Beyond six, benefits stop being a benefit and become
  a list.
- Each is icon badge + two words. "FREE FOOD", not "Food will be provided".
- Benefits are a **closing argument** — they sit after the CTA in reading order,
  reinforcing a decision already made.

---

## 13. Eligibility presentation

- **One consolidated block.** The current output's worst defect is repeating
  "Min. 5 years" under all seven positions — seven times the ink for one fact.
- Where a requirement is universal, state it **once** under a Flag heading.
- Where it genuinely varies per role, it belongs in the role's value pairs.
- Set at Body size, ≤ 3 lines. Longer conditions belong in the source document,
  not the advertisement.

---

## 14. Footer philosophy

- **Quiet but trust-dense.** The footer is where a candidate checks whether the
  agency is real — it must be complete and it must never compete.
- Anchor-coloured, Legal to Body sizing, no accent except a hairline.
- Carries: agency legal name, licence number, address, website, QR.
- **Maximum 14% of canvas height.**
- It is the only region permitted to be information-dense and visually silent
  at the same time.

---

## 15. QR philosophy

- **Always paired with a verb label** — "SCAN TO VERIFY". A bare QR is ignored.
- **Always on a white plate with a full quiet zone.** A QR on artwork is a QR
  that does not scan.
- **Minimum 0.12W.** Below this it fails at WhatsApp compression.
- **Never decorative, never stylised, never colour-tinted.** It is a functional
  trust instrument.
- Bottom-right of the footer, consistently, every time — candidates learn where
  to look.

---

## 16. Trust indicators

Ranked by weight in the Gulf market:

1. Government licence number (MEA/eMigrate registration)
2. KAI verification QR
3. Years established ("SINCE 1984")
4. Certifications (ISO)
5. Client/employer name, where disclosed

- **Two to four visible.** One reads as thin; five reads as insecure.
- Rendered as chips or icon badges in the footer — never as body text.
- **Never fabricated.** A trust indicator that cannot be verified is worse than
  none, because it is the thing a candidate checks.

---

## 17. Logo placement

- **Top-left, always.** Every validated reference does this; candidates scan for
  it there.
- **Clear space = 1× logo height** on all sides. No element enters it.
- **Height 0.055W–0.075W.** Below this it is unreadable at thumbnail size.
- **On a solid plate**, never directly on photography.
- **Real asset only** — never redrawn, never approximated, never AI-generated.

---

## 18. Branding balance

- **Agency branding ≤ 15% of visual weight.** The job is the hero, not the
  agency. This is the candidate-first law expressed visually.
- Logo, name and licence establish credibility once, at the top and bottom.
  They do not recur.
- **The watermark is an attribution trace, not a brand statement.** Confined to
  artwork, never over facts, opacity ≤ 0.05.
- An advertisement where the agency is more prominent than the salary has
  failed.

---

## 19. Mobile-first rules

The advertisement is read on a phone before anywhere else.

- **The 320px test.** Rendered 320px wide, the Display line, one position title,
  and the CTA must all remain legible. If they do not, the design fails —
  regardless of how it looks at full size.
- **The thumbnail test.** At 150px, the campaign type must still be identifiable
  from colour blocking and hero alone.
- No hairline below 2px — it disappears under feed compression.
- Contrast ≥ 4.5:1 on every fact; JPEG recompression erodes marginal contrast.
- **Vertical reading order only.** Nothing requires horizontal scanning across
  more than two columns.

---

## 20. Social-media rules

| Platform | Ratio | Note |
|---|---|---|
| **Default** | **4:5 (1080×1350)** | Best feed real-estate on Instagram, Facebook, LinkedIn |
| LinkedIn | 4:5 or 1:1 | Most restrained treatment; professional register |
| WhatsApp | 4:5 | Must survive aggressive recompression |
| Instagram | 4:5 | Highest visual expectation |

- **Safe margin 4%** on all edges — platform crops eat the outer band.
- Nothing critical in the outer 4%. Ever.
- **First-second legibility:** Display + hero must communicate the offer before
  any body text is read.
- Portrait always. Landscape is for desktop, and this is not a desktop product.

---

# Layout Families

Ten families. Each is a different *composition*, not a different colour scheme.

---

### 1. Premium Corporate
- **Purpose:** The default professional campaign. Broadest applicability.
- **Visual hierarchy:** Display → hero → position plates → CTA → trust strip
- **Grid:** 8/4 asymmetric; three vertical zones
- **Hero:** Top 34%, curved bottom-right mask, subject on right third
- **Typography:** Single sans; Display 0.115W; strict value pairs
- **Components:** Flag, Plate, Value pair, Icon badge, Strip
- **Information flow:** Offer → proof → roles → action → reassurance
- **Best for:** Multi-role technical campaigns, 4–12 positions

### 2. Industrial Energy
- **Purpose:** Heavy industry, oil & gas, EPC — authority and scale.
- **Visual hierarchy:** Hero dominates; type reversed out of darkness
- **Grid:** Full-bleed hero with scrim; 7/5 lower split
- **Hero:** Full-canvas photographic base, 45% visible above the fact surface
- **Typography:** Condensed heavy display; high tracking on labels
- **Components:** Ribbon, Chip, Rule, Plate (dark variant)
- **Information flow:** Scale → credibility → roles → action
- **Best for:** Refinery, shutdown, offshore, EPC campaigns

### 3. Executive Hiring
- **Purpose:** Senior and management roles. Restraint signals seniority.
- **Visual hierarchy:** Whitespace → single role → credentials → discreet CTA
- **Grid:** Single column, wide margins (0.09W)
- **Hero:** Small portrait-orientation image or none at all
- **Typography:** Optional serif display; generous leading
- **Components:** Rule, Value pair, Chip
- **Information flow:** Role → scope → requirements → confidential contact
- **Best for:** 1–3 senior positions

### 4. Shutdown Project
- **Purpose:** Time-boxed mobilisation. Urgency is the message.
- **Visual hierarchy:** Date → positions → mobilisation window → CTA
- **Grid:** Diagonal ribbon crossing upper third; 8/4 below
- **Hero:** Mid-canvas band, action photography, angled mask
- **Typography:** Dates at Display scale — the date *is* the headline
- **Components:** Ribbon, Flag, Compact rows
- **Information flow:** Deadline → roles → speed of process → action
- **Best for:** Turnaround, shutdown, emergency mobilisation

### 5. Mega Project
- **Purpose:** Landmark projects. Ambition and scale.
- **Visual hierarchy:** Panoramic hero → project name → discipline index → CTA
- **Grid:** Panoramic hero, three-column index below
- **Hero:** Wide establishing shot, full width, 38%
- **Typography:** Monumental display; disciplines as Flag headings
- **Components:** Flag, Index columns, Chip, Strip
- **Information flow:** Vision → scale → disciplines → action
- **Best for:** 40+ positions across multiple disciplines

### 6. Walk-in Interview
- **Purpose:** Event-driven. Venue and date outrank the roles.
- **Visual hierarchy:** Date/venue → positions → documents to bring → map
- **Grid:** Event card dominant in upper half; roles compressed below
- **Hero:** Small or absent — the *event* is the hero
- **Typography:** Date at Display; venue at H1
- **Components:** Plate (event), Compact rows, Icon badge, Chip
- **Information flow:** When/where → who → what to bring → confirm
- **Best for:** Client interviews, spot selection, recruitment drives

### 7. Modern LinkedIn
- **Purpose:** Professional feed. Credibility over volume.
- **Visual hierarchy:** Restrained display → role → company credibility → CTA
- **Grid:** 1:1 or 4:5, symmetric-leaning, high whitespace
- **Hero:** Abstract or architectural; low saturation
- **Typography:** Moderate scale contrast (5:1); no uppercase body
- **Components:** Rule, Value pair, Chip
- **Information flow:** Role → employer → package → apply
- **Best for:** White-collar, engineering, professional hiring

### 8. Facebook Campaign
- **Purpose:** Maximum reach and shareability.
- **Visual hierarchy:** Colour block → display → salary → CTA
- **Grid:** Bold colour blocking, 8/4
- **Hero:** Cut-out subject overlapping the colour block — depth through overlap
- **Typography:** Maximum scale contrast (up to 10:1); salary promoted large
- **Components:** Flag, Plate, Icon badge, Strip
- **Information flow:** Attention → offer → roles → action
- **Best for:** High-volume blue-collar campaigns

### 9. International Recruitment
- **Purpose:** Cross-border mobilisation; visa and process reassurance.
- **Visual hierarchy:** Destination → roles → process/visa → trust → CTA
- **Grid:** Split origin/destination motif; 7/5
- **Hero:** Destination skyline or worksite, diagonal mask
- **Typography:** Destination at Display; process steps as numbered chips
- **Components:** Chip, Icon badge, Rule, Strip
- **Information flow:** Where → what → how it works → who guarantees it
- **Best for:** Multi-country campaigns, visa-led propositions

### 10. Minimal Premium
- **Purpose:** Quiet confidence. Differentiation through restraint.
- **Visual hierarchy:** Type only; hierarchy entirely through scale
- **Grid:** Single column, extreme margins (0.11W)
- **Hero:** None, or a single hairline-framed detail image
- **Typography:** The entire design. Display to Body at 8:1
- **Components:** Rule, Value pair
- **Information flow:** Role → package → contact
- **Best for:** Boutique agencies, confidential searches, premium positioning

---

# Selected Family

## Premium Corporate — with Industrial Energy's hero treatment

**Selected for implementation.** Rationale, against KAI's actual constraints:

1. **It is the family the market already validates.** Of the five live agency
   advertisements studied, four are structurally Premium Corporate: logo
   top-left, display hook, bounded position blocks, labelled CTA, trust-dense
   footer. This is not a hypothesis about what works — it is what agencies
   currently publish and candidates currently respond to.

2. **It is the only family that scales across all four density tiers.**
   Executive Hiring breaks above 3 positions. Mega Project is absurd below 40.
   Walk-in Interview requires an event that most requirements do not have.
   Premium Corporate carries T1 through T4 by swapping the position component
   while the composition holds.

3. **It survives the mobile and WhatsApp tests.** High scale contrast, bold
   colour blocking and a single accent remain legible at 320px and through feed
   recompression. Minimal Premium fails the thumbnail test; Modern LinkedIn's
   restraint disappears in a WhatsApp forward.

4. **It has room for regulated content.** Licence number, QR and disclaimer fit
   in its trust-dense footer without competing — a constraint most consumer
   campaign layouts cannot absorb.

5. **The Industrial Energy hero treatment supplies what is missing.** Premium
   Corporate alone risks the same flatness as today's output. Borrowing its
   curved/angled hero mask, photographic depth and reversed-out display type
   provides the focal point and the organic edge that break the document
   signature — the two highest-impact fixes from §1.

**What this family changes, concretely, versus the current output:**

| Current | Premium Corporate |
|---|---|
| 7 stacked full-width bands | 3 zones with internal structure |
| Scale contrast 2.5:1 | 6:1 minimum |
| Horizontal band edges | Curved/angled hero mask |
| No focal point | Hero subject on the outer third |
| Uniform repeating rows | Plates with internal value pairs, rhythm break |
| "Min. 5 years" repeated ×7 | Stated once under a Flag |
| Artwork ~8% visible | Hero 28–42%, integrated with type |
| Salary in a table cell | Salary promoted as a value pair |

---

**Next step, not yet taken:** replace only the visual layer of the existing
Advertisement Composer with this language. The fact placement engine, renderer,
QR, verification and pipeline are reused unchanged.
