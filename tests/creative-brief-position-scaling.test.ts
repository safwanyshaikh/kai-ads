import { describe, expect, it } from "vitest";
import { maxCanvasPositions } from "@/server/generation/pipeline/creative-brief";

/**
 * The layout must adapt across the full real-world range — a single role
 * up to the 126 titles across 19 departments in the Halliburton reference
 * — without either wasting the canvas on small ads or producing
 * unreadable type on large ones.
 */
describe("Creative Brief position scaling", () => {
  it("prints every role in full for small requirements", () => {
    expect(maxCanvasPositions(1)).toBe(1);
    expect(maxCanvasPositions(5)).toBe(5);
    expect(maxCanvasPositions(6)).toBe(6);
  });

  it("still prints mid-size requirements in full", () => {
    expect(maxCanvasPositions(12)).toBe(12);
  });

  it("caps large requirements rather than shrinking type indefinitely", () => {
    expect(maxCanvasPositions(20)).toBe(12);
    expect(maxCanvasPositions(30)).toBe(12);
  });

  it("caps very large requirements, where the true total carries the message", () => {
    expect(maxCanvasPositions(50)).toBe(10);
    expect(maxCanvasPositions(126)).toBe(10);
  });

  it("never returns more lines than there are positions", () => {
    for (const total of [1, 2, 5, 6, 7, 12, 13, 20, 31, 50, 126]) {
      expect(maxCanvasPositions(total)).toBeLessThanOrEqual(total);
      expect(maxCanvasPositions(total)).toBeGreaterThan(0);
    }
  });
});
