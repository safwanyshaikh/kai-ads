import { describe, expect, it } from "vitest";

import {
  advertisementOutputFormatSchema,
  generateAdvertisementSchema,
} from "@/lib/validations/advertisement-generation";
import { dtpVariantFor, isDtpOutput } from "@/server/services/dtp-render.service";

/**
 * GENERATION ROUTING.
 *
 * The live application produced a social poster for every agency,
 * including those that wanted a newspaper classified, because the
 * generation panel sent a hidden `platformFormat: "generic_portrait"`
 * on every request and the service had no other branch. The DTP
 * compositor was built and tested and simply unreachable from the
 * product.
 *
 * These cover the contract that fixes it: the format is the tenant's
 * explicit choice, it decides which engine runs, and a request without
 * one does not generate.
 */
describe("generation request contract", () => {
  it("refuses a request that names no format", () => {
    // The old shape — platformFormat alone — is now rejected outright.
    const result = generateAdvertisementSchema.safeParse({
      platformFormat: "generic_portrait",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the three products a tenant can buy", () => {
    expect(generateAdvertisementSchema.safeParse({ outputFormat: "DTP_BW" }).success).toBe(true);
    expect(generateAdvertisementSchema.safeParse({ outputFormat: "DTP_COLOUR" }).success).toBe(true);
    expect(generateAdvertisementSchema.safeParse({
      outputFormat: "SOCIAL", platformFormat: "generic_portrait",
    }).success).toBe(true);
  });

  it("still requires a platform format for social, and none for DTP", () => {
    // Social's existing pipeline is driven by it. DTP works in
    // physical centimetres and has no use for a platform preset.
    expect(generateAdvertisementSchema.safeParse({ outputFormat: "SOCIAL" }).success).toBe(false);
    expect(generateAdvertisementSchema.safeParse({ outputFormat: "DTP_BW" }).success).toBe(true);
  });

  it("honours a purchased classified height, and only bookable ones", () => {
    for (const dtpHeightCm of [5, 6, 7, 8, 9, 10, 11, 12]) {
      const parsed = generateAdvertisementSchema.safeParse({
        outputFormat: "DTP_COLOUR", dtpHeightCm,
      });
      expect(parsed.success).toBe(true);
    }
    // 56 was a misreading of a booking slip, never a size.
    expect(generateAdvertisementSchema.safeParse({
      outputFormat: "DTP_COLOUR", dtpHeightCm: 56,
    }).success).toBe(false);
    expect(generateAdvertisementSchema.safeParse({
      outputFormat: "DTP_COLOUR", dtpHeightCm: 4,
    }).success).toBe(false);
  });

  it("routes each format to exactly one engine", () => {
    // Black & White and Colour are both DTP — not a proxy for
    // "DTP versus Social".
    expect(isDtpOutput("DTP_BW")).toBe(true);
    expect(isDtpOutput("DTP_COLOUR")).toBe(true);
    expect(isDtpOutput("SOCIAL")).toBe(false);

    expect(dtpVariantFor("DTP_BW")).toBe("BW");
    expect(dtpVariantFor("DTP_COLOUR")).toBe("COLOUR");
  });

  it("has no fourth format, so nothing can fall through to a default", () => {
    expect(advertisementOutputFormatSchema.options).toEqual([
      "DTP_BW", "DTP_COLOUR", "SOCIAL",
    ]);
    expect(advertisementOutputFormatSchema.safeParse("generic_portrait").success).toBe(false);
    expect(advertisementOutputFormatSchema.safeParse("").success).toBe(false);
  });
});
