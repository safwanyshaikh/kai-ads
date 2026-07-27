import { describe, expect, it } from "vitest";
import { applyDestinationCurrency } from "@/server/generation/pipeline/currency";

describe("applyDestinationCurrency — destination currency is a known fact, not a guess", () => {
  it("labels a bare 'K' shorthand range with the destination's real currency", () => {
    expect(applyDestinationCurrency("5K to 7K Basic (varies based on interview assessment)", "Saudi Arabia")).toBe(
      "SAR 5K to 7K Basic (varies based on interview assessment)",
    );
  });

  it("labels a bare digit-grouped figure", () => {
    expect(applyDestinationCurrency("3,200 per month", "UAE")).toBe("AED 3,200 per month");
  });

  it("never overrides a currency already stated in the source", () => {
    expect(applyDestinationCurrency("SAR 3,200", "Saudi Arabia")).toBe("SAR 3,200");
    expect(applyDestinationCurrency("$3,800", "Saudi Arabia")).toBe("$3,800");
  });

  it("never invents a currency for an unresolvable/unknown destination", () => {
    expect(applyDestinationCurrency("5K to 7K Basic", "Neverland")).toBe("5K to 7K Basic");
  });

  it("leaves text with no monetary figure untouched", () => {
    expect(applyDestinationCurrency("Free accommodation and transport", "Saudi Arabia")).toBe(
      "Free accommodation and transport",
    );
  });

  it("resolves a country alias (KSA) the same as the canonical name", () => {
    expect(applyDestinationCurrency("5K to 7K Basic", "KSA")).toBe("SAR 5K to 7K Basic");
  });
});
