/**
 * AI-First Ad Composer — isolated experiment.
 *
 * Branch: experiment/ai-first-ad-composer. Not merged into production, not
 * imported by anything in src/server/generation/pipeline or
 * src/server/generation/experimental. This script talks to the Gemini
 * Image API directly with nothing in between: no renderer, no template,
 * no AdvertisementFacts, no layout JSON, no positioning logic. The raw
 * recruiter text goes in; the model decides layout, typography,
 * hierarchy, spacing, colour, background, icons and composition entirely
 * on its own.
 *
 * Usage:
 *   GEMINI_IMAGE_API_KEY=... npx tsx scripts/experiments/ai-first-ad-composer/generate.ts <outDir>
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";

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

interface PromptStyle {
  name: string;
  file: string;
  instructions: string;
}

const STYLES: PromptStyle[] = [
  {
    name: "Minimal Corporate",
    file: "ai-first-v1.png",
    instructions:
      "Design a minimal, corporate recruitment advertisement for the Gulf overseas-hiring market. " +
      "Restrained palette (navy, white, one muted accent), generous whitespace, clean sans-serif " +
      "typography, understated iconography if any. Businesslike, trustworthy, no visual flourish.",
  },
  {
    name: "Premium Recruitment",
    file: "ai-first-v2.png",
    instructions:
      "Design a premium, high-end recruitment advertisement for the Gulf overseas-hiring market — the kind a " +
      "top-tier international agency would commission from a senior art director. Rich but tasteful colour, " +
      "confident typographic hierarchy, a strong photographic or illustrated focal point, refined spacing. " +
      "It should feel expensive and credible, never gaudy.",
  },
  {
    name: "Modern Gulf Hiring Campaign",
    file: "ai-first-v3.png",
    instructions:
      "Design a modern, energetic recruitment campaign advertisement aimed at Gulf/GCC blue-collar and " +
      "technical hiring, styled for Instagram, Facebook, LinkedIn and WhatsApp. Bold contemporary layout, " +
      "dynamic composition, strong colour blocking, large confident headline typography, a sense of momentum " +
      "and opportunity.",
  },
];

function buildPrompt(style: PromptStyle): string {
  return [
    "You are designing a complete recruitment advertisement image for social media. You have full creative",
    "freedom over layout, typography, hierarchy, spacing, colour, background, icons and overall visual",
    "composition — decide all of it yourself. Do not use a template or a fixed grid convention; compose this",
    "advertisement uniquely.",
    "",
    style.instructions,
    "",
    "Render every piece of the following recruiter message as legible, accurate text somewhere in the",
    "advertisement. Do not omit, invent, reorder, or misspell any detail. Group and typeset the information",
    "however you judge reads best — you decide the structure, not a predefined format:",
    "",
    RAW_INPUT,
    "",
    "The result must be immediately readable on a phone screen and suitable for LinkedIn, Facebook, Instagram",
    "and WhatsApp.",
  ].join("\n");
}

async function main() {
  const outDir = process.argv[2] ?? ".";
  const apiKey = process.env.GEMINI_IMAGE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_IMAGE_API_KEY is required.");
  }
  const model = process.env.KAI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
  const client = new GoogleGenAI({ apiKey });

  for (const style of STYLES) {
    const prompt = buildPrompt(style);
    const startedAt = Date.now();
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "3:4" },
      },
    });
    const latencyMs = Date.now() - startedAt;

    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      console.error(`${style.name}: FAILED — no image data returned`);
      continue;
    }

    const path = `${outDir}/${style.file}`;
    await writeFile(path, Buffer.from(imagePart.inlineData.data, "base64"));
    console.log(`${style.name} -> ${path}  (${model}, ${latencyMs}ms)`);
  }
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
