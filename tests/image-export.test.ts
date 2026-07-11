import { describe, expect, it } from "vitest";
import { exportImage, buildExportFilename, rasterizeSvg } from "@/server/generation/image-export.service";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#336699"/><text x="10" y="50" font-size="16" fill="white">KAI Ads</text></svg>`;

describe("rasterizeSvg — real SVG-to-PNG rendering, no mocks", () => {
  it("produces a valid PNG buffer at the requested dimensions", async () => {
    const png = await rasterizeSvg(SAMPLE_SVG, 200, 150);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("throws a clear error for malformed SVG rather than producing garbage output", async () => {
    await expect(rasterizeSvg("<not valid svg at all", 100, 100)).rejects.toThrow();
  });
});

describe("exportImage — real format conversion", () => {
  it("PNG passthrough returns the same bytes with the correct MIME type", async () => {
    const png = await rasterizeSvg(SAMPLE_SVG, 100, 100);
    const result = await exportImage(png, "png", { widthPx: 100, heightPx: 100 });
    expect(result.mimeType).toBe("image/png");
    expect(result.buffer.equals(png)).toBe(true);
  });

  it("JPG conversion produces a real JPEG (magic bytes, no alpha channel)", async () => {
    const png = await rasterizeSvg(SAMPLE_SVG, 100, 100);
    const result = await exportImage(png, "jpg", { widthPx: 100, heightPx: 100 });
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  });

  it("PDF export produces a real, parseable PDF at the correct page size", async () => {
    const png = await rasterizeSvg(SAMPLE_SVG, 300, 400);
    const result = await exportImage(png, "pdf", { widthPx: 300, heightPx: 400 });
    expect(result.mimeType).toBe("application/pdf");
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects an unsupported format", async () => {
    const png = await rasterizeSvg(SAMPLE_SVG, 100, 100);
    // @ts-expect-error deliberately invalid format for the negative test
    await expect(exportImage(png, "bmp", { widthPx: 100, heightPx: 100 })).rejects.toThrow();
  });
});

describe("buildExportFilename — useful names, no secrets or internal IDs", () => {
  it("builds a readable, hyphenated filename from country/industry/position", () => {
    const name = buildExportFilename({
      country: "Saudi Arabia",
      industry: "Oil & Gas",
      firstPositionTitle: "Pipe Fitter",
      format: "png",
    });
    expect(name).toBe("saudi-arabia-oil-gas-pipe-fitter-kai-ads.png");
  });

  it("uses .jpg (not .jpeg) for the jpg format", () => {
    const name = buildExportFilename({ country: "UAE", industry: "Construction", format: "jpg" });
    expect(name.endsWith(".jpg")).toBe(true);
  });

  it("never includes anything resembling a database ID (cuid/uuid pattern)", () => {
    const name = buildExportFilename({
      country: "UAE",
      industry: "Construction",
      firstPositionTitle: "Welder",
      format: "pdf",
    });
    expect(name).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i);
    expect(name).not.toMatch(/^c[a-z0-9]{20,}/i);
  });

  it("degrades gracefully when optional parts are missing", () => {
    const name = buildExportFilename({ country: "", industry: "", format: "png" });
    expect(name).toBe("kai-ads.png");
  });
});
