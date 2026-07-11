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

export interface PlatformFormat {
  key: string;
  label: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: string; // human-readable, e.g. "9:16"
}

export const PLATFORM_FORMATS: Record<string, PlatformFormat> = {
  whatsapp_status: {
    key: "whatsapp_status",
    label: "WhatsApp Status",
    widthPx: 1080,
    heightPx: 1920,
    aspectRatio: "9:16",
  },
  instagram_post: {
    key: "instagram_post",
    label: "Instagram Post",
    widthPx: 1080,
    heightPx: 1080,
    aspectRatio: "1:1",
  },
  instagram_story: {
    key: "instagram_story",
    label: "Instagram Story",
    widthPx: 1080,
    heightPx: 1920,
    aspectRatio: "9:16",
  },
  facebook_post: {
    key: "facebook_post",
    label: "Facebook Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
  },
  linkedin_post: {
    key: "linkedin_post",
    label: "LinkedIn Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
  },
  youtube_community: {
    key: "youtube_community",
    label: "YouTube Community Post",
    widthPx: 1200,
    heightPx: 1200,
    aspectRatio: "1:1",
  },
  generic_square: {
    key: "generic_square",
    label: "Generic Square",
    widthPx: 1080,
    heightPx: 1080,
    aspectRatio: "1:1",
  },
  generic_portrait: {
    key: "generic_portrait",
    label: "Generic Portrait",
    widthPx: 1080,
    heightPx: 1350,
    aspectRatio: "4:5",
  },
  generic_landscape: {
    key: "generic_landscape",
    label: "Generic Landscape",
    widthPx: 1600,
    heightPx: 900,
    aspectRatio: "16:9",
  },
};

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
