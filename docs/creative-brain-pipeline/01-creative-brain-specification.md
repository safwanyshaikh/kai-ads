# THE CREATIVE BRAIN — SPECIFICATION

## 0. What it is

The Creative Brain is a **pre-visual decision engine**. It runs *before* GPT
draws a background and *before* the renderer places anything. It consumes only
grounded source facts and emits a single structured object: a **Creative
Direction**. That object is the brief that the GPT background generator and the
(frozen) renderer both obey.

It is a Creative Director's judgment, formalized. It does not draw. It decides.

### Three inviolable laws

1. **Never invents facts.** It may only *reorder, emphasize, reframe, and
   weight* grounded information. It cannot add a salary, a benefit, a vacancy
   count, or an urgency the source does not contain.
2. **Classifications inform emphasis, never content.** It may judge "is this
   employer a candidate-magnet brand?" — but that only changes *how prominent*
   a fact is, never adds a new claim to the artwork.
3. **Reframing ≠ fabricating.** "Basic Salary + Daily Overtime" may be reframed
   as an *earning* message. It may not become "high salary" or a number.

---

## 1. INPUT — what the Brain is allowed to see

Only the grounded source record: employer, industry, country, project type,
positions[], benefits[], requirements, interview schedule, contact, agency +
RA license + registration, verification route (KAI `/v/`). Plus a **read-only
classification knowledge base** (destination prestige tiers, sector pay
association, project-scale signals, brand-recognition tiers) used to *classify*
grounded facts — never to contribute printable content.

---

## 2. OUTPUT — the Creative Direction object (18 decisions)

1. **Primary candidate hook** — the highest-pull grounded lever that is legally
   emphasizable (money if a number exists; else destination/sector/
   specialization). Never a brand unless the brand is a proven candidate magnet.
2. **Secondary supporting message** — the second lever, ideally the one that
   converts interest into desire.
3. **Employer prominence — Low / Medium / High** — High only if the name itself
   pulls candidates; else demote to a trust line.
4. **Country prominence — Low / Medium / High** — by destination pull tier.
5. **Industry prominence — Low / Medium / High** — by sector pay/prestige.
6. **Project prominence — Low / Medium / High** — elevate if it signals
   specialization/scale; keep supporting if it's insider jargon.
7. **Emotional direction** — {Career, Money, Prestige, Urgency, Stability, Mega
   Project, …}, ranked primary→tertiary, derived from the fact mix.
8. **Colour mood** — {Warm industrial, Premium corporate, High urgency,
   Technical blue, Desert gold, …}. One committed mood.
9. **Visual story** — {Worker hero, Team, Refinery, Offshore platform,
   Construction, Mechanical close-up, …}. The brief GPT receives.
10. **Candidate attention path** — the exact eye route in the first 3 seconds.
11. **Typography hierarchy** — what gets type weight, largest→smallest.
12. **Information hierarchy** — content blocks ranked by importance.
13. **CTA priority — Low / Medium / High** — High when the action is time-bound.
14. **Benefits priority — Low / Medium / High + reframe instruction** — reframe
    thin/weak benefits as an earning story rather than listing weak items.
15. **Interview priority — Low / Medium / High** — High whenever dates exist.
16. **Trust priority — Low / Medium / High** — footer-weight unless the market
    is trust-sensitive.
17. **Mobile scrolling strategy** — what must survive thumbnail vs. may shrink.
18. **Largest visual weight** — the single dominant element (usually
    destination/sector/hero, almost never an unrecognized employer name).

---

## 3. Decision sequence

1. Classify every grounded fact for pull strength.
2. Rank the levers → primary/secondary hook.
3. Assign prominence levels *relative to each other* so one clear winner exists.
4. Derive emotional direction from the lever mix.
5. Map emotion + sector + destination → colour mood + visual story (GPT brief).
6. Lay the attention path; bind typography and information hierarchy to it.
7. Set CTA / benefits / interview / trust priorities.
8. Stress-test mobile; declare must-survive vs. may-shrink.
9. Name the single largest-weight element.
10. Truth audit: every emphasized item grounded, nothing invented.

---

## 4. Output schema (shape)

```
CreativeDirection {
  primaryHook, secondaryMessage,
  prominence: { employer, country, industry, project },
  emotionalDirection: [primary, secondary, tertiary],
  colourMood, visualStory,
  attentionPath: [ordered steps],
  typographyHierarchy: [ordered],
  informationHierarchy: [ordered],
  priorities: { cta, benefits(+reframe), interview, trust },
  mobileStrategy: { mustSurvive[], mayShrink[] },
  largestVisualWeight,
  truthAudit: { emphasizedFacts[], inventedFacts: NONE }
}
```

---

# WORKED EXAMPLE — BILFINGER (locked)

**Grounded input:** Bilfinger · Oil & Gas · Saudi Arabia · Shutdown project · 5
skilled trades (Welders TIG/Multi, I&C, Rotating Equipment, Mechanical,
Electrical) · Benefits: Basic Salary, Daily Overtime up to 4 hrs · Requirement:
shutdown experience · Interviews: 14–15 July Baroda, 18 July Mumbai · Contact +
Al Yousuf LLP, RA 9986 · KAI verification.

**Lever ranking:** Destination (Saudi Arabia, high pull) > Sector (Oil & Gas,
high pay-association) > Earning (daily overtime) > Specialization (shutdown) >
Employer (Bilfinger — credible globally, not a candidate-magnet in the Indian
trades market). No salary number exists → money leads via overtime as secondary.

| # | Decision | Value |
|---|---|---|
| 1 | Primary hook | "SAUDI ARABIA · OIL & GAS SHUTDOWN" |
| 2 | Secondary message | "Experienced Tradesmen · Daily Overtime up to 4 Hours" |
| 3 | Employer prominence | Medium (credibility, not hero) |
| 4 | Country prominence | High |
| 5 | Industry prominence | High |
| 6 | Project prominence | Medium |
| 7 | Emotional direction | Money → Prestige → controlled Urgency |
| 8 | Colour mood | Desert gold / warm industrial |
| 9 | Visual story | Worker hero at refinery, golden hour |
| 10 | Attention path | hero+destination headline → earning/experience hook → positions ("is my trade here?") → interview city+date → phone/CTA → trust+QR |
| 11 | Typography hierarchy | destination/sector → hook → position titles → earning → interview → contact → employer/legal |
| 12 | Information hierarchy | opportunity → positions → earning → interviews → contact → trust/legal |
| 13 | CTA priority | High |
| 14 | Benefits priority | Medium-High, REFRAME as earning |
| 15 | Interview priority | High |
| 16 | Trust priority | Medium |
| 17 | Mobile strategy | Survive: destination+sector headline, trade list, interview date+city. Shrink: registration number, QR caption, employer credit. |
| 18 | Largest visual weight | The Gulf oil & gas opportunity + hero worker — NOT "BILFINGER" |

**Truth audit:** Every emphasized item is grounded. Invented facts: NONE. No
salary figure asserted (none supplied). No fabricated perks.

**Why it matters:** the Brain independently demotes the employer name and
elevates destination + earning — the exact two weaknesses flagged in the V12
Creative Director verdict. This is the difference between a *decided*
advertisement and a *decorated data sheet*.
