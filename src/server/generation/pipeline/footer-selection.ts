import sharp from "sharp";
import { DEFAULT_FOOTER_STYLE, type FooterStyle } from "./footer-styles";

/**
 * Automatic footer selection.
 *
 * Looks at the strip of artwork immediately above where the branding band
 * will sit and picks the agency footer that sits most comfortably beneath
 * it. This is a branding-compatibility decision only: it reads the image,
 * never writes to it, and the advertisement above the strip is untouched.
 *
 * The agency's own saved preference always wins — this only chooses when
 * no preference is set.
 */
export interface FooterSelection {
  style: FooterStyle;
  /** Why this style was chosen, for the recruiter and for analytics. */
  reason: string;
  /** True when the agency's saved preference decided it. */
  fromAgencyPreference: boolean;
  metrics: { brightness: number; saturation: number };
}

/**
 * Samples the band above the branding strip rather than the whole canvas:
 * a dark hero with a pale body would otherwise average out to a reading
 * that describes neither.
 */
async function sampleRegion(imagePng: Buffer): Promise<{ brightness: number; saturation: number }> {
  const meta = await sharp(imagePng).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  // The 20% of canvas directly above the strip, which the footer abuts.
  const bandTop = Math.max(0, Math.round(height * 0.62));
  const bandHeight = Math.max(1, Math.round(height * 0.18));

  const { data, info } = await sharp(imagePng)
    .extract({ left: 0, top: bandTop, width, height: Math.min(bandHeight, height - bandTop) })
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let totalLuma = 0;
  let totalSat = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    // Rec. 709 luma — perceptual, not a naive channel average.
    totalLuma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    totalSat += max === 0 ? 0 : (max - min) / max;
  }

  return { brightness: totalLuma / pixels, saturation: totalSat / pixels };
}

export async function selectFooterStyle(
  imagePng: Buffer,
  agencyPreference?: FooterStyle | null,
): Promise<FooterSelection> {
  const metrics = await sampleRegion(imagePng).catch(() => ({ brightness: 0.5, saturation: 0.3 }));

  if (agencyPreference) {
    return {
      style: agencyPreference,
      reason: "The agency has saved a preferred footer style.",
      fromAgencyPreference: true,
      metrics,
    };
  }

  const { brightness, saturation } = metrics;

  // Dark artwork sits naturally on a dark footer; a cream band under a
  // near-black photograph reads as a separate document stapled on.
  if (brightness < 0.28) {
    return {
      style: "INDUSTRIAL_PREMIUM",
      reason: "The artwork above the footer is dark, so a dark industrial footer carries through.",
      fromAgencyPreference: false,
      metrics,
    };
  }

  // Busy, colourful artwork needs the quietest footer available.
  if (saturation > 0.45) {
    return {
      style: "MODERN_MINIMAL",
      reason: "The artwork is strongly coloured, so the quietest footer keeps the trust strip readable.",
      fromAgencyPreference: false,
      metrics,
    };
  }

  // Very light artwork gains definition from a ruled, print-style footer.
  if (brightness > 0.78) {
    return {
      style: "TRADITIONAL_DTP",
      reason: "The artwork is very light, so a ruled print-style footer gives the strip definition.",
      fromAgencyPreference: false,
      metrics,
    };
  }

  if (brightness > 0.6) {
    return {
      style: "AI_PREMIUM",
      reason: "The artwork is bright and calm, which suits the gold-on-navy premium footer.",
      fromAgencyPreference: false,
      metrics,
    };
  }

  return {
    style: DEFAULT_FOOTER_STYLE,
    reason: "Balanced artwork — the classic corporate footer is the safe default.",
    fromAgencyPreference: false,
    metrics,
  };
}
