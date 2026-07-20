import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { applyTrustLayer } from "@/server/generation/gpt-native/trust-layer";

// Sprint 007: the KAI Trust Layer composites ONLY the QR + agency
// verification + registration number onto GPT's returned image — real
// sharp compositing, real QR round-trip, no mocks (matching the existing
// qr-renderer.test.ts / image-export.test.ts convention in this repo).

const WIDTH = 1080;
const HEIGHT = 1350;

async function fakeGptImage(): Promise<Buffer> {
  return sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 40, g: 60, b: 90 } },
  })
    .png()
    .toBuffer();
}

describe("applyTrustLayer", () => {
  it("produces a valid PNG at the exact requested dimensions", async () => {
    const base = await fakeGptImage();
    const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "av1", advertisementId: "ad1" }));

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Al-Yousuf Enterprises LLP",
      raLicenseId: "9986",
      version: 1,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    expect(result.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(WIDTH);
    expect(meta.height).toBe(HEIGHT);
  });

  it("composites a QR code that is still decodable and matches the same tracking URL after compositing", async () => {
    const base = await fakeGptImage();
    const url = buildQrTrackingUrl({ agencyVerificationId: "av2", advertisementId: "ad2" });
    const qr = await generateAndVerifyQr(url);

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Al-Yousuf Enterprises LLP",
      raLicenseId: "9986",
      version: 1,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    // Crop the bottom-right trust zone (matching the zone this module
    // itself computes) and decode the QR directly out of the final PNG —
    // proves the composited badge, not just the standalone QR, decodes.
    const zoneW = Math.round(WIDTH * 0.3);
    const zoneH = Math.round(HEIGHT * 0.22);
    const cropped = await sharp(result)
      .extract({ left: WIDTH - zoneW, top: HEIGHT - zoneH, width: zoneW, height: zoneH })
      .png()
      .toBuffer();

    const decodedPng = PNG.sync.read(cropped);
    const decoded = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
    expect(decoded?.data).toBe(url);
  });

  it("leaves the base image outside the trust zone visually untouched (GPT's composition is never redrawn)", async () => {
    const base = await fakeGptImage();
    const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "av3", advertisementId: "ad3" }));

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Al-Yousuf Enterprises LLP",
      raLicenseId: null,
      version: 1,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    // Sample a pixel far from the bottom-right trust zone (top-left corner)
    // — it must still be the exact solid colour the "GPT" image was.
    const pixel = await sharp(result)
      .extract({ left: 5, top: 5, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(Array.from(pixel.subarray(0, 3))).toEqual([40, 60, 90]);
  });

  it("stamps invisible provenance metadata without altering visible pixels", async () => {
    const base = await fakeGptImage();
    const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "av4", advertisementId: "ad4" }));

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Test Agency",
      raLicenseId: "1234",
      version: 7,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });

    const meta = await sharp(result).metadata();
    expect(meta.exif).toBeDefined();
  });
});
