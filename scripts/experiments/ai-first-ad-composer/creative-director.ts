/**
 * AI Creative Director — isolated experiment.
 *
 * Branch: experiment/ai-first-ad-composer. Sits between the raw recruiter
 * message and Gemini Image, producing two objects only:
 *
 *   Raw Recruiter Message -> AI Creative Director -> Creative Blueprint
 *                                                  -> Master Image Prompt
 *                                                  -> (Gemini Image, not run here)
 *
 * No renderer, no layout coordinates, no cards, no QR, no footer, no
 * production imports, no image generation. Uses the Gemini text model
 * directly (@google/genai) — same isolation as the rest of this
 * experiment. This is a superset/successor of creative-planner.ts: same
 * "design decisions only" discipline, plus a single natural-language
 * Master Image Prompt derived from the blueprint.
 *
 * Usage:
 *   GEMINI_TEXT_API_KEY=... npx tsx scripts/experiments/ai-first-ad-composer/creative-director.ts <outFile>
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

/** Object 1 — visual thinking only. No factual duplication. */
export interface CreativeBlueprint {
  campaignTheme: string;
  creativeAngle: string;
  visualStory: string;
  heroScene: string;
  background: string;
  lighting: string;
  cameraStyle: string;
  composition: string;
  headlineStrategy: string;
  informationHierarchy: string[];
  colourPalette: string;
  typographyPersonality: string;
  graphicLanguage: string;
  iconStrategy: string;
  visualBalance: string;
  whitespaceStrategy: string;
  humanPresence: string;
  industrialElements: string;
  mood: string;
  trustSignals: string[];
  socialPlatform: string[];
  candidatePsychology: string;
  negativeConstraints: string[];
}

/** Object 2 — a single natural-language prompt derived from the blueprint above. */
export interface CreativeDirectorOutput {
  blueprint: CreativeBlueprint;
  masterImagePrompt: string;
}

const BLUEPRINT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    campaignTheme: { type: Type.STRING },
    creativeAngle: { type: Type.STRING },
    visualStory: { type: Type.STRING },
    heroScene: { type: Type.STRING },
    background: { type: Type.STRING },
    lighting: { type: Type.STRING },
    cameraStyle: { type: Type.STRING },
    composition: { type: Type.STRING },
    headlineStrategy: { type: Type.STRING },
    informationHierarchy: { type: Type.ARRAY, items: { type: Type.STRING } },
    colourPalette: { type: Type.STRING },
    typographyPersonality: { type: Type.STRING },
    graphicLanguage: { type: Type.STRING },
    iconStrategy: { type: Type.STRING },
    visualBalance: { type: Type.STRING },
    whitespaceStrategy: { type: Type.STRING },
    humanPresence: { type: Type.STRING },
    industrialElements: { type: Type.STRING },
    mood: { type: Type.STRING },
    trustSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
    socialPlatform: { type: Type.ARRAY, items: { type: Type.STRING } },
    candidatePsychology: { type: Type.STRING },
    negativeConstraints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "campaignTheme", "creativeAngle", "visualStory", "heroScene", "background", "lighting",
    "cameraStyle", "composition", "headlineStrategy", "informationHierarchy", "colourPalette",
    "typographyPersonality", "graphicLanguage", "iconStrategy", "visualBalance",
    "whitespaceStrategy", "humanPresence", "industrialElements", "mood", "trustSignals",
    "socialPlatform", "candidatePsychology", "negativeConstraints",
  ],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    blueprint: BLUEPRINT_SCHEMA,
    masterImagePrompt: { type: Type.STRING },
  },
  required: ["blueprint", "masterImagePrompt"],
};

function buildPrompt(rawText: string): string {
  return [
    "You are the Creative Director for a recruitment advertising agency. You sit between a recruiter's raw",
    "WhatsApp message and an image-generation model. You produce exactly two things:",
    "",
    "OBJECT 1 — a Creative Blueprint: visual thinking only (theme, angle, story, scene, background, lighting,",
    "camera, composition, hierarchy, colour, typography, icons, balance, whitespace, human presence,",
    "industrial elements, mood, trust signals, platform, candidate psychology, negative constraints). Every",
    "field is a DESIGN decision — never a repetition of the raw recruiter facts (job titles, phone numbers,",
    "email, requirements) themselves.",
    "",
    "OBJECT 2 — a Master Image Prompt: convert the blueprint into ONE production-quality prompt for an image",
    "generation model. Describe the complete advertisement naturally, as if briefing a world-class advertising",
    "agency's art director. Do not reference coordinates, templates, cards, or a renderer — describe the",
    "scene, composition, typography, hierarchy and mood in prose. The prompt must contain everything needed",
    "to generate the image, and should maximize readability, hierarchy, typography, realism, recruiter",
    "attention, candidate response and social-media performance.",
    "",
    "Ground every decision in this frozen reference (Creative Direction v1), from a 30-concept experiment",
    "validated against live agency advertisements. Follow its strongest patterns and respect its stated",
    "exclusions unless the raw message clearly calls for something else:",
    "",
    CREATIVE_DIRECTION_V1,
    "",
    "Do not invent facts (salary, vacancy counts, dates) not present in the message. The Master Image Prompt",
    "should instruct the image model to render the actual job titles, requirements and contact details",
    "accurately as part of the advertisement design — but every field in the Blueprint itself must remain a",
    "design decision, not a fact restated.",
    "",
    "RAW RECRUITER MESSAGE:",
    "",
    rawText,
  ].join("\n");
}

export async function directCreative(rawText: string): Promise<CreativeDirectorOutput> {
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
  if (!text) throw new Error("Creative Director returned no content.");
  return JSON.parse(text) as CreativeDirectorOutput;
}

async function main() {
  const outFile = process.argv[2] ?? "creative-director-output.json";
  const output = await directCreative(RAW_INPUT);
  await writeFile(outFile, JSON.stringify(output, null, 2));
  console.log(`Creative Director output -> ${outFile}`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
