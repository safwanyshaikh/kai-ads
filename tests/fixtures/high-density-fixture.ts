import type { AdvertisementFacts } from "@/server/generation/archetypes";

/**
 * Genuinely high-density acceptance fixture: 18 positions across multiple
 * trade categories with vacancy counts and experience requirements — the
 * shape that earns the HIGH_DENSITY archetype's vacancy table.
 *
 * Source: synthetic fixture constructed from real Gulf construction
 * recruitment patterns. Clearly labelled as a test fixture, never
 * presented as a real agency's data.
 */
export const highDensityFacts: AdvertisementFacts = Object.freeze({
  header: "Multiple Trades Required for Refinery Turnaround Project",
  industry: "Oil & Gas",
  country: "Kuwait",
  employer: "Petrofac",
  positions: [
    { title: "Pipe Fitter", count: 25, experience: "5+ yrs" },
    { title: "Structural Welder", count: 20, experience: "5+ yrs" },
    { title: "TIG Welder", count: 15, experience: "5+ yrs" },
    { title: "Instrument Technician", count: 10, experience: "3+ yrs" },
    { title: "Electrical Technician", count: 12, experience: "3+ yrs" },
    { title: "Mechanical Fitter", count: 18, experience: "4+ yrs" },
    { title: "Rotating Equipment Technician", count: 8, experience: "5+ yrs" },
    { title: "Rigger", count: 15, experience: "3+ yrs" },
    { title: "Scaffolder", count: 20, experience: "3+ yrs" },
    { title: "Insulation Helper", count: 12 },
    { title: "NDT Technician — UT/RT", count: 6, experience: "5+ yrs" },
    { title: "Safety Officer", count: 5, experience: "3+ yrs" },
    { title: "QA/QC Inspector — Welding", count: 4, experience: "5+ yrs" },
    { title: "QA/QC Inspector — Piping", count: 4, experience: "5+ yrs" },
    { title: "Crane Operator", count: 6, experience: "5+ yrs" },
    { title: "Heavy Equipment Operator", count: 8, experience: "3+ yrs" },
    { title: "Painter — Industrial", count: 10 },
    { title: "Store Keeper", count: 3, experience: "2+ yrs" },
  ],
  benefits: [
    { label: "Tax-free salary + overtime" },
    { label: "Free food, accommodation & transport" },
  ],
  interview: [
    { date: "21st & 22nd July", location: "Mumbai" },
    { date: "24th July", location: "Delhi" },
    { date: "26th July", location: "Chennai" },
  ],
  contact: { phone: "9876543210", email: "recruit@gulfstaffing.example.com" },
  footer: "All candidates must hold valid trade certificates and passport",
  agencyName: "Gulf Staffing Solutions",
  raLicenseId: "5432",
  fullRegistrationNumber: "RC-C2198/DEL/PART/1000+/5432/2023",
});
