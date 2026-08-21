import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";

/**
 * POSTER COMPOSITION — the canvas is filled by content, not by reserves.
 *
 * Two mechanisms used to stretch a sparse advertisement:
 *
 *  1. The artwork band was `0.34 * W` — derived from WIDTH alone, blind
 *     to how much content sat beneath it. On a dense requirement that is
 *     a modest header; on a sparse one, where the canvas is short, the
 *     same band became 35-40% of the whole advertisement. The reader met
 *     a large empty region, the seam, and only then the recruitment
 *     message.
 *
 *  2. The canvas height was solved from PLANNED component heights, which
 *     are an upper bound. The drawn panel finished 100-150px above the
 *     trust strip on sparse requirements, and that leftover was filled
 *     with a giant 5%-opacity initial rather than removed — decoration
 *     standing in for composition.
 *
 * Both are now content-driven: the band is capped against the canvas it
 * sits on, and the panel measures its own drawn extent and re-renders
 * once at the height that extent implies.
 *
 * Tenant-neutral: every agency below is invented fixture data.
 */

const AGENCY: VerifiedAgencyProfile = {
  agencyName: "Novara HR",
  fullRegistrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
  verificationStatus: "VERIFIED",
};

function facts(n: number, over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Qatar",
    industry: "Oil & Gas",
    country: "Qatar",
    employer: null,
    positions: Array.from({ length: n }, (_, i) => ({
      title: `Technician Grade ${i + 1}`,
      count: (i % 6) + 2,
    })),
    benefits: [{ label: "Food & Accommodation" }],
    interview: [],
    urgent: true,
    contact: { phone: "+91 90000 11111" },
    agencyProfile: AGENCY,
    ...over,
  };
}

describe("The artwork band never dominates a sparse advertisement", () => {
  for (const n of [1, 3, 10]) {
    it(`${n} vacancy(s): the band stays a modest share of the canvas`, async () => {
      const r = await renderFactLayer({ facts: facts(n), widthPx: 1080, heightPx: 1350 });
      const fraction = r.artworkHeightPx / r.heightPx;
      // The defect measured 0.34W over a short canvas = 35-40%.
      expect(fraction).toBeLessThanOrEqual(0.23);
      // It never collapses either — the visual hero is still a real band.
      expect(r.artworkHeightPx).toBeGreaterThan(0);
    }, 60_000);
  }

  it("a dense requirement still keeps a genuine artwork band", async () => {
    const r = await renderFactLayer({ facts: facts(20), widthPx: 1080, heightPx: 1350 });
    // T3+ keeps its floor so the visual-hero archetype does not degrade
    // into a thin masthead over a long table.
    expect(r.artworkHeightPx).toBeGreaterThanOrEqual(Math.round(0.26 * 1080));
  }, 60_000);
});

describe("The canvas ends where the content ends", () => {
  /** Last row containing ink, scanning up from the trust strip. */
  async function lastInkRow(png: Buffer, above: number): Promise<number> {
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    for (let y = above - 1; y >= 0; y--) {
      const base = data[y * info.width + 4];
      for (let x = 0; x < info.width; x++) {
        if (Math.abs(data[y * info.width + x] - base) > 26) return y;
      }
    }
    return -1;
  }

  for (const [label, n] of [
    ["one vacancy", 1],
    ["three vacancies", 3],
    ["ten vacancies", 10],
  ] as [string, number][]) {
    it(`${label}: no stretched empty panel above the trust strip`, async () => {
      const r = await renderFactLayer({ facts: facts(n), widthPx: 1080, heightPx: 1350 });
      // The strip is the bottom band; find where content stops above it.
      const stripTop = r.heightPx - 137;
      const lastInk = await lastInkRow(r.png, stripTop);
      expect(lastInk).toBeGreaterThan(0);
      const gap = stripTop - lastInk;
      // Deliberate separation before the footer (never glued), but not the
      // 100-150px of empty panel the estimate used to leave.
      expect(gap).toBeGreaterThan(4);
      expect(gap).toBeLessThan(110);
    }, 60_000);
  }

  it("the vacancy area grows with the number of vacancies, and is not a fixed container", async () => {
    const one = await renderFactLayer({ facts: facts(1), widthPx: 1080, heightPx: 1350 });
    const three = await renderFactLayer({ facts: facts(3), widthPx: 1080, heightPx: 1350 });
    const ten = await renderFactLayer({ facts: facts(10), widthPx: 1080, heightPx: 1350 });
    expect(one.heightPx).toBeLessThan(three.heightPx);
    expect(three.heightPx).toBeLessThan(ten.heightPx);
  }, 120_000);

  it("never fills leftover panel with a decorative mark instead of removing it", async () => {
    const r = await renderFactLayer({ facts: facts(1), widthPx: 1080, heightPx: 1350 });
    // The giant 5%-opacity INITIAL that used to paper over the empty
    // panel. Matched as a text element specifically: a 0.05 gradient
    // stop elsewhere in the composition is legitimate chrome.
    expect(r.svgMarkup).not.toMatch(/<text[^>]*\sopacity="0\.05"/);
  }, 60_000);
});

describe("Every stage agrees on the settled height", () => {
  for (const n of [1, 4, 12]) {
    it(`${n} vacancy(s): measureOnly reports exactly what the render produces`, async () => {
      const measured = await renderFactLayer({
        facts: facts(n),
        widthPx: 1080,
        heightPx: 1350,
        measureOnly: true,
      });
      const drawn = await renderFactLayer({ facts: facts(n), widthPx: 1080, heightPx: 1350 });
      expect(measured.heightPx).toBe(drawn.heightPx);
      expect(measured.artworkHeightPx).toBe(drawn.artworkHeightPx);
    }, 60_000);
  }
});
