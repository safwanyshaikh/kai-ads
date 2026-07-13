import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { renderSectionComposition } from "@/server/generation/section-renderer";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { selectBadgeConfig } from "@/server/generation/badge-selection.service";
import { getPlatformFormat } from "@/lib/platform-formats";

/**
 * This is the test that actually matters for the brief's "QR Quality"
 * gate: it's not enough for the standalone QR PNG to decode (already
 * covered by tests/qr-renderer.test.ts) — the QR as it appears IN THE
 * FINAL EXPORTED ADVERTISEMENT, after being embedded in the SVG
 * composition and rasterized to the platform's actual pixel dimensions,
 * must still decode. This proves the whole pipeline, not just one step
 * of it, for every style the brief requires to be "real" (Visual,
 * Typography, Newspaper).
 */
describe("QR remains decodable after full composition + rasterization (real pipeline, no mocks)", () => {
  const platformFormat = getPlatformFormat("generic_square");
  const url = buildQrTrackingUrl({ agencyVerificationId: "av_pipeline_test", advertisementId: "ad_pipeline_test" });

  const baseInput = {
    platformFormat,
    header: "Welders & Fitters Needed",
    industry: "Construction",
    country: "UAE",
    employer: null,
    positions: [{ title: "Welder", count: 5 }],
    benefits: [{ label: "Free accommodation" }],
    interview: [{ date: "1 Aug 2026" }],
    contact: { phone: "+971-500000000" },
    footer: "RA-9999",
    agencyName: "Test Agency",
    raLicenseId: "RA-9999-2024",
    badge: selectBadgeConfig({
      style: "TYPOGRAPHY",
      density: "MEDIUM",
      positionCount: 1,
      platformFormat,
    }),
  };

  async function decodeQrFromFinalRaster(style: "VISUAL" | "TYPOGRAPHY" | "NEWSPAPER"): Promise<string | null> {
    const qr = await generateAndVerifyQr(url);
    expect(qr.decodable).toBe(true);

    const svg = renderSectionComposition({
      ...baseInput,
      style,
      qrDataUri: `data:image/png;base64,${qr.png.toString("base64")}`,
    });

    const finalPng = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);
    const decodedPng = PNG.sync.read(finalPng);
    const result = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
    return result?.data ?? null;
  }

  it("Typography: QR decodes from the final rasterized advertisement", async () => {
    const decoded = await decodeQrFromFinalRaster("TYPOGRAPHY");
    expect(decoded).toBe(url);
  });

  it("Newspaper/DTP: QR decodes from the final rasterized advertisement", async () => {
    const decoded = await decodeQrFromFinalRaster("NEWSPAPER");
    expect(decoded).toBe(url);
  });

  it("Visual (with fallback gradient background): QR decodes from the final rasterized advertisement", async () => {
    const decoded = await decodeQrFromFinalRaster("VISUAL");
    expect(decoded).toBe(url);
  });

  it("the final raster is a real, correctly-sized PNG matching the platform format", async () => {
    const qr = await generateAndVerifyQr(url);
    const svg = renderSectionComposition({
      ...baseInput,
      style: "TYPOGRAPHY",
      qrDataUri: `data:image/png;base64,${qr.png.toString("base64")}`,
    });
    const finalPng = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);
    const decodedPng = PNG.sync.read(finalPng);
    expect(decodedPng.width).toBe(platformFormat.widthPx);
    expect(decodedPng.height).toBe(platformFormat.heightPx);
  });
});
