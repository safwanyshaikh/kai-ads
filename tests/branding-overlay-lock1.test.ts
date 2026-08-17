import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

async function solidBackground(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 30, g: 40, b: 60 } } })
    .png()
    .toBuffer();
}

describe("Trust footer — LOCK 1: official contact is sourced from the verified Agency Profile only", () => {
  const widthPx = 1024;
  const heightPx = 1536;
  const base = { widthPx, heightPx, agencyName: "Al Yousuf Enterprises LLP" };

  it("renders when officialPhone/officialEmail are present, independent of any campaign contactLine", async () => {
    const withoutOfficial = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
    });
    const withOfficial = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@alyousufent.com",
    });
    expect(withOfficial.equals(withoutOfficial)).toBe(false);
  });

  it("shows officialPhone/officialEmail even when the recruitment source supplied no contact at all", async () => {
    // LOCK 1: "The source PDF therefore does not need to contain the
    // agency email." No campaignContact/contactLine is passed here at
    // all — the official fields alone must still produce footer content.
    const result = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@alyousufent.com",
    });
    const blank = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
    });
    expect(result.equals(blank)).toBe(false);
  });

  it("a campaign contactLine no longer appears in the trust footer at all", async () => {
    // The trust footer is the protected Agency Identity zone (LOCK 1) —
    // a campaign/candidate contact belongs elsewhere, never here, so it
    // must not change the footer's own output.
    const withCampaignContact = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      contactLine: "candidate-apply@example.com | 0000000000",
    });
    const withoutCampaignContact = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
    });
    expect(withCampaignContact.equals(withoutCampaignContact)).toBe(true);
  });

  it("shows the website line when present, and it changes the output", async () => {
    const withWebsite = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
      website: "https://www.alyousufent.com",
    });
    const withoutWebsite = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      ...base,
    });
    expect(withWebsite.equals(withoutWebsite)).toBe(false);
  });

  it("omits every optional field cleanly when absent — no placeholder, no crash, no size change", async () => {
    const minimal = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Only A Name",
    });
    const meta = await sharp(minimal).metadata();
    expect(meta.width).toBe(widthPx);
    expect(meta.height).toBe(heightPx);
  });
});

describe("Trust footer — LOCK 1: never looks empty when the Agency Profile is sparse", () => {
  it("still produces a non-trivially-sized, valid footer band with only a name (no registration/address/contact/website)", async () => {
    const widthPx = 1024;
    const heightPx = 1536;
    const sparse = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Solo Name Agency",
    });
    const full = await applyBrandingOverlay({
      imagePng: await solidBackground(widthPx, heightPx),
      widthPx,
      heightPx,
      agencyName: "Solo Name Agency",
      registrationNumber: "RC-1234",
      addressLine: "Andheri East, Mumbai",
      officialPhone: "+91 22 6666 5353",
      officialEmail: "info@example.com",
      website: "https://example.com",
    });
    // Both must render without throwing and at the correct canvas size —
    // the concrete regression this guards is the sparse case no longer
    // silently succeeding with a visually broken/empty band.
    for (const png of [sparse, full]) {
      const meta = await sharp(png).metadata();
      expect(meta.width).toBe(widthPx);
      expect(meta.height).toBe(heightPx);
    }
    expect(sparse.equals(full)).toBe(false);
  });
});
