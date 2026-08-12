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
  footerSelection: Awaited<ReturnType<typeof selectFooterStyle>>;
}

/**
 * KAI FINAL GENERATION PIPELINE
 *
 * Separation of responsibilities:
 *
 *   REQUIREMENT INTELLIGENCE
 *       ↓
 *   CREATIVE BRIEF
 *       ↓
 *   LLM / GPT IMAGE
 *       ↓
 *   FULL CREATIVE ARTWORK
 *       ↓
 *   KAI FACT LAYER
 *       ↓
 *   MINIMAL BRANDING / VERIFICATION
 *       ↓
 *   FINAL ADVERTISEMENT
 *
 * The image model is the creative artist.
 *
 * KAI does NOT redesign the image.
 * KAI does NOT replace the image with a poster template.
 * KAI only guarantees precision-critical recruitment information.
 */
export async function generateAdvertisement(
  input: GeneratePipelineInput,
): Promise<GeneratePipelineResult> {
  /**
   * STEP A — Creative intelligence.
   *
   * This brief contains visual/commercial direction only.
   * Recruitment facts remain grounded in `facts`.
   */
  const brief = await buildCreativeBrief(input.facts, {
    style: input.style,
    theme: input.theme,
  });

  /**
   * STEP B — Generate the primary creative artwork.
   *
   * This is now the dominant visual asset.
   */
  const provider = getImageGenerationProvider();

  const { output, usage } = await provider.generate({
    prompt: brief,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });

  const aiArtworkPng = Buffer.from(
    output.imageBase64,
    "base64",
  );

  /**
   * STEP C — Build the deterministic fact layer.
   *
   * The Fact Layer decides only how much vertical room verified
   * information needs. It does not own the creative artwork.
   */
  const factLayer = await renderFactLayer({
    facts: input.facts,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  });

  const finalHeight = factLayer.heightPx;
  const artworkHeight = factLayer.artworkHeightPx;

  /**
   * STEP D — Place the AI artwork across the complete creative region.
   *
   * This is fundamentally different from the old pipeline.
   *
   * OLD:
   *   AI image → small hero region → deterministic poster dominates
   *
   * NEW:
   *   AI image → complete creative canvas → factual layer occupies
   *              only its necessary precision zone
   *
   * The image occupies every pixel above the factual overlay boundary.
   */
  const creativeArtworkPng = await sharp(aiArtworkPng)
    .resize(input.widthPx, artworkHeight, {
      fit: "cover",
      position: "attention",
    })
    .png()
    .toBuffer();

  /**
   * STEP E — Compose AI creativity + KAI facts.
   *
   * Fact layer already contains its own controlled factual panel.
   * Its upper region is transparent, so the LLM artwork remains visible.
   */
  const canvas = await sharp({
    create: {
      width: input.widthPx,
      height: finalHeight,
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
        input: creativeArtworkPng,
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

  /**
   * STEP F — Branding / verification.
   *
   * Branding is deliberately applied AFTER the creative/fact composition.
   * It cannot influence the image model and cannot compete with the
   * creative direction.
   */
  const footerSelection = await selectFooterStyle(
    canvas,
    input.footerStyle,
  );

  const finalPng = await applyBrandingOverlay({
    imagePng: canvas,
    widthPx: input.widthPx,
    heightPx: finalHeight,
    agencyLogoPng: input.agencyLogoPng,
    qrPng: input.qrPng,
    agencyName: input.agencyName,
    registrationNumber: input.registrationNumber,
    contactLine: input.contactLine,
    addressLine: input.addressLine,
    footerStyle: footerSelection.style,
    brandBadges: input.brandBadges,
    artworkHeightPx: artworkHeight,
  });

  return {
    imagePng: finalPng,
    brief,
    usage,
    footerSelection,
  };
}
