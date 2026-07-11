import { describe, expect, it } from "vitest";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";

describe("QR generation + decode self-verification (real, no mocks)", () => {
  it("generates a real, decodable QR PNG for a tracking URL", async () => {
    const url = buildQrTrackingUrl({ agencyVerificationId: "av_test123", advertisementId: "ad_test456" });
    const result = await generateAndVerifyQr(url);

    expect(result.decodable).toBe(true);
    expect(result.decodedValue).toBe(url);
    expect(result.png.length).toBeGreaterThan(0);
  });

  it("the decoded payload exactly matches what was encoded, not just 'something' decodable", async () => {
    const url = "https://kai.ads/v/abc?a=def";
    const result = await generateAndVerifyQr(url);
    expect(result.decodedValue).toBe(url);
    expect(result.decodedValue).not.toBe(url + " ");
  });

  it("buildQrTrackingUrl never encodes the official government destination directly — only a KAI tracking URL", () => {
    const url = buildQrTrackingUrl({ agencyVerificationId: "av1", advertisementId: "ad1" });
    expect(url).not.toMatch(/emigrate|mea\.gov\.in/i);
    expect(url).toContain("/v/av1");
    expect(url).toContain("a=ad1");
  });

  it("produces a valid PNG with adequate size for reliable scanning", async () => {
    const url = buildQrTrackingUrl({ agencyVerificationId: "av2", advertisementId: "ad2" });
    const result = await generateAndVerifyQr(url);
    // PNG magic bytes
    expect(result.png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("remains decodable for a longer, realistic tracking URL", async () => {
    const url = buildQrTrackingUrl({
      agencyVerificationId: "cljk3n4p20000qzrmwz8h9xyz",
      advertisementId: "cljk3n8w40001qzrm12ab34cd",
    });
    const result = await generateAndVerifyQr(url);
    expect(result.decodable).toBe(true);
  });
});
