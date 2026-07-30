/**
 * AI Creative Planner — isolated experiment.
 *
 * Branch: experiment/ai-first-ad-composer. No renderer, no layout
 * coordinates, no HTML/CSS, no image generation, no imports from
 * src/server/generation or any other production code. Uses the Gemini
 * text model directly (@google/genai), the same isolation as the other
 * scripts in this experiment.
 *
 * Input:  raw recruiter WhatsApp text, exactly as sent.
 * Output: a Creative Blueprint — design decisions only, no facts
 *         repeated verbatim, no coordinates. This is planning input for
 *         a future AI image generation stage, not the advertisement
 *         itself and not anything the production pipeline reads.
 *
 * Usage:
 *   GEMINI_TEXT_API_KEY=... npx tsx scripts/experiments/ai-first-ad-composer/creative-planner.ts <outFile>
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI, Type } from "@google/genai";
import { CREATIVE_DIRECTION_V1 } from "./creative-direction-v1";

const RAW_INPUT = `Plant Maintenance Saudi Arabia
Instrument Technician
Electrical Technician
Mechanical Technician
Rotating Equipment Technician
Analyzer Technician
Bolt Technician
Torch Technician

Minimum 5 years Oil & Gas Maintenance.
Diploma / Degree preferred.
Exceptional candidates may be considered.
Send CV to jobs@alyousufent.com
WhatsApp +91 8655960415`;

/** The 25 sections, in the required order. Values are design decisions only. */
export interface CreativeBlueprint {
  campaignType: string;
  visualStory: string;
  heroScene: string;
  backgroundStyle: string;
  headlineStrategy: string;
  hookLine: string;
  visualHierarchy: string[];
  sectionOrder: string[];
  informationGrouping: string;
  positionPresentationStyle: string;
  requirementsPresentationStyle: string;
  ctaStrategy: string;
  contactPresentation: string;
  typographyStyle: string;
  colourPalette: string;
  accentStyle: string;
  iconStrategy: string;
  humanPresence: string;
  industrialElements: string;
  whiteSpaceStrategy: string;
  socialMediaTarget: string[];
  candidatePsychology: string;
  trustElements: string[];
  visualMood: string;
  negativeConstraints: string[];
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    campaignType: { type: Type.STRING },
    visualStory: { type: Type.STRING },
    heroScene: { type: Type.STRING },
    backgroundStyle: { type: Type.STRING },
    headlineStrategy: { type: Type.STRING },
    hookLine: { type: Type.STRING },
    visualHierarchy: { type: Type.ARRAY, items: { type: Type.STRING } },
    sectionOrder: { type: Type.ARRAY, items: { type: Type.STRING } },
    informationGrouping: { type: Type.STRING },
    positionPresentationStyle: { type: Type.STRING },
    requirementsPresentationStyle: { type: Type.STRING },
    ctaStrategy: { type: Type.STRING },
    contactPresentation: { type: Type.STRING },
    typographyStyle: { type: Type.STRING },
    colourPalette: { type: Type.STRING },
    accentStyle: { type: Type.STRING },
    iconStrategy: { type: Type.STRING },
    humanPresence: { type: Type.STRING },
    industrialElements: { type: Type.STRING },
    whiteSpaceStrategy: { type: Type.STRING },
    socialMediaTarget: { type: Type.ARRAY, items: { type: Type.STRING } },
    candidatePsychology: { type: Type.STRING },
    trustElements: { type: Type.ARRAY, items: { type: Type.STRING } },
    visualMood: { type: Type.STRING },
    negativeConstraints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "campaignType", "visualStory", "heroScene", "backgroundStyle", "headlineStrategy",
    "hookLine", "visualHierarchy", "sectionOrder", "informationGrouping",
    "positionPresentationStyle", "requirementsPresentationStyle", "ctaStrategy",
    "contactPresentation", "typographyStyle", "colourPalette", "accentStyle",
    "iconStrategy", "humanPresence", "industrialElements", "whiteSpaceStrategy",
    "socialMediaTarget", "candidatePsychology", "trustElements", "visualMood",
    "negativeConstraints",
  ],
};

function buildPrompt(rawText: string): string {
  return [
    "You are a creative director planning a recruitment advertisement. You do not design pixels, coordinates,",
    "HTML, or CSS — you decide the CREATIVE DIRECTION that a downstream image-generation stage will follow.",
    "",
    "Infer every decision below from the raw recruiter message. Do not invent facts (salary, vacancy counts,",
    "dates) that are not present in the message — but every field you output must be a DESIGN decision",
    "(story, mood, style, strategy), never a repetition of the raw facts themselves.",
    "",
    "Ground every decision in this frozen reference (Creative Direction v1), derived from a 30-concept",
    "experiment and validated against live agency advertisements. Follow its strongest patterns and respect",
    "its stated exclusions unless the raw message clearly calls for something else:",
    "",
    CREATIVE_DIRECTION_V1,
    "",
    "Produce exactly the 25 fields of the schema. Each value should be a short, concrete design decision —",
    "not a vague adjective, not a repetition of the input text.",
    "",
    "RAW RECRUITER MESSAGE:",
    "",
    rawText,
  ].join("\n");
}

export async function planCreative(rawText: string): Promise<CreativeBlueprint> {
  const apiKey = process.env.GEMINI_TEXT_API_KEY;
  if (!apiKey) throw new Error("GEMINI_TEXT_API_KEY is required.");
  const model = process.env.KAI_TEXT_MODEL ?? "gemini-3.5-flash-lite";
  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model,
    contents: buildPrompt(rawText),
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Creative Planner returned no content.");
  return JSON.parse(text) as CreativeBlueprint;
}

async function main() {
  const outFile = process.argv[2] ?? "creative-blueprint.json";
  const blueprint = await planCreative(RAW_INPUT);
  await writeFile(outFile, JSON.stringify(blueprint, null, 2));
  console.log(`Creative Blueprint -> ${outFile}`);
  console.log(JSON.stringify(blueprint, null, 2));
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
