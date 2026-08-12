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
  usage: {
    model: string;
    latencyMs: number;
    estimatedCostUsd: number | null;
  };
  /** Which footer was used and why — surfaced to the recruiter and analytics. */
  footerSelection: Awaited<ReturnType<typeof selectFooterStyle>>;
}

/**
 * The one production advertisement pipeline.
 *
 * Pipeline:
 *
 *   Requirement Intelligence
 *   -> Creative Brief
 *   -> AI Background Artwork
 *   -> Deterministic Fact Layer
 *   -> Minimal Branding Overlay
 *   -> Final Advertisement
 *
 * Important:
 * The AI background belongs ONLY inside the calculated artwork/hero region.
 * It must never be resized against the entire final poster height.
 *
 * Gemini currently produces landscape artwork at its supported aspect ratio.
 * Resizing that artwork directly to the full final canvas with `fit: cover`
 * crops the hero subject because the final canvas contains the factual body
 * and branding strip below it.
 */
export async function generateAdvertisement(
  input: GeneratePipelineInput,
): Promise<GeneratePipelineResult> {
  const brief = await buildCreativeBrief(input.facts, {
    style: input.style,
    theme: input.theme,
  });

  const provider = getImageGenerationProvider();

  const { output, usage } = await provider.generate({
    prompt: brief,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });

  const backgroundPng = Buffer.from(output.imageBase64, "base64");

  // Plan the complete factual canvas first.
  //
  // This gives us:
  // - heightPx: complete final advertisement height
  // - artworkHeightPx: exact hero/artwork region
  // - png: deterministic factual layer + surfaces
  const factLayer = await renderFactLayer({
    facts: input.facts,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  });

  const canvasHeight = factLayer.heightPx;
  const artworkHeight = factLayer.artworkHeightPx;

  /**
   * CRITICAL IMAGE COMPOSITION FIX
   *
   * Do NOT resize the AI artwork to `canvasHeight`.
   *
   * `canvasHeight` includes the positions, contact information and branding
   * below the hero. Doing that previously forced the 4:3 AI image to cover
   * the entire poster and cropped the human subject out of the hero.
   *
   * Instead, resize the AI artwork ONLY to the actual hero region.
   *
   * `attention` asks sharp/libvips to preserve salient visual content when
   * cropping. This is materially safer for a worker/industrial focal subject
   * than blindly taking the geometric centre.
   */
  const heroArtworkPng = await sharp(backgroundPng)
    .resize(input.widthPx, artworkHeight, {
      fit: "cover",
      position: "attention",
    })
    .png()
    .toBuffer();

  /**
   * Build the complete canvas.
   *
   * The transparent canvas is intentional:
   * `factLayer.png` paints the deterministic hero scrim and the cream factual
   * body over it, so no duplicate background fill is introduced.
   */
  const composedPng = await sharp({
    create: {
      width: input.widthPx,
      height: canvasHeight,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: heroArtworkPng,
        left: 0,
        top: 0,
      },
      {
        input: factLayer.png,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  // Branding compatibility only:
  // reads the completed artwork to select the appropriate footer style.
  const footerSelection = await selectFooterStyle(
    composedPng,
    input.footerStyle,
  );

  const finalPng = await applyBrandingOverlay({
    imagePng: composedPng,
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

  return {
    imagePng: finalPng,
    brief,
    usage,
    footerSelection,
  };
}
