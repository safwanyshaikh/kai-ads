import type { AdvertisementFacts } from "@/server/generation/archetypes";

/**
 * REAL production incident fixture — not synthetic. Pasted verbatim by
 * the product owner (Power & Energy / Saudi Arabia JD), used to compare
 * KAI's GPT-Native output directly against a plain-ChatGPT sample the
 * product owner produced from the identical text.
 *
 * This fixture's real generations surfaced THREE separate, distinct
 * fabrication defects in sequence, each fixed and re-verified against a
 * real GPT Image call before moving to the next:
 *   1. No currency label at all, then a fabricated "$" (US dollar) sign
 *      on a Saudi Arabia posting whose real pay ("5K to 7K Basic") had
 *      no currency stated at all.
 *      Fixed: applyDestinationCurrency (commit 0a85eb7) — a bare figure
 *      now gets the destination's REAL currency (SAR) applied before it
 *      ever reaches the prompt, never guessed by the image model.
 *   2. A fabricated headline number ("EARNING SAR 50-700") completely
 *      disconnected from the real "SAR 5K to 7K Basic" figure rendered
 *      correctly elsewhere on the same image.
 *      Fixed: SalaryDecision.salaryText (commit ee38bf3) — the dominant
 *      hook now embeds the real figure instead of a generic "Earning —
 *      salary opportunity" phrase that left GPT to invent a number.
 *   3. The agency name/trust footer vanished from the render entirely,
 *      and GPT separately invented "(10 openings)" for a position with
 *      no given count, and altered "5+ Years" to "3+ Years" in the
 *      requirement note.
 *      Fixed: trust-layer.ts font-fitting + broadened fidelity rules
 *      (commit a56e053).
 */
export const realWorldPowerEnergyFacts: AdvertisementFacts = Object.freeze({
  header: "Power Infrastructure Engineers — Saudi Arabia",
  industry: "Power & Energy",
  country: "Saudi Arabia",
  employer: null,
  positions: [
    { title: "Testing & Commissioning Engineer" },
    { title: "Protection Engineer" },
    { title: "Design Coordinator" },
    { title: "Protection Design Engineer" },
  ],
  benefits: [
    { label: "Salary Range", detail: "5K to 7K Basic (varies based on interview assessment)" },
  ],
  interview: [],
  contact: { email: "jobs@alyousufent.com" },
  footer: "Bachelor's Degree - Electrical (5+ yrs) required · SCE/Saudi Experience preferred · GIS substation up to 400KV required",
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
});
