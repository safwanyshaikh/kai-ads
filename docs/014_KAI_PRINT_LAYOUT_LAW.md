# 014 — KAI Print Layout Law (LOCKED)

**Status:** Locked by the product owner. Applies to Theme 02 (AAT/DTP) and to
any future print output. Subordinate to the Supreme Constitution (docs/009) and
to docs/010 including Amendment 1.

These nine principles were adopted after measuring real Assignment Abroad Times
geometry and finding that estimated, canvas-relative heuristics produced
unusable print output. They are not style preferences; each one closed a defect
that had shipped.

---

## 1. Physical dimensions are the source of truth

Print layouts are driven by physical dimensions — centimetres or millimetres at
a target DPI — never by relative canvas percentages.

## 2. Typography minimums are physical

Minimum type size is expressed in points, never as a proportion of canvas size.
The floor for a trade name in a Gulf recruitment classified is **7pt**.

*Defect this closed:* the floor was `0.016 × canvasWidth`. In a 4.3cm column
that is 8px, which at 300dpi is under 2pt — illegible — and the engine reported
the column could hold ninety roles.

## 3. Planner and renderer share one set of metrics

There must never be separate measurement and rendering logic. Any width, height
or column geometry used to plan a layout must be the same value the renderer
draws with.

*Defects this closed:* (a) `titleSize` could be smaller than the floor, so the
planner measured rows at 10px that the renderer drew at 29px; (b) the renderer
computed its own column pitch from the DTP frame while the planner measured
from the page margin; (c) the row box was derived from the drawing cursor and
drifted ~0.92 × titleSize per row against its own text.

## 4. Every booked slot has a deterministic capacity

A booked newspaper slot has a fixed, knowable capacity. When content exceeds it,
generation fails with an explicit capacity report naming the shortfall.
Legibility is never silently reduced, and the canvas never overruns the slot.

## 5. Empty space inside a booked slot is a defect

Unless space is deliberately reserved, white space inside a bought slot is a
layout defect. Leftover depth is redistributed into the content.

*Defect this closed:* a 13.5 × 8.5cm booking rendered at 13.5 × 17.3cm with two
large voids.

## 6. Density comes from columnisation, never from unreadable text

Information density is achieved by intelligent columnisation and grouping. It is
never achieved by setting type below the floor.

A column must be wide enough for the widest **unbreakable word** it must hold,
not merely produce an acceptable line count. Testing line count alone allowed a
negative available width to pass as "2 lines", and salary figures printed
through job titles.

## 7. Agency identity appears once

Logo, legal name, licence number and address are set once, in the trust strip at
the foot. No duplicated branding anywhere on the advertisement.

*Defect this closed:* the agency name printed three times on one advertisement.

## 8. Salaries are never merged

A salary may be stated once for a group **only when every position in that group
carries genuinely the same salary**. Different salaries are never combined into
a range or a single figure.

*Defect this closed:* on a tight slot the engine printed the minimum and maximum
as a range. A candidate reading it could not tell which role paid what. That is
a factual defect, not a layout economy. When salaries differ the column stays and
the advertisement fails on capacity instead.

## 9. Ink is a palette, not a layout

Single-ink (newspaper) output is a palette substitution over identical geometry:
one black plate, tints by halftone screen. It is not a second rendering path,
and it is not a greyscale filter applied to a colour render — greyscaling turns
gold into a muddy mid-grey with no contrast against cream.

---

## Measured slot capacity

At 300dpi, KAI AAT/DTP theme, measured by search — not estimated. Counts assume
a vacancy-count cell per role, two benefits and no interview block.

| Slot | px | No salary | Same salary | Varied salary |
|---|---|---|---|---|
| 1 col — 4.3 × 9.5 cm | 508 × 1122 | 19 | 19 | 7 |
| 2 col — 8.4 × 12.2 cm | 992 × 1441 | 30 | 30 | 19 |
| 3 col — 13.5 × 8.5 cm | 1594 × 1004 | 19 | 8 | 6 |
| 3 col — 13.5 × 12.3 cm | 1594 × 1453 | 32 | 28 | 20 |
| 1.5 col — 6.1 × 19.5 cm | 720 × 2303 | 76 | 76 | 44 |
| 4 col — 17.5 × 20.8 cm | 2067 × 2457 | 52 | 52 | 27 |
| 5 col — 22.6 × 20.6 cm | 2669 × 2433 | 32 | 32 | 20 |

**Reading this table.** A per-role salary roughly halves capacity, because each
column must reserve the width the widest salary genuinely measures. A wider slot
does not always hold more roles: type scales with advertisement width, so a
5-column advertisement sets larger type than a 1-column one — which is also how
the paper behaves.

**AAT page grid, measured:** 38.0 × 56.3 cm page, 7-column grid, ~4.3 cm per
column.

---

## Theme 02 status

Production complete except for final visual polish. Remaining work is limited
to typography refinement, visual balance, spacing polish and validation against
physical Assignment Abroad Times samples. No architectural change, no new layout
engine, no new rendering logic.

Once that polish lands, Theme 02 freezes permanently and all effort moves to
Theme 01 (Premium AI Campaign), the flagship product.
