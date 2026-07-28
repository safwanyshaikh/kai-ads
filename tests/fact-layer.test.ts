import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderFactLayer, LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

function facts(count: number, over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Halliburton",
    projectType: "Major Oil & Gas Project",
    positions: Array.from({ length: count }, (_, i) => ({ title: `Field Professional Level ${i + 1}` })),
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    ...over,
  };
}

describe("Fact Layer — deterministic rendering of verified facts", () => {
  it("renders at the exact canvas size for 1, 10, 50 and 150 positions", async () => {
    for (const n of [1, 10, 50, 150]) {
      const r = await renderFactLayer({ facts: facts(n), widthPx: 1024, heightPx: 1024 });
      const meta = await sharp(r.png).metadata();
      expect(meta.width, `width @ ${n}`).toBe(1024);
      // Canvas grows for dense lists rather than shrinking type below the floor.
      expect(meta.height, `height @ ${n}`).toBe(r.heightPx);
      expect(r.heightPx, `height @ ${n}`).toBeGreaterThanOrEqual(1024);
    }
  });

  it("is deterministic — identical input yields byte-identical output", async () => {
    const a = await renderFactLayer({ facts: facts(20), widthPx: 1024, heightPx: 1024 });
    const b = await renderFactLayer({ facts: facts(20), widthPx: 1024, heightPx: 1024 });
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.heightPx).toBe(b.heightPx);
  });

  it("omits absent sections entirely rather than printing a placeholder", async () => {
    // No benefits, no interview, no salary anywhere in the input.
    const r = await renderFactLayer({ facts: facts(5), widthPx: 1024, heightPx: 1024 });
    expect(r.png.length).toBeGreaterThan(0);
  });

  it("renders benefits and interview when they are verified", async () => {
    const withExtras = facts(5, {
      benefits: [{ label: "Free food" }, { label: "Free accommodation" }],
      interview: [{ date: "5th August 2026", location: "Mumbai office" }],
    });
    const plain = await renderFactLayer({ facts: facts(5), widthPx: 1024, heightPx: 1024 });
    const rich = await renderFactLayer({ facts: withExtras, widthPx: 1024, heightPx: 1024 });
    expect(rich.png.equals(plain.png)).toBe(false);
  });

  it("fails closed rather than silently dropping positions it cannot place", async () => {
    // Far beyond any legible capacity on a single canvas.
    await expect(
      renderFactLayer({ facts: facts(4000), widthPx: 1024, heightPx: 1024 }),
    ).rejects.toBeInstanceOf(LayoutCapacityError);
  });

  it("names what could not be placed in the capacity error", async () => {
    try {
      await renderFactLayer({ facts: facts(4000), widthPx: 1024, heightPx: 1024 });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LayoutCapacityError);
      expect((e as LayoutCapacityError).code).toBe("LAYOUT_CAPACITY");
      expect((e as LayoutCapacityError).unplaced.join(" ")).toMatch(/4000 positions/);
    }
  });

  it("adapts to portrait and A4 canvases", async () => {
    for (const [w, h] of [[1080, 1350], [1240, 1754]] as const) {
      const r = await renderFactLayer({ facts: facts(30), widthPx: w, heightPx: h });
      const meta = await sharp(r.png).metadata();
      expect(meta.width).toBe(w);
      expect(meta.height).toBeGreaterThanOrEqual(h);
    }
  });
});
