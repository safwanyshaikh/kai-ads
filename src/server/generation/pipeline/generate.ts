import { buildCreativeBrief } from "./creative-brief";
import { applyBrandingOverlay } from "./branding-overlay";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "./types";

export interface GeneratePipelineInput {
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
  style?: string;
  theme?: string;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  footerText?: string | null;
}

export interface GeneratePipelineResult {
  imagePng: Buffer;
  brief: string;
  usage: { model: string; latencyMs: number; estimatedCostUsd: number | null };
}

/**
 * The one production advertisement pipeline. Every caller — the UI's
 * generate route and the batch/benchmark/certification scripts — must go
 * through this exact function. No archetypes, no acceptance loop, no
 * feature flag choosing a different engine:
 *
 *   Requirement Intelligence (caller-supplied AdvertisementFacts)
 *   -> Creative Brief (one text call)
 *   -> GPT Image (one image call)
 *   -> Minimal Branding Overlay (logo + QR + footer)
 *   -> Return Advertisement
 */
export async function generateAdvertisement(input: GeneratePipelineInput): Promise<GeneratePipelineResult> {
  const brief = await buildCreativeBrief(input.facts, { style: input.style, theme: input.theme });

  const provider = getImageGenerationProvider();
  const { output, usage } = await provider.generate({
    prompt: brief,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });
  const imagePng = Buffer.from(output.imageBase64, "base64");

  const finalPng = await applyBrandingOverlay({
    imagePng,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    agencyLogoPng: input.agencyLogoPng,
    qrPng: input.qrPng,
    footerText: input.footerText,
  });

  return { imagePng: finalPng, brief, usage };
}
