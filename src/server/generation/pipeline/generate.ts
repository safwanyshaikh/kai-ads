import { buildCreativeBrief } from "./creative-brief";
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
  addressLine?: string | null;

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

  footerSelection: Awaited<
    ReturnType<typeof selectFooterStyle>
  >;
}

/**
 * KAI ADS — ONE PRODUCTION PIPELINE
 *
 * Requirement Intelligence
 *      ↓
 * Creative Brief
 *      ↓
 * Gemini Image
 *      ↓
 * ONE KAI Rendering Engine
 *      ↓
 * Finished Advertisement
 *
 * GEMINI:
 *   Owns the advertisement's visual design,
 *   composition, imagery, typography concept,
 *   hierarchy, colour, CTA treatment and
 *   commercial appearance.
 *
 * KAI:
 *   Supplies grounded recruitment intelligence
 *   and deterministically renders precision-critical
 *   recruitment facts / verification.
 *
 * There is NO separate fact-layer composer here.
 */
export async function generateAdvertisement(
  input: GeneratePipelineInput,
): Promise<GeneratePipelineResult> {
  /**
   * STEP 1
   *
   * KAI understands the requirement and produces
   * the creative direction.
   */
  const brief =
    await buildCreativeBrief(
      input.facts,
      {
        style: input.style,
        theme: input.theme,
      },
    );

  /**
   * STEP 2
   *
   * Gemini creates the complete primary advertisement.
   *
   * No pre-cropping.
   * No reserved hero area.
   * No template canvas.
   * No fact panel is created before Gemini.
   */
  const provider =
    getImageGenerationProvider();

  const {
    output,
    usage,
  } =
    await provider.generate({
      prompt: brief,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      quality:
        getEnv()
          .KAI_IMAGE_QUALITY,
    });

  const aiArtworkPng =
    Buffer.from(
      output.imageBase64,
      "base64",
    );

  /**
   * STEP 3
   *
   * Normalise only the physical image dimensions
   * required by the selected platform format.
   *
   * The original Gemini composition remains intact
   * as much as possible.
   */
  const normalizedArtwork =
    await sharp(
      aiArtworkPng,
    )
      .resize(
        input.widthPx,
        input.heightPx,
        {
          fit: "cover",
          position: "attention",
        },
      )
      .png()
      .toBuffer();

  /**
   * STEP 4
   *
   * One and only one deterministic Rendering Engine.
   *
   * It receives the FULL AdvertisementFacts object.
   *
   * It is responsible only for precision-critical
   * recruitment information and verification.
   */
  const footerSelection =
    await selectFooterStyle(
      normalizedArtwork,
      input.footerStyle,
    );

  const finalPng =
    await applyBrandingOverlay({
      imagePng:
        normalizedArtwork,

      widthPx:
        input.widthPx,

      heightPx:
        input.heightPx,

      facts:
        input.facts,

      agencyLogoPng:
        input.agencyLogoPng,

      qrPng:
        input.qrPng,

      agencyName:
        input.agencyName,

      registrationNumber:
        input.registrationNumber,

      contactLine:
        input.contactLine,

      addressLine:
        input.addressLine,

      footerStyle:
        footerSelection.style,

      brandBadges:
        input.brandBadges,
    });

  return {
    imagePng:
      finalPng,

    brief,

    usage,

    footerSelection,
  };
}
