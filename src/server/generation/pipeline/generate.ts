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
 * KAI ADS — PRODUCTION CREATIVE PIPELINE
 *
 * Requirement Intelligence
 *      ↓
 * Complete Creative Brief
 *      ↓
 * Gemini Creative Director
 *      ↓
 * Preserve Gemini composition
 *      ↓
 * KAI Minimal Branding / Verification
 *      ↓
 * Finished Advertisement
 *
 * GEMINI:
 * Owns the advertisement's creative visual concept.
 *
 * KAI:
 * Owns recruitment intelligence, exact agency identity
 * and verification.
 */
export async function generateAdvertisement(
  input: GeneratePipelineInput,
): Promise<GeneratePipelineResult> {
  /**
   * STEP 1
   *
   * KAI understands the COMPLETE requirement.
   */
  const brief =
    await buildCreativeBrief(
      input.facts,
      {
        style:
          input.style,
        theme:
          input.theme,
      },
    );

  /**
   * STEP 2
   *
   * Gemini creates the actual recruitment campaign visual.
   */
  const provider =
    getImageGenerationProvider();

  const {
    output,
    usage,
  } =
    await provider.generate({
      prompt:
        brief,

      widthPx:
        input.widthPx,

      heightPx:
        input.heightPx,

      quality:
        getEnv()
          .KAI_IMAGE_QUALITY,
    });

  const aiArtwork =
    Buffer.from(
      output.imageBase64,
      "base64",
    );

  /**
   * STEP 3
   *
   * Preserve Gemini's complete composition.
   *
   * IMPORTANT:
   *
   * Gemini's image model may support 3:4 while the
   * publication format may be 4:5.
   *
   * NEVER use "cover" here.
   *
   * "cover" crops the creative and can remove the
   * worker, machinery, subject or important visual
   * composition.
   *
   * Instead, fit the complete Gemini image inside
   * the requested publication canvas.
   *
   * Any unavoidable ratio difference is handled by
   * controlled canvas extension rather than destructive
   * cropping.
   */
  const normalizedArtwork =
    await fitWithoutCropping(
      aiArtwork,
      input.widthPx,
      input.heightPx,
    );

  /**
   * STEP 4
   *
   * Select only the visual treatment of the agency
   * trust footer.
   *
   * This does not alter the advertisement body.
   */
  const footerSelection =
    await selectFooterStyle(
      normalizedArtwork,
      input.footerStyle,
    );

  /**
   * STEP 5
   *
   * KAI adds ONLY:
   *
   * - exact agency logo
   * - exact registration
   * - exact contact identity
   * - exact QR
   *
   * No job table.
   * No vacancy grid.
   * No document panel.
   * No recruitment-body reconstruction.
   */
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

/**
 * Preserve the entire Gemini composition.
 *
 * The image is fitted INSIDE the target canvas.
 *
 * No "cover" crop.
 *
 * For a small aspect-ratio mismatch, the canvas is extended
 * using pixels derived from the edge of the Gemini image.
 *
 * This gives us:
 *
 * Gemini composition
 *       ↓
 * complete image preserved
 *       ↓
 * publication dimensions
 *
 * rather than:
 *
 * Gemini composition
 *       ↓
 * crop
 *       ↓
 * lost subject
 */
async function fitWithoutCropping(
  image: Buffer,
  widthPx: number,
  heightPx: number,
): Promise<Buffer> {
  const metadata =
    await sharp(
      image,
    ).metadata();

  const sourceWidth =
    metadata.width ??
    widthPx;

  const sourceHeight =
    metadata.height ??
    heightPx;

  /**
   * Calculate the scale that fits the complete
   * Gemini image inside the target canvas.
   */
  const scale =
    Math.min(
      widthPx /
        sourceWidth,

      heightPx /
        sourceHeight,
    );

  const fittedWidth =
    Math.max(
      1,
      Math.round(
        sourceWidth *
          scale,
      ),
    );

  const fittedHeight =
    Math.max(
      1,
      Math.round(
        sourceHeight *
          scale,
      ),
    );

  /**
   * If Gemini already matches the target ratio,
   * simply resize to the requested dimensions.
   */
  if (
    fittedWidth ===
      widthPx &&
    fittedHeight ===
      heightPx
  ) {
    return sharp(
      image,
    )
      .resize(
        widthPx,
        heightPx,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();
  }

  /**
   * Resize the complete Gemini image first.
   */
  const fitted =
    await sharp(
      image,
    )
      .resize(
        fittedWidth,
        fittedHeight,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();

  /**
   * Extract a representative edge colour from the
   * fitted image.
   *
   * This prevents a harsh white/black artificial frame.
   */
  const {
    data,
    info,
  } =
    await sharp(
      fitted,
    )
      .resize(
        1,
        1,
        {
          fit: "cover",
        },
      )
      .removeAlpha()
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  const r =
    data[0] ?? 20;

  const g =
    data[1] ?? 20;

  const b =
    data[2] ?? 20;

  /**
   * The extension is deliberately subtle.
   *
   * It exists only because the image model ratio and
   * publication ratio differ.
   */
  return sharp({
    create: {
      width:
        widthPx,

      height:
        heightPx,

      channels: 3,

      background: {
        r,
        g,
        b,
      },
    },
  })
    .composite([
      {
        input:
          fitted,

        left:
          Math.round(
            (widthPx -
              fittedWidth) /
              2,
          ),

        top:
          Math.round(
            (heightPx -
              fittedHeight) /
              2,
          ),
      },
    ])
    .png()
    .toBuffer();
}
