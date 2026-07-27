import { buildCreativeBrief } from "./creative-brief";
import { applyBrandingOverlay } from "./branding-overlay";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";

export interface GenerateAdvertisementV2Input {
  recruiterText: string;
  widthPx?: number;
  heightPx?: number;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
  footerText?: string | null;
}

/**
 * KAI Ads V2 — the entire generation flow, three steps:
 *   1. Requirement -> Creative Brief (one text call)
 *   2. Creative Brief -> GPT Image (one image call)
 *   3. Optional branding overlay (logo + small QR + small footer)
 * No archetypes, no engines, no acceptance loop, no retries.
 */
export async function generateAdvertisementV2(input: GenerateAdvertisementV2Input): Promise<Buffer> {
  const widthPx = input.widthPx ?? 1024;
  const heightPx = input.heightPx ?? 1536;

  const brief = await buildCreativeBrief(input.recruiterText);

  const provider = getImageGenerationProvider();
  const { output } = await provider.generate({
    prompt: brief,
    widthPx,
    heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });
  const imagePng = Buffer.from(output.imageBase64, "base64");

  return applyBrandingOverlay({
    imagePng,
    widthPx,
    heightPx,
    agencyLogoPng: input.agencyLogoPng,
    qrPng: input.qrPng,
    footerText: input.footerText,
  });
}
