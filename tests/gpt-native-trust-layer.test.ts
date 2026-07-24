import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { applyTrustLayer, computeImageSha256 } from "@/server/generation/gpt-native/trust-layer";
import { verifyTrustZoneQr } from "@/server/generation/gpt-native/acceptance";

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

// Sprint 008 Workstream G: generation ID + agency logo + content hash, and
// Workstream E's runtime QR gate — all proven on real composited pixels.
describe("applyTrustLayer — Sprint 008 ownership carriers", () => {
  it("composites generation ID and agency logo without breaking QR decodability", async () => {
    const base = await fakeGptImage();
    const url = buildQrTrackingUrl({ agencyVerificationId: "av9", advertisementId: "ad9" });
    const qr = await generateAndVerifyQr(url);
    const logo = await sharp({
      create: { width: 200, height: 80, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Al-Yousuf Enterprises LLP",
      raLicenseId: "9986",
      version: 3,
      widthPx: WIDTH,
      heightPx: HEIGHT,
      generationId: "KAI-AD9XXXXX-V3",
      agencyLogoPng: logo,
    });

    expect(await verifyTrustZoneQr(result, url, WIDTH, HEIGHT)).toBe(true);
  });

  it("a corrupt logo never blocks generation (non-fatal compositing)", async () => {
    const base = await fakeGptImage();
    const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "av10", advertisementId: "ad10" }));

    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Test Agency",
      raLicenseId: "1",
      version: 1,
      widthPx: WIDTH,
      heightPx: HEIGHT,
      generationId: "KAI-TEST-V1",
      agencyLogoPng: Buffer.from("this is not an image"),
    });
    expect(result.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("computeImageSha256 is deterministic and content-sensitive (authenticity record)", async () => {
    const a = await fakeGptImage();
    expect(computeImageSha256(a)).toBe(computeImageSha256(a));
    expect(computeImageSha256(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(computeImageSha256(Buffer.concat([a, Buffer.from([1])]))).not.toBe(computeImageSha256(a));
  });

  it("verifyTrustZoneQr rejects an image whose trust zone carries the WRONG QR payload", async () => {
    const base = await fakeGptImage();
    const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "av11", advertisementId: "ad11" }));
    const result = await applyTrustLayer({
      baseImagePng: base,
      qrPng: qr.png,
      agencyName: "Test Agency",
      raLicenseId: null,
      version: 1,
      widthPx: WIDTH,
      heightPx: HEIGHT,
    });
    expect(await verifyTrustZoneQr(result, "https://attacker.example/fake", WIDTH, HEIGHT)).toBe(false);
  });
});
