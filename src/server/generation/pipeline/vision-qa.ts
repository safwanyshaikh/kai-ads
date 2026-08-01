import { getTextGenerationProvider } from "@/server/ai/text";
import { AppError } from "@/lib/errors";
import type { AdvertisementDocument } from "./advertisement-document";
import type { AdvertisementFacts } from "./types";

/**
 * Gemini Vision QA — the final gate of the KAI Ads pipeline.
 *
 * Reads the finished advertisement back off its own pixels and checks
 * every verified fact actually appears. If anything is missing, the
 * advertisement is REJECTED. It is never auto-fixed: a silent correction
 * would mean shipping something the recruiter never wrote, which is the
 * exact failure the Factual Integrity Law exists to prevent.
 *
 * What this is really testing. The Rendering Engine typesets every fact
 * deterministically, so the facts are correct by construction — Vision QA
 * is not there to catch the renderer inventing text, which it cannot do.
 * It catches the things construction cannot guarantee: a fact clipped by
 * a layout edge case, two elements overlapping into illegibility, a value
 * pushed off-canvas, or text the image model smuggled into the artwork
 * despite being told not to render any. Those are rendering-integrity
 * failures, and they are invisible to every check upstream of the pixels.
 */

export type VisionQaCategory =
  | "header"
  | "agency"
  | "position"
  | "salary"
  | "benefit"
  | "contact"
  | "registration";

export interface VisionQaExpectation {
  category: VisionQaCategory;
  value: string;
}

export interface VisionQaResult {
  passed: boolean;
  /** How many verified facts were checked against the rendered pixels. */
  checked: number;
  /** Facts that could not be found in the advertisement. Empty when passed. */
  missing: VisionQaExpectation[];
  /** Verbatim transcription the vision model read back, kept for operators. */
  readBack: string;
  model: string;
  latencyMs: number;
}

/** Raised when the rendered advertisement does not contain every verified fact. */
export class VisionQaRejectedError extends AppError {
  readonly operatorDetail: string;
  constructor(readonly result: VisionQaResult) {
    super("KAI could not verify this advertisement. Please try generating it again.", 422, "VISION_QA_REJECTED");
    this.operatorDetail =
      `Vision QA rejected the advertisement: ${result.missing.length} of ${result.checked} verified ` +
      `facts were not found in the rendered output — ` +
      result.missing.map((m) => `${m.category}:"${m.value}"`).join(", ");
  }
}

/**
 * Normalisation for comparison only — never applied to what gets rendered.
 * A transcription is allowed to differ in case, spacing and punctuation
 * without that counting as a missing fact; it is not allowed to differ in
 * substance.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:|/()\-—–_[\]]/g, "")
    .trim();
}

/**
 * The facts that must be legible in the finished advertisement. Long prose
 * (disclaimers, qualification sentences) is deliberately excluded: it is
 * rendered at caption size and a vision transcription of it is unreliable
 * enough to produce false rejections, which would block real work.
 */
export function buildExpectations(facts: AdvertisementFacts): VisionQaExpectation[] {
  const out: VisionQaExpectation[] = [];
  const push = (category: VisionQaCategory, value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed && normalise(trimmed).length >= 3) out.push({ category, value: trimmed });
  };

  push("header", facts.header);
  push("agency", facts.agencyName);
  for (const position of facts.positions) {
    push("position", position.title);
    push("salary", position.salary);
  }
  for (const benefit of facts.benefits) push("benefit", benefit.label);
  push("contact", facts.contact.phone);
  push("contact", facts.contact.whatsapp);
  push("contact", facts.contact.email);
  push("registration", facts.raLicenseId);

  // De-duplicate: the same phone used for both call and WhatsApp is one
  // rendered string, and would otherwise be counted (and failed) twice.
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.category}:${normalise(e.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Expectations for an Advertisement JSON.
 *
 * The document knows things the facts alone do not: the agency's legal
 * name and licence come from the verified Agency DNA, not from whatever
 * was typed into the advertisement. Verifying against the document means
 * verifying against the same source the renderer drew from, so a mismatch
 * is genuinely a rendering-integrity failure rather than a disagreement
 * between two copies of the truth.
 */
export function buildDocumentExpectations(document: AdvertisementDocument): VisionQaExpectation[] {
  const out = buildExpectations(document.facts);
  const push = (category: VisionQaCategory, value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed && normalise(trimmed).length >= 3) out.push({ category, value: trimmed });
  };

  push("agency", document.agency.name);
  push("registration", document.agency.compactRegistrationId);
  push("contact", document.agency.contact.phone);
  push("contact", document.agency.contact.whatsapp);
  push("contact", document.agency.contact.email);

  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.category}:${normalise(e.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface VisionQaInput {
  imagePng: Buffer;
  facts: AdvertisementFacts;
  /** When supplied, the document's own identity is verified too. */
  document?: AdvertisementDocument | null;
}

export async function runVisionQa(input: VisionQaInput): Promise<VisionQaResult> {
  const expectations = input.document
    ? buildDocumentExpectations(input.document)
    : buildExpectations(input.facts);
  const provider = getTextGenerationProvider();
  const startedAt = Date.now();

  const { text: readBack, usage } = await provider.generateText({
    instructions:
      "You are a proofreader performing quality assurance on a finished recruitment advertisement. " +
      "Transcribe every piece of text visible in the image, exactly as rendered, one item per line. " +
      "Do not correct spelling. Do not summarise. Do not infer or add anything that is not visibly " +
      "printed. If text is clipped or partially obscured, transcribe only what is actually legible.",
    input: "Transcribe all visible text in this advertisement.",
    imagePng: input.imagePng,
  });

  const haystack = normalise(readBack);
  const missing = expectations.filter((e) => !haystack.includes(normalise(e.value)));

  return {
    passed: missing.length === 0,
    checked: expectations.length,
    missing,
    readBack,
    model: usage.model,
    latencyMs: Date.now() - startedAt,
  };
}
