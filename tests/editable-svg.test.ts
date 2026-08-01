import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildEditableAdvertisementSvg, rasterizeEditableSvg } from "@/server/generation/pipeline/editable-svg";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const facts: AdvertisementFacts = {
  header: "Hiring for Bilfinger Shutdown Project",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  positions: [
    { title: "Welders - TIG & Multi", experience: "Shutdown experience required" },
    { title: "Instrument and Control Technician" },
  ],
  benefits: [{ label: "Basic salary + daily overtime up to 4 hours" }],
  interview: [{ date: "14th & 15th July", location: "Baroda" }],
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "RC-B1487",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
};

const agency = buildAgencyDna({
  id: "al-yousuf",
  name: "Al Yousuf Enterprises LLP",
  registrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
});

const document = buildAdvertisementDocument({
  advertisementId: "ad-1",
  facts,
  agency,
  format: { key: "KAI-PT", widthPx: 1080, heightPx: 1350, dpi: null, printOrNewspaper: false },
  preferredPack: "OIL_AND_GAS",
});

async function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 90, g: 60, b: 30 } } })
    .jpeg()
    .toBuffer();
}

describe("Editable SVG — one document, background photo the only raster mark", () => {
  it("produces well-formed XML with the background as an <image> and facts as real <text>", async () => {
    const background = await tinyJpeg();
    const result = await buildEditableAdvertisementSvg(document, { backgroundPng: background });

    expect(result.svg.startsWith("<svg")).toBe(true);
    expect(result.svg.trim().endsWith("</svg>")).toBe(true);
    expect(result.widthPx).toBe(1080);
    expect(result.heightPx).toBeGreaterThanOrEqual(1350);

    const textCount = (result.svg.match(/<text[ >]/g) ?? []).length;
    expect(textCount).toBeGreaterThan(10);
    // Every verified fact must be a real element, not baked into artwork.
    // XML-escaped (as any correct SVG serialiser must) and uppercased —
    // the poster row style sets trade names in caps, matching the genre.
    expect(result.svg).toContain("AL YOUSUF ENTERPRISES LLP");
    expect(result.svg).toContain("WELDERS - TIG &amp; MULTI");
    expect(result.svg).toContain("RC-B1487");
  });

  it("labels the background image with its true format, not an assumed one", async () => {
    // The provider returned JPEG bytes under a nominal "PNG" request in
    // the real Bilfinger run — a mislabeled data URI silently fails to
    // decode in an SVG rasterizer even though sharp's raster compositing
    // (which reads magic bytes, not labels) never had this problem.
    const jpeg = await tinyJpeg();
    const result = await buildEditableAdvertisementSvg(document, { backgroundPng: jpeg });
    expect(result.svg).toMatch(/href="data:image\/jpeg;base64,/);
    expect(result.svg).not.toMatch(/href="data:image\/png;base64,\/9j/);
  });

  it("renders a flat surface fill, not a blank canvas, when no artwork is supplied", async () => {
    const result = await buildEditableAdvertisementSvg(document, {});
    expect(result.svg).toContain('data-kai-field="background"');
    expect(result.svg).not.toContain("<image");
  });

  it("tags the three editable regions so a purpose-built editor can target them", async () => {
    const result = await buildEditableAdvertisementSvg(document, { backgroundPng: await tinyJpeg() });
    for (const field of ["background", "facts", "branding"]) {
      expect(result.svg, field).toContain(`data-kai-field="${field}"`);
    }
  });

  it("gives the logo and QR stable, targetable ids", async () => {
    const logo = await tinyJpeg();
    const result = await buildEditableAdvertisementSvg(document, {
      backgroundPng: await tinyJpeg(),
      agencyLogoPng: logo,
    });
    expect(result.svg).toContain('id="kai-agency-logo"');
  });

  it("rasterizes to the exact requested dimensions for KAI Audit and export", async () => {
    const result = await buildEditableAdvertisementSvg(document, { backgroundPng: await tinyJpeg() });
    const png = await rasterizeEditableSvg(result.svg, result.widthPx, result.heightPx);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(result.widthPx);
    expect(meta.height).toBe(result.heightPx);
  });

  it("is deterministic for the same document and artwork", async () => {
    const bg = await tinyJpeg();
    const a = await buildEditableAdvertisementSvg(document, { backgroundPng: bg });
    const b = await buildEditableAdvertisementSvg(document, { backgroundPng: bg });
    expect(a.svg).toBe(b.svg);
  });
});
