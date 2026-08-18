/**
 * Platform Formats — Sprint 004.
 *
 * "Centralize aspect ratios and dimensions. Do not hardcode dimensions
 * across UI components. Architecture must support adding future
 * platforms without rewriting the generation engine."
 *
 * Every consumer (density/type recommendation, section rendering, badge
 * sizing, the UI's format picker) reads from this registry — none of
 * them hardcode a width/height. Adding a platform is adding one entry
 * here.
 */

/**
 * Social Format Law (LOCKED, 2026-08): every social output belongs to
 * exactly one family, and only SOCIAL_FEED carries a hard growth
 * ceiling.
 *
 * - SOCIAL_FEED: canonical 1080x1350 (4:5), hard ceiling 1080x1440
 *   (3:4). A dense requirement must never grow this past the ceiling —
 *   see socialFeedMaxHeightPx below and LayoutCapacityError's
 *   "social-feed-exceeds-max-height" reason in fact-layer.ts. It is
 *   never solved by switching to Story dimensions or unbounded growth.
 * - SOCIAL_STORY: a separate, fixed-shape family (1080x1920). Never
 *   used as a Feed overflow format.
 * - SOCIAL_OTHER: formats this law doesn't constrain (e.g. a landscape
 *   asset) — unaffected, keeps the pipeline's existing generic growth
 *   bound.
 */
export type PlatformFormatFamily = "SOCIAL_FEED" | "SOCIAL_STORY" | "SOCIAL_OTHER";

export interface PlatformFormat {
  key: string;
  label: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: string; // human-readable, e.g. "9:16"
  family: PlatformFormatFamily;
}

export const PLATFORM_FORMATS: Record<string, PlatformFormat> = {
  whatsapp_status: {
    key: "whatsapp_status",
    label: "WhatsApp Status",
    widthPx: 1080,
    heightPx: 1920,
    aspectRatio: "9:16",
    family: "SOCIAL_STORY",
  },
  instagram_post: {
    key: "instagram_post",
    label: "Instagram Post",
    widthPx: 1080,
    heightPx: 1080,
    aspectRatio: "1:1",
    family: "SOCIAL_FEED",
  },
  instagram_story: {
    key: "instagram_story",
    label: "Instagram Story",
    widthPx: 1080,
    heightPx: 1920,
    aspectRatio: "9:16",
    family: "SOCIAL_STORY",
  },
  facebook_post: {
    key: "facebook_post",
    label: "Facebook Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
    family: "SOCIAL_FEED",
  },
  linkedin_post: {
    key: "linkedin_post",
    label: "LinkedIn Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
    family: "SOCIAL_FEED",
  },
  youtube_community: {
    key: "youtube_community",
    label: "YouTube Community Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
    family: "SOCIAL_FEED",
  },
  generic_square: {
    key: "generic_square",
    label: "Generic Square",
    widthPx: 1080,
    heightPx: 1080,
    aspectRatio: "1:1",
    family: "SOCIAL_FEED",
  },
  generic_portrait: {
    key: "generic_portrait",
    label: "Generic Portrait",
    widthPx: 1080,
    heightPx: 1350,
    aspectRatio: "4:5",
    family: "SOCIAL_FEED",
  },
  generic_landscape: {
    key: "generic_landscape",
    label: "Generic Landscape",
    widthPx: 1600,
    heightPx: 900,
    aspectRatio: "16:9",
    family: "SOCIAL_OTHER",
  },
};

/** The canonical KAI Ads social recruitment format — 1080x1350, 4:5. */
export const SOCIAL_FEED_PRIMARY = { widthPx: 1080, heightPx: 1350 } as const;

/**
 * Hard ceiling ratio for the SOCIAL_FEED family — width:height = 3:4
 * (1080:1440 at the canonical width). A ratio, not a pixel constant, so
 * a SOCIAL_FEED format at a different base width (e.g. 1200) gets the
 * same visual ceiling, not an arbitrarily different one.
 */
const SOCIAL_FEED_MAX_ASPECT = 3 / 4;

/**
 * The hard vertical ceiling for a SOCIAL_FEED render at this width —
 * 1440px at the canonical 1080px width. Returns null for formats this
 * law doesn't constrain (SOCIAL_STORY, SOCIAL_OTHER): a dense Story
 * keeps its own existing behaviour, and it is never solved by silently
 * becoming a Feed-shaped image or vice versa.
 */
export function socialFeedMaxHeightPx(family: PlatformFormatFamily, widthPx: number): number | null {
  if (family !== "SOCIAL_FEED") return null;
  return Math.round(widthPx / SOCIAL_FEED_MAX_ASPECT);
}

export const DEFAULT_PLATFORM_FORMAT_KEY = "generic_portrait";

export function getPlatformFormat(key: string | null | undefined): PlatformFormat {
  if (key && PLATFORM_FORMATS[key]) return PLATFORM_FORMATS[key];
  return PLATFORM_FORMATS[DEFAULT_PLATFORM_FORMAT_KEY];
}

export function listPlatformFormats(): PlatformFormat[] {
  return Object.values(PLATFORM_FORMATS);
}

export function isValidPlatformFormatKey(key: string): boolean {
  return key in PLATFORM_FORMATS;
}
