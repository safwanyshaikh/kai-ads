/**
 * Prompt Critic — isolated experiment.
 *
 * Branch: experiment/ai-first-ad-composer. Adds one new stage to the
 * existing pipeline WITHOUT modifying full-pipeline.ts, creative-director.ts,
 * or the Prompt Optimizer logic inside full-pipeline.ts — this file only
 * reuses directCreative() (read-only import) and re-runs an equivalent
 * single-mode optimization pass locally, then critiques the result:
 *
 *   Raw Recruiter Message
 *     -> Creative Director        (creative-director.ts, unchanged)
 *     -> Creative Blueprint + Master Image Prompt
 *     -> Prompt Optimizer          (same approach as full-pipeline.ts, not edited there)
 *     -> Prompt Critic             (new: this file)
 *     -> Final Gemini Prompt
 *     -> Gemini Image API
 *
 * The problem being addressed: Gemini was behaving like a poster designer
 * (inventing layouts, fake logos, fake company names, decorative
 * typography, placeholder labels) instead of a recruitment marketing
 * designer. The Critic's only job is to reject and correct exactly those
 * failure modes — it does not touch composition, mood, or any other
 * creative decision the Director/Optimizer already made.
 *
 * No renderer, no templates, no production code, no AdvertisementFacts,
 * no deterministic layout, no image generation until the Critic approves.
 *
 * Usage:
 *   GEMINI_TEXT_API_KEY=... GEMINI_IMAGE_API_KEY=... \
 *     npx tsx scripts/experiments/ai-first-ad-composer/prompt-critic.ts <outDir>
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI, Type } from "@google/genai";
import { directCreative } from "./creative-director";

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

export interface PromptCriticResult {
  issuesFound: string[];
  corrections: string[];
  approvedPrompt: string;
}

const CRITIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    issuesFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    corrections: { type: Type.ARRAY, items: { type: Type.STRING } },
    approvedPrompt: { type: Type.STRING },
  },
  required: ["issuesFound", "corrections", "approvedPrompt"],
};

/** Same single-mode approach used in full-pipeline.ts's optimizePrompt(), not extracted or edited there. */
async function optimizePrompt(client: GoogleGenAI, model: string, masterPrompt: string): Promise<string> {
  const instructions = [
    "You are an AI Prompt Optimizer refining an image-generation prompt for a recruitment advertisement.",
    "Rewrite the prompt below to strengthen readability, hierarchy, typography and realism while keeping",
    "every factual detail (job titles, requirements, email, phone number) intact and accurate. Do not add",
    "coordinates, templates, cards, or renderer references. Output only the rewritten prompt, nothing else.",
    "",
    "PROMPT TO OPTIMIZE:",
    "",
    masterPrompt,
  ].join("\n");
  const response = await client.models.generateContent({ model, contents: instructions });
  return response.text?.trim() || masterPrompt;
}

/**
 * The Prompt Critic. Rejects anything that would push Gemini toward
 * behaving like a poster designer — invented layouts, fake logos, fake
 * company names, decorative typography, unnecessary design elements,
 * placeholder text, invented icons — and strengthens exactly the 15
 * recruitment-marketing objectives given, nothing else.
 */
export async function critiquePrompt(client: GoogleGenAI, model: string, candidatePrompt: string): Promise<PromptCriticResult> {
  const instructions = [
    "You are the Prompt Critic in a recruitment-advertisement generation pipeline. You review an image-",
    "generation prompt that a previous stage produced, and you output ONLY:",
    '{ "issuesFound": [...], "corrections": [...], "approvedPrompt": "..." }',
    "",
    "REJECT and flag as an issue anything in the candidate prompt that would encourage the image model to:",
    "- invent its own layout instead of following the specified hierarchy",
    "- fabricate a logo or company mark",
    "- fabricate a company name not present in the source facts",
    "- fabricate a badge, certification mark, or trust seal",
    "- use decorative or stylized typography that reduces legibility",
    "- add unnecessary design elements not serving readability or trust",
    "- include placeholder text (\"Lorem ipsum\", \"Company Name Here\", \"XXX-XXX-XXXX\", etc.)",
    "- invent icons that don't correspond to something real in the message",
    "",
    "STRENGTHEN, and only, these 15 objectives:",
    "1. Every word must be readable.",
    "2. Typography is more important than artwork.",
    "3. This must read as a real recruitment advertisement, not a poster or artwork piece.",
    "4. It must look designed by a professional Gulf recruitment agency.",
    "5. Mobile-first readability — legible on a phone screen at a glance.",
    "6. WhatsApp forward friendly — clear when compressed and re-shared.",
    "7. LinkedIn post quality.",
    "8. Facebook feed quality.",
    "9. No hallucinated text of any kind.",
    "10. No fake logos.",
    "11. No fake company names.",
    "12. No decorative text.",
    "13. No placeholder labels.",
    "14. No invented icons.",
    "15. Every recruiter fact (job titles, requirements, email, phone number) must be preserved exactly,",
    "    with nothing added, dropped, or reworded.",
    "",
    "Produce the corrected, approved prompt as `approvedPrompt` — rewritten as needed to satisfy every",
    "objective above and remove every issue found. If the candidate prompt already fully satisfies every",
    "objective, `issuesFound` and `corrections` may be empty arrays and `approvedPrompt` may equal the",
    "candidate prompt unchanged.",
    "",
    "CANDIDATE PROMPT:",
    "",
    candidatePrompt,
  ].join("\n");

  const response = await client.models.generateContent({
    model,
    contents: instructions,
    config: { responseMimeType: "application/json", responseSchema: CRITIC_SCHEMA },
  });
  const text = response.text;
  if (!text) throw new Error("Prompt Critic returned no content.");
  return JSON.parse(text) as PromptCriticResult;
}

async function generateImage(client: GoogleGenAI, model: string, prompt: string): Promise<Buffer> {
  const response = await client.models.generateContent({
    model,
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

  console.log("Creative Director...");
  const director = await directCreative(RAW_INPUT);

  console.log("Prompt Optimizer...");
  const optimized = await optimizePrompt(textClient, textModel, director.masterImagePrompt);

  console.log("Prompt Critic...");
  const critique = await critiquePrompt(textClient, textModel, optimized);
  await writeFile(`${outDir}/prompt-critic-v1-critique.json`, JSON.stringify(critique, null, 2));
  console.log(JSON.stringify(critique, null, 2));

  console.log("Gemini Image API (approved prompt only)...");
  const png = await generateImage(imageClient, imageModel, critique.approvedPrompt);
  await writeFile(`${outDir}/prompt-critic-v1.png`, png);
  console.log(`prompt-critic-v1.png -> ${outDir}/prompt-critic-v1.png`);
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
