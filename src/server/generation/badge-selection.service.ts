import type { AdvertisementStyle } from "@prisma/client";
import type { DensityLevel } from "./density-classification.service";
import type { PlatformFormat } from "@/lib/platform-formats";

type BadgeShape = "circular" | "rounded_square" | "compact_rectangle";
type BadgeSize = "compact" | "standard" | "large";

export interface BadgeConfig {
  shape: BadgeShape;
  size: BadgeSize;
}

/**
 * "KAI selects the appropriate badge design and size according to:
 * Advertisement dimensions, density, number of positions, available
 * whitespace, style, platform format. Do not make the recruiter
 * manually design the badge."
 *
 * Whitespace is approximated from density (HIGH density = little
 * whitespace left for a badge) rather than measured from an actual
 * rendered layout, since this decision happens before rendering and
 * feeds the renderer, not the other way around.
 */
export function selectBadgeConfig(params: {
  style: AdvertisementStyle;
  density: DensityLevel;
  positionCount: number;
  platformFormat: PlatformFormat;
}): BadgeConfig {
  const isNarrow = params.platformFormat.aspectRatio === "9:16";
  const isSquareish = params.platformFormat.widthPx === params.platformFormat.heightPx;

  // Newspaper/DTP is dense by definition — the badge must stay out of the way.
  if (params.style === "NEWSPAPER" || params.density === "HIGH") {
    return { shape: "compact_rectangle", size: "compact" };
  }

  // A single critical requirement (low density, few positions) has the
  // most spare whitespace — the badge can afford to be more prominent.
  if (params.density === "LOW" && params.positionCount <= 1) {
    return { shape: isSquareish ? "circular" : "rounded_square", size: "standard" };
  }

  if (isNarrow) {
    // Tall/narrow formats (Stories, Status) have less horizontal room.
    return { shape: "rounded_square", size: "standard" };
  }

  return { shape: "rounded_square", size: params.density === "MEDIUM" ? "standard" : "large" };
}
