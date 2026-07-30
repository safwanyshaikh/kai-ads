import { buildCreativeBrief } from "./creative-brief";
import { renderFactLayer } from "./fact-layer";
import { selectFooterStyle } from "./footer-selection";
import type { FooterStyle } from "./footer-styles";
import { applyBrandingOverlay } from "./branding-overlay";
import { getImageGenerationProvider } from "@/server/ai/image";
import sharp from "sharp";
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
  agencyName?: string | null;
  registrationNumber?: string | null;
  contactLine?: string | null;
  /** Agency address/website line for the branding band. */
  addressLine?: string | null;
  /** Agency's saved footer preference; when absent KAI selects one. */
  footerStyle?: FooterStyle | null;
  brandBadges?: string[] | null;
}

export interface GeneratePipelineResult {
  imagePng: Buffer;
  brief: string;
  usage: { model: string; latencyMs: number; estimatedCostUsd: number | null };
  /** Which footer was used and why — surfaced to the recruiter and analytics. */
  footerSelection: Awaited<ReturnType<typeof selectFooterStyle>>;
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
  const backgroundPng = Buffer.from(output.imageBase64, "base64");

  // Factual Integrity Law (docs/010 Amendment 1): the model supplies
  // artwork only. Every verified fact is typeset deterministically here,
  // over the artwork and beneath the branding band.
  // The canvas may grow taller than requested so that a large requirement
  // stays legible — text is never shrunk below KDL's floor to force a fit.
  const factLayer = await renderFactLayer({
    facts: input.facts,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  });
  const canvasHeight = factLayer.heightPx;
  const imagePng = await sharp(backgroundPng)
    .resize(input.widthPx, canvasHeight, { fit: "cover" })
    .composite([{ input: factLayer.png, left: 0, top: 0 }])
    .png()
    .toBuffer();

  // Branding compatibility only: this reads the artwork to choose a
  // footer and never modifies it.
  const footerSelection = await selectFooterStyle(imagePng, input.footerStyle);

  const finalPng = await applyBrandingOverlay({
    imagePng,
    widthPx: input.widthPx,
    heightPx: canvasHeight,
    agencyLogoPng: input.agencyLogoPng,
    qrPng: input.qrPng,
    agencyName: input.agencyName,
    registrationNumber: input.registrationNumber,
    contactLine: input.contactLine,
    addressLine: input.addressLine,
    footerStyle: footerSelection.style,
    brandBadges: input.brandBadges,
    artworkHeightPx: factLayer.artworkHeightPx,
  });

  return { imagePng: finalPng, brief, usage, footerSelection };
}
