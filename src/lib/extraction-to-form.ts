import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";

/**
 * Sprint 006 Bug 004: AI Extraction Review always ran successfully on the
 * server (extractedData was correctly computed and persisted to the
 * draft), but the client never read the extraction result into the
 * review form's default values — `reviewedData` stayed at
 * EMPTY_ADVERTISEMENT_CONTENT regardless of extraction outcome, so the
 * Review screen always looked blank even after a fully successful,
 * fully-populated extraction.
 *
 * This is the missing mapping: ExtractionResult (the AI's structured
 * output) -> CreateAdvertisementInput (the review form's shape). Never
 * invents a value the extraction didn't provide — every field is either
 * the extracted value or left absent for the recruiter to fill in
 * manually, per the Truth Brain rule already enforced server-side by the
 * extraction schema itself (confidentField().value is null, never a
 * placeholder, when the source doesn't contain it).
 */
export function extractionResultToFormValues(
  extracted: ExtractionResult,
): Partial<CreateAdvertisementInput> {
  const employer = extracted.employer.value ?? undefined;
  const country = extracted.country.value ?? undefined;
  const industry = extracted.industry.value ?? undefined;

  const values: Partial<CreateAdvertisementInput> = {
    header: deriveHeader({ employer, country, industry, projectType: extracted.projectType.value }),
    industry: industry ?? "",
    country: country ?? "",
    employer: employer ?? "",
    interview: {
      date: extracted.interviewDate.value ?? undefined,
      location: extracted.interviewVenue.value ?? undefined,
      mode: extracted.interviewMode.value ?? undefined,
      events:
        extracted.interviewEvents.length > 0
          ? extracted.interviewEvents.map((event) => ({
              date: event.date ?? undefined,
              location: event.venue ?? undefined,
              mode: event.mode ?? undefined,
            }))
          : undefined,
    },
  };

  if (extracted.positions.length > 0) {
    values.positions = extracted.positions.map((position) => ({
      title: position.title,
      count: position.quantity.value ?? undefined,
      experience: position.experience.value ?? undefined,
      ageRange: position.ageLimit.value ?? undefined,
      qualifications: position.qualification.value ? [position.qualification.value] : undefined,
    }));
  }
  if (extracted.benefits.value) {
    values.benefits = extracted.benefits.value.map((label) => ({ label }));
  }
  if (extracted.contact.value) {
    values.contact = {
      name: extracted.contact.value.name ?? undefined,
      phone: extracted.contact.value.phone ?? undefined,
      email: extracted.contact.value.email ?? undefined,
      whatsapp: extracted.contact.value.whatsapp ?? undefined,
    };
  }

  return values;
}

/**
 * The extraction schema has no dedicated "header" field — a header is a
 * crafted headline, not a fact to extract. Composes a plain, factual
 * starting point from whatever grounded fields ARE present (never
 * fabricated), which the recruiter reviews and can rewrite like any
 * other field on this screen.
 */
function deriveHeader(params: {
  employer?: string;
  country?: string;
  industry?: string;
  projectType?: string | null;
}): string {
  const { employer, country, industry, projectType } = params;
  const subject = employer ?? projectType ?? industry;
  // Don't repeat the country when the subject already names it
  // (e.g. employer "Halliburton Saudi Arabia" must not become
  // "Halliburton Saudi Arabia — Saudi Arabia").
  const subjectNamesCountry =
    subject != null && country != null && subject.toLowerCase().includes(country.toLowerCase());
  if (subject && country && !subjectNamesCountry) return `${subject} — ${country}`;
  if (subject) return subject;
  if (country) return `Recruitment — ${country}`;
  return "";
}
