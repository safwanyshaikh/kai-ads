# KAI Creative Director Module v1.0 (LOCKED)

The **brain of KAI Ads**. It makes every commercial + creative decision **before**
the GPT background is generated and **before** the composition engine places any
factual content. It is a decision engine, not a renderer. It lives in the
Creative Director module — never scattered across the renderer.

Order of operation: `Source → Truth Brain → Creative Director Module (this) →
GPT Background → Frozen Overlay → Validation/Score → Publish`.

Tenant rule: agency/company/contact/licence/data are **tenant input**, never KAI
constants. The engines below are generic; they consume tenant data at runtime.

---

## 1. Opportunity Priority Engine
Rank what dominates the ad. Priority order:
`Country → Salary/Earning → Industry → Project → Employer → Positions →
Benefits → Interview → Trust`. **Exactly one primary hero — never more.**

## 2. Country Intelligence
Understand the destination automatically (see table below): currency, premium
colour, emotional tone, flag.

## 3. Currency Intelligence (validate salary — wrong currency = FAIL)
Saudi Arabia→**SAR** · UAE→**AED** · Kuwait→**KWD** · Qatar→**QAR** ·
Bahrain→**BHD** · Oman→**OMR**.

## 4. Industry Intelligence
Each industry sets hero image, background, colour palette, typography mood:
Oil & Gas · Petrochemical · Construction · Infrastructure · Marine · Shipyard ·
Hospitality · Healthcare · FMCG · Retail · Aviation · Manufacturing ·
Renewable Energy · Logistics.

## 5. Candidate Psychology Engine (one dominant hook only)
High Salary · Gulf Opportunity · Immediate Interview · Spot Selection ·
Free Benefits · Mega Project · Premium Employer · Long Term Contract ·
Career Growth.

## 6. Visual Story Engine (one story, never mix)
Hero worker · Team · Refinery · Royal Palace · Offshore platform · Metro ·
Airport · Hospital · Hotel · Factory.

## 7. Advertisement Personality (exactly one — controls design language)
Executive · Corporate · Premium · Mass Hiring · Walk-in Drive · Shutdown ·
Mega Project · Urgent Mobilization · Luxury Hospitality · Government · Healthcare.

## 8. Benefit Intelligence (rank; never invent)
1 Salary · 2 Overtime · 3 Food · 4 Accommodation · 5 Transportation ·
6 Medical · 7 Insurance · 8 Air Ticket · 9 Leave · 10 Contract Duration.

## 9. Interview Intelligence
Emphasize: Spot Selection · Final Interview · Walk-in · Online Interview.
Display: Date · City · Venue.

## 10. Position Intelligence (group jobs — never a random unordered list)
Group by discipline / division: Engineering · Mechanical · Electrical · Civil ·
Instrumentation · Operations · Production · Hospitality · Healthcare · Marine
(or the client's own divisions). Numbered, grouped cards.

## 11. Trust Engine (mandatory)
Agency Logo · Agency Name · MEA Registration · RA Number · QR Verification ·
Company Website (if available).

## 12. Typography Intelligence
Assign Hero / Secondary / Table / CTA text; maintain hierarchy. KAI 5-font set:
Anton (hero) · Oswald (bars/labels) · Barlow Condensed (positions) ·
Archivo Black (salary/emphasis) · Roboto Condensed (address/body).

## 13. Mobile-First Intelligence
Must remain readable on WhatsApp · Facebook · Instagram · LinkedIn · Newspaper PDF.

## 14. Creative Validation Engine (reject if ANY)
Wrong currency · wrong country flag · wrong industry image · low contrast · too
many colours · weak hierarchy · dead space · employer dominates opportunity ·
tiny CTA · poor mobile readability.

## 15. Commercial Quality Score (0–100)
Scroll-Stop · Commercial Appeal · Candidate Psychology · Information Hierarchy ·
Colour Harmony · Typography · Trust · Mobile Readability · Brand Quality ·
Publish Readiness.
Publication rule: **95–100 Auto-Approve · 90–94 Creative Review · <90 Reject &
redesign.**

---

## Country Intelligence table (v1)

| Country | Currency | Premium Colour | Emotional Tone |
|---|---|---|---|
| Saudi Arabia | SAR | Desert Gold | Opportunity |
| UAE | AED | Blue + Gold | Modern Career |
| Kuwait | KWD | Deep Blue | High Income |
| Qatar | QAR | Burgundy | Premium |
| Bahrain | BHD | Red + White | Stable |
| Oman | OMR | *(to confirm)* | *(to confirm)* |

Extend this table per new destination — it is data, not code.
