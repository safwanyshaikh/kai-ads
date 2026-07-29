import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Candidate trust flow: Scan QR → KAI verification page → official
 * government site.
 *
 * The route previously redirected straight to the government URL, which
 * made KAI invisible in its own trust chain — a candidate could not see
 * who published the advertisement, under which licence, or how to reach
 * them. KAI vouches first; the government remains the final authority.
 */
describe("QR verification page", () => {
  const page = readFileSync("src/app/v/[agencyVerificationId]/page.tsx", "utf8");

  it("is a page, not a redirect", () => {
    expect(page).toContain("export default async function AgencyVerificationPage");
    expect(page).not.toMatch(/NextResponse\.redirect/);
  });

  it("shows the agency identity a candidate needs to trust the advertisement", () => {
    for (const field of [
      "agencyLogoUrl",
      "agencyName",
      "raLicenseId",
      "agencyPhone",
      "agencyWhatsapp",
      "agencyEmail",
      "agencyOfficeAddress",
    ]) {
      expect(page, field).toContain(field);
    }
  });

  it("shows which advertisement was scanned and when it was published", () => {
    expect(page).toContain("advertisementId");
    expect(page).toContain("advertisementPublishedAt");
  });

  it("only shows the verified badge when the agency is actually VERIFIED", () => {
    expect(page).toMatch(/verificationStatus === "VERIFIED"/);
    expect(page).toContain("VERIFICATION PENDING");
  });

  it("sends the candidate on to the official government destination", () => {
    expect(page).toContain("destinationUrl");
    expect(page).toMatch(/Verify on the official government website/);
  });

  it("still records the scan for QR analytics", () => {
    expect(page).toContain("resolveAndRecordScan");
  });

  it("never shows an error page to a scanning candidate", () => {
    // Recording a scan is our telemetry concern, not the candidate's.
    expect(page).toMatch(/catch \(error\)/);
  });
});

describe("QR scan resolution carries the trust payload", () => {
  const service = readFileSync("src/server/services/qr-scan.service.ts", "utf8");

  it("resolves agency contact details from the verified profile", () => {
    expect(service).toContain("agencyPhone");
    expect(service).toContain("agencyOfficeAddress");
    expect(service).toContain("agencyLogoUrl");
  });

  it("only exposes the government destination when VERIFIED", () => {
    expect(service).toMatch(/verification\.status === "VERIFIED"[\s\S]{0,80}officialVerificationUrl/);
  });
});
