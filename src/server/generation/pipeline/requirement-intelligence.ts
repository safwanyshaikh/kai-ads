import { normalizeInterviewEvents } from "../interview-events";
import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { applyDestinationCurrency } from "./currency";
import type { AdvertisementFacts } from "./types";

interface AdvertisementRecord {
  header: string;
  industry: string;
  country: string;
  employer: string | null;
  positions: unknown;
  benefits: unknown;
  interview: unknown;
  contact: unknown;
  footer: string | null;
}

interface AgencyRecord {
  name: string;
  registrationNumber: string;
}

/**
 * Requirement Intelligence: turns the raw Advertisement/Agency records into
 * the grounded `AdvertisementFacts` payload every later stage treats as the
 * complete truth. Every field here traces back to the extracted database
 * record (KAI Extraction Engine's enforceSourceGrounding) — nothing is
 * invented here, only assembled and currency-corrected.
 */
export function buildAdvertisementFacts(
  advertisement: AdvertisementRecord,
  agency: AgencyRecord,
): AdvertisementFacts {
  const positions = advertisement.positions as unknown as {
    title: string;
    count?: number;
    experience?: string;
    salary?: string | null;
  }[];
  const benefits = advertisement.benefits as unknown as { label: string; detail?: string }[];
  // Decision 3: interview is a schemaless Json column — normalizeInterviewEvents
  // reads either the legacy single {date, location} shape or the current
  // {events: [...]} shape, so existing advertisements need no migration.
  const interview = normalizeInterviewEvents(advertisement.interview);
  const contact = advertisement.contact as unknown as {
    name?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  };

  // A bare figure with no currency (e.g. "5K to 7K Basic") must show the
  // destination's real currency (Truth Brain: Saudi Arabia pay is SAR,
  // never left unlabeled and never guessed by the image model) — applied
  // here, before facts leave Requirement Intelligence, so the fact itself
  // is already correct.
  const currencyCorrectedPositions = positions.map((p) =>
    p.salary ? { ...p, salary: applyDestinationCurrency(p.salary, advertisement.country) } : p,
  );
  const currencyCorrectedBenefits = benefits.map((b) =>
    b.detail ? { ...b, detail: applyDestinationCurrency(b.detail, advertisement.country) } : b,
  );

  return {
    header: advertisement.header,
    industry: advertisement.industry,
    country: advertisement.country,
    employer: advertisement.employer,
    positions: currencyCorrectedPositions,
    benefits: currencyCorrectedBenefits,
    interview,
    contact,
    footer: advertisement.footer,
    agencyName: agency.name,
    raLicenseId: deriveCompactRegistrationNumber(agency.registrationNumber),
    fullRegistrationNumber: agency.registrationNumber,
  };
}
