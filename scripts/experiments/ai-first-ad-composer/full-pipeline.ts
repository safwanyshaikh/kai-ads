/**
 * AI Creative Director — full pipeline run — isolated experiment.
 *
 * Branch: experiment/ai-first-ad-composer.
 *
 *   Raw Recruiter Message
 *     -> Creative Director        (creative-director.ts, unchanged)
 *     -> Creative Blueprint + Master Image Prompt
 *     -> AI Prompt Optimizer       (new: mode-specific refinement pass)
 *     -> Final Gemini Prompt
 *     -> Gemini Image API          (@google/genai directly)
 *
 * No renderer, no templates, no production code, no AdvertisementFacts,
 * no deterministic layout — the same isolation as every other script in
 * this experiment.
 *
 * Usage:
 *   GEMINI_TEXT_API_KEY=... GEMINI_IMAGE_API_KEY=... \
 *     npx tsx scripts/experiments/ai-first-ad-composer/full-pipeline.ts <outDir>
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { directCreative, type CreativeDirectorOutput } from "./creative-director";

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

interface Run {
  file: string;
  /** null = no extra optimization mode, just the Creative Director's own Master Image Prompt. */
  mode: string | null;
}

const RUNS: Run[] = [
  { file: "ai-director-v1.png", mode: null },
  { file: "ai-director-v2.png", mode: "Premium Corporate" },
  { file: "ai-director-v3.png", mode: "Premium Industrial" },
  { file: "ai-director-v4.png", mode: "Premium Social Media" },
];

/**
 * AI Prompt Optimizer — takes the Creative Director's Master Image Prompt
 * and, when a mode is given, refines it toward that specific optimization
 * direction (still no coordinates/templates/cards/renderer references).
 * With no mode, the Master Image Prompt is used as the Final Gemini Prompt
 * unchanged.
 */
async function optimizePrompt(textClient: GoogleGenAI, textModel: string, masterPrompt: string, mode: string | null): Promise<string> {
  if (!mode) return masterPrompt;

  const instructions = [
    "You are an AI Prompt Optimizer refining an image-generation prompt for a recruitment advertisement.",
    `Optimization mode: ${mode}.`,
    "",
    "Rewrite the prompt below to push harder in that specific direction while keeping every factual detail",
    "(job titles, requirements, email, phone number) intact and accurate. Do not add coordinates, templates,",
    "cards, or renderer references. Output only the rewritten prompt, nothing else.",
    "",
    "PROMPT TO OPTIMIZE:",
    "",
    masterPrompt,
  ].join("\n");

  const response = await textClient.models.generateContent({
    model: textModel,
    contents: instructions,
  });
  return response.text?.trim() || masterPrompt;
}

async function generateImage(imageClient: GoogleGenAI, imageModel: string, prompt: string): Promise<Buffer> {
  const response = await imageClient.models.generateContent({
    model: imageModel,
    contents: prompt,
    config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4" } },
  });
  const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error("Gemini Image returned no image data.");
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function main() {
  const outDir = process.argv[2] ?? ".";
  const textKey = process.env.GEMINI_TEXT_API_KEY;
  const imageKey = process.env.GEMINI_IMAGE_API_KEY;
  if (!textKey) throw new Error("GEMINI_TEXT_API_KEY is required.");
  if (!imageKey) throw new Error("GEMINI_IMAGE_API_KEY is required.");
  const textModel = process.env.KAI_TEXT_MODEL ?? "gemini-3.5-flash-lite";
  const imageModel = process.env.KAI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";

  const textClient = new GoogleGenAI({ apiKey: textKey });
  const imageClient = new GoogleGenAI({ apiKey: imageKey });

  console.log("Creative Director -> Creative Blueprint + Master Image Prompt...");
  const director: CreativeDirectorOutput = await directCreative(RAW_INPUT);
  await writeFile(`${outDir}/creative-director-output.json`, JSON.stringify(director, null, 2));

  for (const run of RUNS) {
    const finalPrompt = await optimizePrompt(textClient, textModel, director.masterImagePrompt, run.mode);
    await writeFile(`${outDir}/${run.file.replace(".png", "-prompt.txt")}`, finalPrompt);

    const startedAt = Date.now();
    const png = await generateImage(imageClient, imageModel, finalPrompt);
    await writeFile(`${outDir}/${run.file}`, png);
    console.log(`${run.mode ?? "Baseline"} -> ${outDir}/${run.file}  (${Date.now() - startedAt}ms)`);
  }
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
