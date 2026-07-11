import { describe, expect, it } from "vitest";
import { classifyDensity } from "@/server/generation/density-classification.service";

describe("classifyDensity — Advertisement Density Intelligence", () => {
  it("1 critical position -> LOW", () => {
    expect(classifyDensity([{ title: "Site Engineer", count: 1 }])).toBe("LOW");
  });

  it("5 positions (moderate headcount) -> MEDIUM", () => {
    expect(
      classifyDensity([
        { title: "Welder", count: 2 },
        { title: "Fitter", count: 1 },
        { title: "Electrician", count: 1 },
        { title: "Rigger", count: 1 },
      ]),
    ).toBe("MEDIUM");
  });

  it("20-30 positions (high headcount) -> HIGH", () => {
    const positions = Array.from({ length: 8 }, (_, i) => ({ title: `Trade ${i}`, count: 3 }));
    expect(classifyDensity(positions)).toBe("HIGH");
  });

  it("a single position with a very large headcount is still HIGH, not LOW", () => {
    expect(classifyDensity([{ title: "Laborer", count: 100 }])).toBe("HIGH");
  });

  it("many distinct low-headcount positions push density up even at low total headcount", () => {
    const positions = Array.from({ length: 10 }, (_, i) => ({ title: `Trade ${i}`, count: 1 }));
    expect(classifyDensity(positions)).toBe("HIGH");
  });

  it("treats a position with no explicit count as headcount 1", () => {
    expect(classifyDensity([{ title: "Manager" }])).toBe("LOW");
  });

  it("never forces a high-density requirement to read as LOW or MEDIUM", () => {
    const positions = Array.from({ length: 25 }, (_, i) => ({ title: `Position ${i}`, count: 1 }));
    expect(classifyDensity(positions)).toBe("HIGH");
  });
});
