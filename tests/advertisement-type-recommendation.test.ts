import { describe, expect, it } from "vitest";
import { recommendAdvertisementType } from "@/server/generation/advertisement-type-recommendation.service";

describe("recommendAdvertisementType", () => {
  it("HIGH density never recommends VISUAL — 'never force a high-density requirement into a visual-heavy layout'", () => {
    const result = recommendAdvertisementType({
      density: "HIGH",
      hasSalaryInfo: false,
      isUrgent: false,
      hasEmployerLogo: true,
    });
    expect(result.style).not.toBe("VISUAL");
    expect(result.style).toBe("NEWSPAPER");
  });

  it("urgent requirements recommend TYPOGRAPHY", () => {
    const result = recommendAdvertisementType({
      density: "LOW",
      hasSalaryInfo: false,
      isUrgent: true,
      hasEmployerLogo: false,
    });
    expect(result.style).toBe("TYPOGRAPHY");
  });

  it("salary-focused requirements recommend TYPOGRAPHY", () => {
    const result = recommendAdvertisementType({
      density: "LOW",
      hasSalaryInfo: true,
      isUrgent: false,
      hasEmployerLogo: false,
    });
    expect(result.style).toBe("TYPOGRAPHY");
  });

  it("a single low-density, non-urgent requirement recommends VISUAL", () => {
    const result = recommendAdvertisementType({
      density: "LOW",
      hasSalaryInfo: false,
      isUrgent: false,
      hasEmployerLogo: false,
    });
    expect(result.style).toBe("VISUAL");
  });

  it("MEDIUM density with no strong signal defaults to TYPOGRAPHY", () => {
    const result = recommendAdvertisementType({
      density: "MEDIUM",
      hasSalaryInfo: false,
      isUrgent: false,
      hasEmployerLogo: false,
    });
    expect(result.style).toBe("TYPOGRAPHY");
  });

  it("every recommendation includes a human-readable reason", () => {
    const result = recommendAdvertisementType({
      density: "HIGH",
      hasSalaryInfo: false,
      isUrgent: false,
      hasEmployerLogo: false,
    });
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
