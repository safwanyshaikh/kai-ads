# Positioning & Tenancy — the KAI frame (locked note)

A course-correction to keep the mental model straight for every future ad.

## The three layers

| Layer | Who (example) | Role |
|---|---|---|
| **KAI** | The platform + **its own design framework** | The product and the **moat**. KAI's house style **is** the benchmark. |
| **Tenant** | The recruiting **agency** — *Al Yousuf Enterprises LLP is one tenant among many* | Their identity (logo, Agency Visual DNA palette, RA license, contact) applies to the ad — footer + colour bias. Any agency onboards identically. |
| **Client / End-user** | The **employer** with the requirement — *Halliburton* | Supplies the vacancies/facts (e.g. 129 positions across 19 divisions). It is a *requirement processed for the tenant* — never the design standard. |

## The benchmark rule (important)

- The market papers — *Assignments Abroad Times* and its boxed classified ads —
  are the **reference / the floor to beat, NOT the template.**
- KAI does **not** copy them. KAI has **its own framework**, and every
  requirement — **any tenant, any client** — is delivered in **that** frame,
  consistently.
- Target = "**recognizably KAI, better than the market**," not "looks like the
  newspaper."

## How this maps to the code (already correct)

- `AdvertisementFacts.agencyName` → the **tenant** (Al Yousuf). *(footer identity)*
- `AdvertisementFacts.employer` → the **client / end-user** (Halliburton). *(the requirement)*
- **Agency Visual DNA** applies the **tenant's** colour identity — it is never
  replaced by the Creative Brain's `colourMood` (see `05-phase-a-report.md`,
  FULL PARITY decision). This is what keeps every ad recognizably the tenant's
  while staying in the KAI frame.

## Practical consequence for ad production

1. One tenant (agency) → many client requirements → each a KAI-framed ad.
2. The tenant's identity is constant across their ads (DNA, footer, RA).
3. The client's facts change per requirement (employer, positions, country).
4. The **frame** — KAI's design language — is constant across **all** tenants.
