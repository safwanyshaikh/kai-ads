# Assignments Abroad Times — DTP Ad Framework (canonical reference)

## DEFINITION (locked)

- **Every advertisement in Assignments Abroad Times IS a DTP-style ad.** DTP is
  not one layout among many — it is *the* style of the whole paper. Each agency
  box is a different layout, but all of them are DTP.
- **There are exactly two output options / variants:** **B/W** or **Colour**.
  Nothing else. Both are DTP, both on white newsprint (never dark).
- Therefore: "make a KAI recruitment ad" ⇒ make a **DTP ad**, and the only
  choice to confirm is **B/W or Colour**.


**Purpose:** the house grammar for KAI's DTP-style recruitment ads, learned from
the real *Assignments Abroad Times* (AAT) newspaper. **Refer to this file
whenever any DTP ad is requested.** AAT *is* the DTP style; every agency's box is
a *different layout* built on the *same* shared grammar below.

## STATUS — the KAI Ads benchmark (locked)

**DTP style is THE benchmark output for KAI Ads**, delivered in **two
first-class variants**, both valid:

- **B&W variant** — white newsprint, black text, black bars reversed to white,
  zebra rows. The economical print classified.
- **Colour variant** — white newsprint with **spot-colour accents** (red /
  royal-blue / yellow / green bars, chips, headers) and full-colour client &
  agency logos. Same grammar, colour used as accent — **still a white page**.

Both are DTP. Both fill every inch. Both are grounded. The variant is a styling
choice on the **same** framework — never a different background theme, and
**never** a dark/black-page poster.

> Save-first note: this exists because early attempts got it wrong. Read
> "Mistakes to never repeat" before building anything.

---

## Tenant vs KAI (read first)

The reference boxes and any agency/company/contact/licence/positions in them are
**tenant-specific example DATA — never KAI design, never hardcoded** into the
engine, the framework, or the Constitution. KAI owns the **rules and style**;
the tenant supplies its own identity + data at runtime. We are *improving* the
classified craft, not adopting any one agency. Every renderer must be generic
and data-driven; no agency name, phone, licence, or client is a code constant.

## DTP sub-styles (all on white newsprint)

Learned from real boxes; pick per ad, both variants of each are valid:

- **B&W bordered grid** (e.g. SISCO/Flywell, Om Sai): thick black border; **black
  bars with reverse white text** as section dividers; **light-grey sub-bars** for
  notes; a **bordered cell table** for positions (thin black cell borders, bold
  caps); client logo + text header; agency block + `Lic. No.` bar.
- **B&W list** (e.g. ITL): bullet position list, reversed licence bar.
- **Colour accent** (e.g. ABM yellow / M. Gheewala blue-yellow-red): white page
  with spot-colour bars/chips; the deep **cream + dark + gold** premium set is a
  KAI-refined colour option.
- Common devices: starburst callout ("Spot Selection"), rounded black badge
  ("GULF EXP MANDATORY"), notched/pennant banner for email/contact, ❖ / • / ▸
  bullets, grey sub-bar for conditions.

## 0. Mistakes to never repeat

1. **NO dark / black full-background posters.** AAT is printed on **white
   newsprint**. Background = **white**, text = **black**. Dark-theme "premium
   poster" designs are WRONG for DTP.
2. **Logos: use ONLY what the client actually provides.**
   - Use the **agency logo** and any **client logo files the client supplies**.
   - **NEVER scrape, crop, screenshot, trace, or recreate a logo** from a photo,
     a bus, a building, or anywhere else. If no logo file is provided, **omit the
     logo** — deliver with what you have. A missing client logo is fine; a
     fabricated/cropped one is not.
   - Do not typeset the employer name as a fake "logo" bar either. Either a real
     supplied logo, or nothing.
3. **Colour is an accent on white, not a theme.** Spot colour (red/blue/yellow/
   green) appears as small bars/fills/rules on white. Many boxes are pure B&W.
   Colour never becomes the page.
4. **No blank space.** Newspaper space is paid per column-cm — fill every inch.
5. **No fabricated facts.** Only source-grounded positions, salaries, dates,
   contacts (Truth Brain).

---

## 1. Canvas & medium

- **Background:** white (newsprint). **Body text:** black.
- **Border:** each ad is a **bordered box** — thin/thick black rules, often
  double-ruled. Boxes butt against neighbours; the border defines the ad.
- **Density:** maximum. Tight leading, small gutters, full-bleed to the border.
- **Aspect:** variable — a box can be a small classified, a quarter, half, or
  full column/page. **Size extends to fit the content** (the user's rule).

---

## 2. Typography — the KAI DTP 5-font system (LOCKED)

The real paper uses the CorelDraw/PageMaker print-shop set: mostly Helvetica/
Arial in three weights + a heavy display face. KAI standardises on **five**
Google fonts that reproduce it and load reliably:

| Element | Real AAT type | KAI font (locked) |
|---|---|---|
| Company / employer name, big callouts | Impact / Helvetica Inserat | **Anton** |
| Headers, section bars, ribbons, pills, contact labels | Helvetica Condensed Bold | **Oswald** |
| Positions / dense lists | Arial Narrow Bold | **Barlow Condensed** |
| Salary numerals, key emphasis | Arial / Helvetica Black | **Archivo Black** |
| Address, fine print, body | Arial / Helvetica regular | **Roboto Condensed** |

Load: `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=Barlow+Condensed:wght@600;700;800&family=Archivo+Black&family=Roboto+Condensed:wght@700;800&display=swap');`
Always give fallbacks: `... ,'Arial Narrow','Liberation Sans',sans-serif`.

- **Case:** ALL CAPS for headers, banners, position names.
- **Weight:** 700–800+ almost everywhere; classified ads shout.
- **Hierarchy (largest → smallest):** company name (Anton) → project/country →
  highlight banner → section labels → position rows → notes → agency/legal.
- **Footer fill rule:** the address must **fill the entire footer width** — size
  the font up so it spans the space; no small address floating in blank footer.

---

## 3. Standard structure (top → bottom)

1. **Header** — the client/employer **logo** + **country** (often with a flag)
   + **project/role headline**. Header may be plain black-on-white, a colour
   bar, or a black bar with reversed white text — varies per box.
2. **Highlight banner(s)** — short, high-contrast strips:
   `URGENT`, `FREE RECRUITMENT`, `LONG TERM PROJECT`, `DIRECT CLIENT
   REQUIREMENT`, `WALK-IN INTERVIEW`, `SHORTLISTING IN PROGRESS`,
   `CLIENT INTERVIEW ON <date>`.
3. **Positions block** — the core. A list or table of roles:
   - bullets: `•  ◆  ►  →  ★`
   - optional **qty** column (`10 NOS`, `05 NO's`) OR **salary** column
     (`2500 + OT`, `SR 2,300`) — right-aligned, often with **dotted leaders**.
   - multi-column when many roles; group by trade/country/division.
4. **Interview / venue** — `CLIENT INTERVIEW ON <date> AT <venue + full
   address>`; multiple cities side by side (e.g. Baroda / Mumbai).
5. **Terms / notes** — Food, Duty hours, Overtime, Accommodation, Insurance,
   experience/passport requirements, "walk-in with CV & passport".
6. **Agency footer** — **agency logo** + name + full address + phone/WhatsApp +
   email, and the mandatory **licence line**:
   `REG. LICENSE NO. : B-####/MUM/PART/1000+/####/YYYY` (often a black bar).
   KAI adds a **verification QR** → `/v/` route here.

Not every box has every section; the **grammar is shared, the layout varies**.

---

## 4. Ornaments & devices

- Bullets/arrows: `• ◆ ► → ★`. Icons: `✈ ☎ ✉ ⚑`.
- Reversed (white-on-black) **bars** for section labels and license line —
  used as *accents*, not as the whole background.
- Thin dotted leaders between a name and its qty/salary.
- Small flag chip beside the country name.
- Boxed/starred "vacancy count" callouts (`250+ POSITIONS`, `129 VACANCIES`).

---

## 5. Colour usage (when a box uses colour)

- Applied as **fills on white**: red / royal-blue / yellow / green bars and
  chips. Employer/agency logos keep their brand colour.
- For a **pure B&W** rendering: black bars reversed to white text, black-bordered
  tables, black qty/salary cells with white numerals, light-grey (`#ededed`)
  zebra rows. Still **white page**, never black page.

---

## 6. KAI production checklist (per DTP ad)

- [ ] White background, black text — NOT dark.
- [ ] Real client logo placed (not typeset). Grayscale it only for a B&W box.
- [ ] Real agency logo + licence line in footer.
- [ ] Bold condensed caps; hierarchy correct.
- [ ] Positions with qty **or** salary column; dotted leaders; multi-column if
      dense.
- [ ] Interview venue(s) + dates if grounded; else "Shortlisting in progress".
- [ ] Terms strip (food/duty/OT/accom/insurance) if grounded.
- [ ] Agency footer + REG. LICENSE bar + verification QR (`/v/`).
- [ ] Every inch filled — zero blank space.
- [ ] Every fact source-grounded; nothing invented.
- [ ] Tenant = agency (footer identity); Client = employer (the requirement).

---

## 7. Reference boxes studied (page 3, 18 July 2026 issue)

- International Trade Links — pure B&W, bullet position list, reversed license bar.
- ABM International — colour (yellow body, blue/red bars), country sub-headers,
  salary column, "FREE FOOD + ACC + OT" banner.
- BEBTA — black panel, ◆ bullets with qty prefix, "Regd No" line.
- "SAUDI ARABIA (OIL & GAS PROJECT)" — black reversed header, `→` rows, qty col.
- ASMACS / ASIAPOWER — dense salary tables, multi-office footer.
- Al-Yousuf Enterprises LLP — the tenant; real footer details captured in
  `../creative-brain-pipeline` notes (phones 8104962787/90/99,
  jobs@alyousufglobal.com, Reg. B-1487/MUM/PART/1000+/9986/2022).
