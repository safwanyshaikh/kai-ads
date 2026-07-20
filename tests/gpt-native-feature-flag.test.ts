import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/env";

// Sprint 007: "Default OFF. Legacy path remains untouched." — a single
// direct assertion that the flag is off in this test environment (no env
// var set), matching the convention in
// creative-director-pipeline-adapter.test.ts's own "zero behaviour drift"
// check for CREATIVE_DIRECTOR_BRAIN.
describe("GPT_NATIVE_AD_GENERATION feature flag", () => {
  it("defaults to false — the legacy composeAdvertisement pipeline is untouched", () => {
    expect(getFeatureFlags().gptNativeAdGeneration).toBe(false);
  });
});
