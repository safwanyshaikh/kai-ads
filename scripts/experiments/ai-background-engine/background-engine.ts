/**
 * AI Creative Background Engine — isolated experiment.
 *
 * Branch: experiment/ai-background-engine. Imports nothing from
 * src/server, no renderer, no production code.
 *
 * PURPOSE
 * Generate ONLY the creative visual foundation of a recruitment
 * advertisement. The image model owns artwork; it never owns a fact.
 *
 * GEMINI IS RESPONSIBLE FOR
 *   hero image, industrial scene, background, composition, colour
 *   palette, lighting, mood, visual hierarchy, empty text-safe zones,
 *   and decorative elements that never contain text.
 *
 * GEMINI MUST NEVER GENERATE
 *   company logo, company name, job titles, position list, salary,
 *   experience, qualification, email, phone, QR code, footer, watermark,
 *   icons representing positions, or any factual text whatsoever.
 *
 * OUTPUT
 *   PNG only. The artwork contains visually obvious but completely empty
 *   safe areas for: Header, Main Headline, Position List, Eligibility,
 *   CTA, Footer, QR.
 *
 * Usage:
 *   GEMINI_IMAGE_API_KEY=... [GEMINI_TEXT_API_KEY=... for --verify] \
 *     npx tsx scripts/experiments/ai-background-engine/background-engine.ts <outDir> [--verify]
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";

/**
 * The seven safe areas, top to bottom. These are descriptions of where
 * empty space must exist in the artwork — never coordinates handed to a
 * renderer, and never regions the image model fills with text.
 */
export interface SafeZone {
  name: string;
  /** Where it sits in the composition, in plain compositional language. */
  placement: string;
  /** How the artwork should make the zone visually obvious yet empty. */
  treatment: string;
}

export const SAFE_ZONES: SafeZone[] = [
  {
    name: "Header",
    placement: "a full-width band across the very top of the frame",
    treatment: "a clean flat panel of solid colour, completely empty",
  },
  {
    name: "Main Headline",
    placement: "the upper third, directly beneath the header band",
    treatment:
      "a calm, uncluttered area of soft gradient or gently blurred scenery with no busy detail and no focal point",
  },
  {
    name: "Position List",
    placement: "the large central region — the tallest zone in the composition",
    treatment:
      "a wide, quiet panel of near-solid tone, clearly the largest open space in the design, entirely empty",
  },
  {
    name: "Eligibility",
    placement: "a narrower band directly below the central region",
    treatment: "a subtly tinted horizontal strip, visibly distinct from the region above it, empty",
  },
  {
    name: "CTA",
    placement: "a prominent horizontal bar in the lower quarter",
    treatment:
      "a bold, high-contrast solid colour bar that reads as an action strip, containing absolutely nothing",
  },
  {
    name: "Footer",
    placement: "a full-width band across the very bottom edge",
    treatment: "a dark, flat, opaque strip, completely empty",
  },
  {
    name: "QR",
    placement: "a small square inset within the bottom-right of the footer band",
    treatment:
      "a plain light-coloured empty square with clean margins — a blank placeholder shape only, never an actual scannable pattern",
  },
];

export interface BackgroundStyle {
  name: string;
  file: string;
  direction: string;
}

export const STYLES: BackgroundStyle[] = [
  {
    name: "Premium Gulf Corporate",
    file: "background-v1.png",
    direction:
      "A modern Gulf business district at golden hour — contemporary glass towers, palms, clean architectural lines. " +
      "Deep navy and crisp white with a restrained emerald-green accent. Polished, corporate, trustworthy.",
  },
  {
    name: "Premium Industrial Energy",
    file: "background-v2.png",
    direction:
      "A modern petrochemical facility under bright desert daylight — brushed steel pipework, distillation towers, " +
      "clear sky. Deep industrial navy and slate with a single warm amber accent. Authoritative and technical.",
  },
  {
    name: "Premium Social Campaign",
    file: "background-v3.png",
    direction:
      "A bold, high-contrast campaign backdrop — a strong diagonal colour field over a softly defocused modern " +
      "worksite. Vivid but professional palette, generous flat colour areas, engineered to survive feed compression.",
  },
];

function buildPrompt(style: BackgroundStyle): string {
  // Zone NAMES and NUMBERS are deliberately withheld from the prompt.
  // Sending "1. Header ... 3. Position List" made the model render those
  // labels as visible text inside each panel — it read the spec as
  // content. Only the geometry and treatment are described, as prose.
  const zoneSpec = SAFE_ZONES.map((z) => `- ${z.placement}: ${z.treatment}.`).join("\n");

  return [
    "Create the BACKGROUND ARTWORK ONLY for a premium Gulf recruitment advertisement, in vertical portrait format,",
    "suitable for LinkedIn, Facebook, Instagram and WhatsApp.",
    "",
    "ABSOLUTE RULE — THIS IS THE MOST IMPORTANT INSTRUCTION:",
    "The image must contain NO TEXT OF ANY KIND. Not one letter, word, number, character, or glyph anywhere in the",
    "frame. No company logo. No company name. No job titles. No salary figures. No email address. No phone number.",
    "No QR code pattern. No watermark. No signage, no labels, no captions, no lettering on buildings, vehicles,",
    "equipment, uniforms, helmets, signs or screens. No icons representing job roles or professions. No decorative",
    "typography. No placeholder text. If any text appears anywhere in the image, the result is a failure.",
    "",
    `VISUAL DIRECTION — ${style.name}:`,
    style.direction,
    "",
    "COMPOSITION — the artwork must be built around seven visually obvious but COMPLETELY EMPTY areas, arranged",
    "top to bottom. Each must read clearly as a distinct reserved area while containing absolutely nothing inside",
    "it — no label, no number, no caption, no name, nothing:",
    "",
    zoneSpec,
    "",
    "Do not label, number, name, annotate or caption any of these areas. They are blank spaces, not diagram",
    "elements. This is finished advertising artwork, not a wireframe or a layout mockup.",
    "",
    "The photographic or illustrated scenery should occupy the areas between and behind these zones, framing them",
    "without intruding into them. Every zone must have clean, uninterrupted, high-contrast emptiness so that",
    "typography placed on top later would be perfectly legible.",
    "",
    "Photographic realism, editorial quality, professional colour grading, natural light. No flags, no national",
    "symbols, no stock-photo handshakes, no posed studio portraits. Premium advertising-agency craft throughout.",
  ].join("\n");
}

async function generate(client: GoogleGenAI, model: string, prompt: string): Promise<Buffer> {
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4" } },
  });
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini Image returned no image data.");
  return Buffer.from(part.inlineData.data, "base64");
}

/**
 * Reads the generated artwork back with the vision model to confirm the
 * no-text contract actually held. The whole purpose of this module is
 * that the image model never renders a fact, so "it should not have"
 * is not good enough — this checks.
 *
 * Passes the image as inline image data, not as a base64 string in the
 * text prompt (which blows the input token limit).
 */
export async function verifyNoText(
  client: GoogleGenAI,
  model: string,
  png: Buffer,
): Promise<{ clean: boolean; report: string }> {
  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: png.toString("base64") } },
          {
            text:
              "Look at this image. Is there ANY text, lettering, numbers, logo, or QR code pattern visible " +
              "anywhere in it? Answer with exactly 'CLEAN' if there is none at all. Otherwise answer 'TEXT FOUND: ' " +
              "followed by a short list of what you see and where.",
          },
        ],
      },
    ],
  });
  const report = response.text?.trim() ?? "(no response)";
  return { clean: /^CLEAN\b/i.test(report), report };
}

async function main() {
  const outDir = process.argv[2] ?? ".";
  const doVerify = process.argv.includes("--verify");

  const imageKey = process.env.GEMINI_IMAGE_API_KEY;
  if (!imageKey) throw new Error("GEMINI_IMAGE_API_KEY is required.");
  const imageModel = process.env.KAI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
  const imageClient = new GoogleGenAI({ apiKey: imageKey });

  const textKey = process.env.GEMINI_TEXT_API_KEY;
  const textModel = process.env.KAI_TEXT_MODEL ?? "gemini-3.5-flash-lite";
  const textClient = doVerify && textKey ? new GoogleGenAI({ apiKey: textKey }) : null;

  for (const style of STYLES) {
    const startedAt = Date.now();
    const png = await generate(imageClient, imageModel, buildPrompt(style));
    await writeFile(`${outDir}/${style.file}`, png);
    let suffix = "";
    if (textClient) {
      const { clean, report } = await verifyNoText(textClient, textModel, png);
      suffix = clean ? "  [no-text: CLEAN]" : `  [no-text: FAILED — ${report}]`;
    }
    console.log(`${style.name} -> ${outDir}/${style.file}  (${Date.now() - startedAt}ms)${suffix}`);
  }
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
