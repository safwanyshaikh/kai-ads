/**
 * KAI Advertisement Composer — fact extraction.
 *
 * Branch: experiment/kai-advertisement-composer. Imports nothing from
 * src/, no renderer, no production code.
 *
 * The AI is used here for ONE thing only: parsing unstructured recruiter
 * text into structured fields. It is never allowed to rewrite, embellish,
 * summarise or invent a fact. Every extracted string is then checked back
 * against the raw message, and anything that cannot be traced to the
 * source is refused — never rendered.
 */
import { GoogleGenAI, Type } from "@google/genai";

export interface Position {
  title: string;
  qualification?: string;
  experience?: string;
  salary?: string;
  nationality?: string;
}

export interface RecruiterFacts {
  campaignTitle: string;
  country?: string;
  industry?: string;
  agencyName?: string;
  positions: Position[];
  benefits: string[];
  notes: string[];
  subjectLineInstruction?: string;
  email?: string;
  mobile?: string;
  whatsapp?: string;
  website?: string;
  registration?: string;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    campaignTitle: { type: Type.STRING },
    country: { type: Type.STRING },
    industry: { type: Type.STRING },
    agencyName: { type: Type.STRING },
    positions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          qualification: { type: Type.STRING },
          experience: { type: Type.STRING },
          salary: { type: Type.STRING },
          nationality: { type: Type.STRING },
        },
        required: ["title"],
      },
    },
    benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
    notes: { type: Type.ARRAY, items: { type: Type.STRING } },
    subjectLineInstruction: { type: Type.STRING },
    email: { type: Type.STRING },
    mobile: { type: Type.STRING },
    whatsapp: { type: Type.STRING },
    website: { type: Type.STRING },
    registration: { type: Type.STRING },
  },
  required: ["campaignTitle", "positions", "benefits", "notes"],
};

/** Aggressive normalisation so "Min. 5 yrs" still matches "Min 5 yrs" in the source. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .replace(/[.,;:|/()\-—–]/g, "")
    .trim();
}

/**
 * Source-grounding check. A value survives only if it can be found in the
 * raw recruiter message. This is what makes "no hallucination" a property
 * of the system rather than a hope about the model.
 */
function isGrounded(value: string | undefined, haystack: string): boolean {
  if (!value) return false;
  const needle = normalise(value);
  if (needle.length === 0) return false;
  return haystack.includes(needle);
}

export interface ExtractionResult {
  facts: RecruiterFacts;
  /** Values the model produced that could NOT be traced to the source; dropped, never rendered. */
  ungrounded: string[];
}

export async function extractFacts(
  client: GoogleGenAI,
  model: string,
  rawMessage: string,
): Promise<ExtractionResult> {
  const response = await client.models.generateContent({
    model,
    contents: [
      "Parse this recruiter message into structured fields. You are a PARSER, not a writer.",
      "",
      "Rules:",
      "- Copy values VERBATIM from the message. Do not rephrase, expand, correct, summarise or standardise.",
      "- Do not invent any value that is not literally present.",
      "- Leave a field out entirely if the message does not state it.",
      "- `campaignTitle` must be the headline/role-family the message is about, taken from its own words.",
      "- Each position keeps its own qualification / experience / salary / nationality exactly as written.",
      "- `notes` are mandatory conditions stated in the message (e.g. required prior experience).",
      "- `benefits` are only things the message actually offers.",
      "",
      "RECRUITER MESSAGE:",
      "",
      rawMessage,
    ].join("\n"),
    config: { responseMimeType: "application/json", responseSchema: SCHEMA },
  });

  const text = response.text;
  if (!text) throw new Error("Fact extraction returned no content.");
  const parsed = JSON.parse(text) as RecruiterFacts;

  const haystack = normalise(rawMessage);
  const ungrounded: string[] = [];

  const keep = (value: string | undefined, label: string): string | undefined => {
    if (value === undefined || value.trim() === "") return undefined;
    if (isGrounded(value, haystack)) return value;
    ungrounded.push(`${label}: "${value}"`);
    return undefined;
  };

  const facts: RecruiterFacts = {
    // The campaign title is the one field allowed to be a header drawn from
    // the message's own opening words; still grounded-checked below.
    campaignTitle: keep(parsed.campaignTitle, "campaignTitle") ?? parsed.campaignTitle,
    country: keep(parsed.country, "country"),
    industry: keep(parsed.industry, "industry"),
    agencyName: keep(parsed.agencyName, "agencyName"),
    positions: parsed.positions.flatMap((p, i): Position[] => {
      const title = keep(p.title, `position[${i}].title`);
      if (!title) return [];
      return [
        {
          title,
          qualification: keep(p.qualification, `position[${i}].qualification`),
          experience: keep(p.experience, `position[${i}].experience`),
          salary: keep(p.salary, `position[${i}].salary`),
          nationality: keep(p.nationality, `position[${i}].nationality`),
        },
      ];
    }),
    benefits: (parsed.benefits ?? []).filter((b, i) => Boolean(keep(b, `benefit[${i}]`))),
    notes: (parsed.notes ?? []).filter((n, i) => Boolean(keep(n, `note[${i}]`))),
    subjectLineInstruction: keep(parsed.subjectLineInstruction, "subjectLineInstruction"),
    email: keep(parsed.email, "email"),
    mobile: keep(parsed.mobile, "mobile"),
    whatsapp: keep(parsed.whatsapp, "whatsapp"),
    website: keep(parsed.website, "website"),
    registration: keep(parsed.registration, "registration"),
  };

  return { facts, ungrounded };
}
