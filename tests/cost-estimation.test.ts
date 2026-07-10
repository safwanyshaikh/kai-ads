import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "@/server/services/cost-estimation";

describe("estimateCostUsd — Cost Tracking", () => {
  it("computes a cost for a known model with known token counts", () => {
    const cost = estimateCostUsd("gpt-4.1-mini", 1000, 1000);
    expect(cost).toBeCloseTo(0.0004 + 0.0016, 6);
  });

  it("scales linearly with token count", () => {
    const cost1k = estimateCostUsd("gpt-4.1-mini", 1000, 0);
    const cost2k = estimateCostUsd("gpt-4.1-mini", 2000, 0);
    expect(cost2k).toBeCloseTo((cost1k ?? 0) * 2, 6);
  });

  it("never guesses: returns null for an unknown model rather than a fabricated cost", () => {
    expect(estimateCostUsd("some-future-model", 1000, 1000)).toBeNull();
  });

  it("returns null when token counts are unavailable", () => {
    expect(estimateCostUsd("gpt-4.1-mini", null, null)).toBeNull();
    expect(estimateCostUsd("gpt-4.1-mini", 100, null)).toBeNull();
  });

  it("handles zero tokens without error", () => {
    expect(estimateCostUsd("gpt-4.1-mini", 0, 0)).toBe(0);
  });
});
