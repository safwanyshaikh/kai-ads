import type { AdvertisementFacts } from "@/server/generation/archetypes";

/**
 * REAL production incident fixture — not synthetic. Pasted verbatim by
 * the product owner:
 *
 *   "Hiring for Abu Dhabi / Welders Tig & Arc (CS/SS) / Muti Welder /
 *   Food Allowance 300AED + Free Accommodation + Transportation+
 *   Medical+ Yearly Leave cycle / M. 8655960415"
 *
 * This exact fixture, run through the real GPT-Native pipeline, is what
 * surfaced the fabricated-salary defect: no salary figure was ever given
 * (only a food allowance denominated in AED), yet salaryIntelligence's
 * old currency-code regex treated the bare "AED" in "Food Allowance —
 * 300 AED" as evidence of a real salary, which told GPT to "lead with
 * the salary offer" — with nothing real to render, GPT invented
 * "EARNING 3,800 AED" on the actual delivered image.
 * Fixed in commit aeb6447 / offer.ts's salaryIntelligence.
 */
export const realWorldWelderFacts: AdvertisementFacts = Object.freeze({
  header: "Welders Required — Abu Dhabi",
  industry: "Construction",
  country: "United Arab Emirates",
  employer: null,
  positions: [
    { title: "Welder TIG & Arc (CS/SS)" },
    { title: "Multi Welder" },
  ],
  benefits: [
    { label: "Food Allowance", detail: "300 AED" },
    { label: "Free Accommodation" },
    { label: "Transportation" },
    { label: "Medical" },
    { label: "Yearly Leave cycle" },
  ],
  interview: [],
  contact: { phone: "8655960415" },
  footer: null,
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
});
