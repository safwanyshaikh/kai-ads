import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";

/**
 * The QR must still decode AFTER the Minimal Branding Overlay composites it
 * onto GPT's finished image — not just as a standalone PNG. This is the one
 * deterministic gate the single production pipeline enforces.
 */
describe("Minimal Branding Overlay — QR remains decodable after compositing", () => {
  it("decodes to the exact KAI verification URL after compositing onto a background", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    const url = buildQrTrackingUrl({ agencyVerificationId: "av_overlay_test", advertisementId: "ad_overlay_test" });
    const qr = await generateAndVerifyQr(url);

    const background = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 30, g: 40, b: 60 } },
    })
      .png()
      .toBuffer();

    const composited = await applyBrandingOverlay({
      imagePng: background,
      widthPx,
      heightPx,
      qrPng: qr.png,
      footerText: "Test Agency",
    });

    const raw = await sharp(composited).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const png = new PNG({ width: raw.info.width, height: raw.info.height });
    png.data = Buffer.from(raw.data);
    const decoded = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);

    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(url);
  });
});
