import { describe, expect, it } from "vitest";
import {
  PLATFORM_FORMATS,
  getPlatformFormat,
  listPlatformFormats,
  isValidPlatformFormatKey,
  DEFAULT_PLATFORM_FORMAT_KEY,
} from "@/lib/platform-formats";

describe("Platform Formats registry", () => {
  it("includes every platform named in the brief", () => {
    const keys = Object.keys(PLATFORM_FORMATS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "whatsapp_status",
        "instagram_post",
        "instagram_story",
        "facebook_post",
        "linkedin_post",
        "youtube_community",
        "generic_square",
        "generic_portrait",
        "generic_landscape",
      ]),
    );
  });

  it("every format has positive dimensions and a label", () => {
    for (const format of listPlatformFormats()) {
      expect(format.widthPx).toBeGreaterThan(0);
      expect(format.heightPx).toBeGreaterThan(0);
      expect(format.label.length).toBeGreaterThan(0);
    }
  });

  it("getPlatformFormat falls back to the default for an unknown key", () => {
    const result = getPlatformFormat("not_a_real_platform");
    expect(result.key).toBe(DEFAULT_PLATFORM_FORMAT_KEY);
  });

  it("getPlatformFormat falls back to the default for a missing key", () => {
    expect(getPlatformFormat(null).key).toBe(DEFAULT_PLATFORM_FORMAT_KEY);
    expect(getPlatformFormat(undefined).key).toBe(DEFAULT_PLATFORM_FORMAT_KEY);
  });

  it("isValidPlatformFormatKey correctly validates", () => {
    expect(isValidPlatformFormatKey("instagram_story")).toBe(true);
    expect(isValidPlatformFormatKey("myspace_post")).toBe(false);
  });
});
