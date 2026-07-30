import sharp from "sharp";
import { getEnv } from "@/lib/env";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getTextGenerationProvider } from "@/server/ai/text";
import type { AdvertisementFacts } from "../pipeline/types";

/**
 * KAI Creative V2 — EXPERIMENT, not a product path.
 *
 * The production pipeline (src/server/generation/pipeline/) treats the
 * image model as a background plate and typesets every fact itself. This
 * path does the opposite: the model composes the entire advertisement,
 * text included, and KAI only checks afterwards whether the facts
 * survived.
 *
 * That inversion is precisely what the Factual Integrity Law (docs/010
 * Amendment 1) forbids, so nothing here is imported by a route, a
 * service, or the production pipeline. It exists to answer one question
 * with evidence instead of opinion: does letting the model design the
 * whole advertisement produce something better than the template, and at
 * what cost to factual accuracy?
 *
 * Gated by ENABLE_CREATIVE_V2. Off by default.
 */

export class CreativeV2DisabledError extends Error {
  constructor() {
    super("Creative V2 is experimental and disabled. Set ENABLE_CREATIVE_V2=true to run it.");
    this.name = "CreativeV2DisabledError";
  }
}

export interface CreativeV2Input {
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
  /** Composited bottom-right after generation, never drawn by the model. */
  qrPng?: Buffer | null;
}

export interface CreativeV2Result {
  imagePng: Buffer;
  prompt: string;
  usage: { model: string; latencyMs: number };
  /** What KAI could and could not confirm in the model's own output. */
  validation: FactValidation;
}

export interface FactValidation {
  /** Facts KAI expected to find rendered in the advertisement. */
  expected: string[];
  /** Of those, the ones the vision read-back did not find. */
  missing: string[];
  /** Text the model rendered that KAI cannot trace to a verified fact. */
  unverified: string[];
  /** Raw text the vision model read back, kept for inspection. */
  readBack: string;
}

/**
 * One prompt, the whole advertisement. The production brief tells the
 * model to render no text at all; this tells it to render everything and
 * own the composition — which is the only way to find out whether the
 * template or the model is the thing limiting quality.
 */
export function buildCompositionPrompt(facts: AdvertisementFacts): string {
  const positions = facts.positions
    .map((p) => {
      const bits = [p.title];
      if (p.count != null) bits.push(`${p.count} vacancies`);
      if (p.salary) bits.push(p.salary);
      if (p.experience) bits.push(p.experience);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");

  const benefits = facts.benefits.map((b) => (b.detail ? `${b.label}: ${b.detail}` : b.label)).join(", ");
  const contact = [facts.contact.phone, facts.contact.whatsapp, facts.contact.email]
    .filter(Boolean)
    .join("  ");

  return [
    "Design a complete, premium overseas-recruitment advertisement for social media (Instagram, LinkedIn, WhatsApp).",
    "You own the entire composition: layout, typography, hierarchy, colour, artwork and spacing. Make it look like",
    "the work of a senior agency art director, not a template. It must be immediately readable on a phone.",
    "",
    "Render ALL of the following text accurately and legibly, with nothing omitted, misspelled or invented:",
    "",
    `HEADLINE: ${facts.header}`,
    `AGENCY: ${facts.agencyName}`,
    `DESTINATION: ${facts.country}`,
    `INDUSTRY: ${facts.industry}`,
    facts.employer ? `EMPLOYER: ${facts.employer}` : "",
    "",
    "POSITIONS:",
    positions,
    benefits ? `\nBENEFITS: ${benefits}` : "",
    contact ? `\nCONTACT: ${contact}` : "",
    facts.fullRegistrationNumber ? `\nREGISTRATION: ${facts.fullRegistrationNumber}` : "",
    "",
    "Reserve a clean, uncluttered square in the bottom-right corner roughly 15% of the width for a verification",
    "QR code that will be placed afterwards. Do not draw a QR code yourself.",
    "",
    "Do not invent salaries, vacancy counts, dates, benefits or any detail not listed above.",
    "Photographic or illustrated artwork is welcome. No flags, no national symbols, no stock handshakes.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Reads the generated advertisement back with the vision model and checks
 * the verified facts against what was actually rendered.
 *
 * This is the honest cost of the inversion: in the production pipeline
 * factual accuracy is structural and needs no check, because the renderer
 * draws the facts. Here it can only ever be measured after the fact, and
 * a miss means the advertisement is wrong rather than merely ugly.
 */
export async function validateRenderedFacts(
  imagePng: Buffer,
  facts: AdvertisementFacts,
): Promise<FactValidation> {
  const expected = [
    facts.header,
    facts.agencyName,
    facts.country,
    ...facts.positions.map((p) => p.title),
    ...facts.positions.flatMap((p) => (p.salary ? [p.salary] : [])),
    ...(facts.contact.phone ? [facts.contact.phone] : []),
    ...(facts.contact.email ? [facts.contact.email] : []),
  ];

  const provider = getTextGenerationProvider();
  const { text: readBack } = await provider.generateText({
    instructions:
      "Transcribe every piece of text visible in this advertisement image, exactly as rendered, one item per " +
      "line. Do not correct spelling, do not summarise, do not add anything that is not visibly printed.",
    input: `data:image/png;base64,${imagePng.toString("base64")}`,
  });

  const haystack = readBack.toLowerCase();
  const missing = expected.filter((fact) => !haystack.includes(fact.toLowerCase().trim()));

  // Lines the model printed that match no verified fact — the fabrication
  // surface this architecture opens up.
  const known = expected.map((e) => e.toLowerCase());
  const unverified = readBack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3)
    .filter((l) => !known.some((k) => k.includes(l.toLowerCase()) || l.toLowerCase().includes(k)));

  return { expected, missing, unverified, readBack };
}

/** Composites the KAI verification QR into the corner the prompt reserved. */
async function placeVerificationQr(imagePng: Buffer, qrPng: Buffer, widthPx: number, heightPx: number) {
  const size = Math.round(widthPx * 0.14);
  const pad = Math.round(widthPx * 0.03);
  const qr = await sharp(qrPng).resize(size, size, { fit: "inside" }).png().toBuffer();
  return sharp(imagePng)
    .composite([{ input: qr, left: widthPx - size - pad, top: heightPx - size - pad }])
    .png()
    .toBuffer();
}

export async function generateCreativeV2(input: CreativeV2Input): Promise<CreativeV2Result> {
  if (getEnv().ENABLE_CREATIVE_V2 !== "true") throw new CreativeV2DisabledError();

  const prompt = buildCompositionPrompt(input.facts);
  const provider = getImageGenerationProvider();

  const startedAt = Date.now();
  const { output, usage } = await provider.generate({
    prompt,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });
  const latencyMs = Date.now() - startedAt;

  let imagePng = await sharp(Buffer.from(output.imageBase64, "base64"))
    .resize(input.widthPx, input.heightPx, { fit: "cover" })
    .png()
    .toBuffer();

  if (input.qrPng) {
    imagePng = await placeVerificationQr(imagePng, input.qrPng, input.widthPx, input.heightPx);
  }

  const validation = await validateRenderedFacts(imagePng, input.facts);

  return { imagePng, prompt, usage: { model: usage.model, latencyMs }, validation };
}
