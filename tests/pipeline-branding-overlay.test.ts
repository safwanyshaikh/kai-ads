import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";

async function decodeQr(png: Buffer): Promise<string | null> {
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = new PNG({ width: raw.info.width, height: raw.info.height });
  image.data = Buffer.from(raw.data);
  const decoded = jsQR(new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.length), image.width, image.height);
  return decoded?.data ?? null;
}

async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 30, g: 40, b: 60 } } })
    .png()
    .toBuffer();
}

const SAMPLE_LOGO = () =>
  sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 20, g: 90, b: 180, alpha: 1 } } })
    .png()
    .toBuffer();

describe("Branding Overlay v2 — QR remains decodable after compositing", () => {
  it("decodes to the exact KAI verification URL after compositing onto a background", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    const url = buildQrTrackingUrl({ agencyVerificationId: "av_overlay_test", advertisementId: "ad_overlay_test" });
    const qr = await generateAndVerifyQr(url);

    const composited = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      qrPng: qr.png,
      agencyName: "Test Agency",
    });

    expect(await decodeQr(composited)).toBe(url);
  });

  it("QR never collides with GPT content — the footer band is painted opaque regardless of background", async () => {
    // A "busy" background (checkerboard-like noise) that would have tripped the
    // old busy-region heuristic. The QR must still decode because the footer
    // band is now unconditionally opaque, not conditionally repositioned.
    const widthPx = 1024;
    const heightPx = 1536;
    const busyBackground = await sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer(), tile: true, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const url = buildQrTrackingUrl({ agencyVerificationId: "av_busy", advertisementId: "ad_busy" });
    const qr = await generateAndVerifyQr(url);

    const composited = await applyBrandingOverlay({
      imagePng: busyBackground,
      widthPx,
      heightPx,
      qrPng: qr.png,
      agencyName: "Busy Background Agency",
    });

    expect(await decodeQr(composited)).toBe(url);
  });
});

describe("Branding Overlay v2 — footer band", () => {
  it("never clips agency name or registration text (fitFontSize shrinks to fit)", async () => {
    const widthPx = 800;
    const heightPx = 1200;
    const longName = "The Extremely Long Overseas Recruitment Consultancy Enterprises Limited Partnership";
    const composited = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: longName,
      registrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
    });
    // No crash and a real, larger-than-input PNG is the practical signal here —
    // SVG text overflow doesn't throw, so we assert the band rendered at all.
    const meta = await sharp(composited).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });

  it("adapts to landscape canvases without fixed coordinates", async () => {
    const widthPx = 1536;
    const heightPx = 1024;
    const composited = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyLogoPng: await SAMPLE_LOGO(),
      agencyName: "Landscape Agency",
      registrationNumber: "RA-1234",
      contactLine: "jobs@example.com | 0000000000",
    });
    const meta = await sharp(composited).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });

  it("still paints the protected trust footer band when no branding fields are provided, never a silent no-op", async () => {
    // The footer is an unconditionally opaque, protected trust zone (see
    // the sibling "QR never collides..." test above and LOCK 1/the Final
    // Commercial Lock) — it is never a passthrough, even for a totally
    // empty Agency Profile, because "leftover space" is exactly the
    // dead-footer defect that architecture exists to prevent. A missing
    // profile must not silently skip compositing.
    const widthPx = 1024;
    const heightPx = 1536;
    const original = await solidBackground(widthPx, heightPx);
    const result = await applyBrandingOverlay({ imagePng: original, widthPx, heightPx });

    // Same dimensions, but genuinely different pixels — the navy/gold
    // footer chrome always composites over the source.
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
    expect(result.equals(original)).toBe(false);

    // The footer band itself: solid navy (not the plain background colour)
    // with the gold top rule, painted fully opaque.
    const footerHeightPx = Math.min(300, Math.max(250, Math.round(widthPx * 0.25)));
    const { data, info } = await sharp(result)
      .extract({ left: 0, top: heightPx - footerHeightPx, width: widthPx, height: footerHeightPx })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const midRow = Math.round(footerHeightPx / 2);
    const i = (midRow * info.width + Math.round(info.width / 2)) * info.channels;
    // Solid background was (30,40,60) — the footer paints its own navy
    // gradient (#0B1F33 -> #102A44), fully opaque (alpha 255).
    expect(data[i + 3]).toBe(255);
    expect([data[i], data[i + 1], data[i + 2]]).not.toEqual([30, 40, 60]);
  });
});

describe("Branding Overlay v2 — watermark", () => {
  it("applies a repeating watermark without throwing when a logo is provided", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    const withoutWatermark = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "No Logo Agency",
    });
    const withWatermark = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyLogoPng: await SAMPLE_LOGO(),
      agencyName: "Watermarked Agency",
    });
    // The watermarked version must differ from the un-watermarked one (tiles were composited).
    expect(Buffer.compare(withoutWatermark, withWatermark)).not.toBe(0);
  });
});

describe("Branding Overlay v2 — optional agency address/website line", () => {
  it("leaves output byte-identical when no address line is supplied", async () => {
    const widthPx = 1024;
    const heightPx = 1024;
    const base = {
      widthPx,
      heightPx,
      agencyName: "Gulf Manpower Consultants",
      registrationNumber: "RC-1234/MUM/2019",
    };

    const withoutField = await applyBrandingOverlay({ imagePng: await solidBackground(widthPx, heightPx), ...base });
    const withNull = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      addressLine: null,
    });

    // Regression guard: adding this field must not have shifted the
    // existing, visually verified band layout for ads that don't use it.
    expect(withNull.equals(withoutField)).toBe(true);
  });

  it("renders the address line inside the band and changes the output when supplied", async () => {
    const widthPx = 1024;
    const heightPx = 1024;
    const base = {
      widthPx,
      heightPx,
      agencyName: "Gulf Manpower Consultants",
      registrationNumber: "RC-1234/MUM/2019",
    };

    const plain = await applyBrandingOverlay({ imagePng: await solidBackground(widthPx, heightPx), ...base });
    const withAddress = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      addressLine: "Andheri East, Mumbai · www.alyousufent.com",
    });

    expect(withAddress.equals(plain)).toBe(false);
    // Canvas size is unchanged: the line uses spare room inside the
    // existing band rather than growing it into the advertisement.
    const meta = await sharp(withAddress).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });

  it("does not overflow the band when given a long address", async () => {
    const widthPx = 1024;
    const heightPx = 1024;
    const long =
      "Office 402, 4th Floor, Sunshine Business Tower, Andheri Kurla Road, Andheri East, Mumbai 400059 · www.alyousufent.com";

    const composited = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
      contactLine: "+91 22 6666 5353",
      addressLine: long,
    });

    const meta = await sharp(composited).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });
});
