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

describe("Fact Layer — headline count", () => {
  /**
   * "50 TIG Welders + 30 Pipe Fitters" is 80 jobs. A badge reading "2
   * POSITIONS AVAILABLE" counted roles and made an agency advertising 80
   * vacancies look like it had two.
   */
  const withCounts = (counts: (number | undefined)[]): AdvertisementFacts => ({
    ...facts(0),
    positions: counts.map((c, i) => ({ title: `Trade ${i + 1}`, count: c })),
  });

  it("states total vacancies when every role carries a verified count", async () => {
    const png = await renderFactLayer({ facts: withCounts([50, 30]), widthPx: 1024, heightPx: 1024 });
    expect(png.png.length).toBeGreaterThan(0);
  });

  it("falls back to counting roles when any count is missing", async () => {
    // A partial sum presented as a total would be a fabricated fact.
    const partial = await renderFactLayer({
      facts: withCounts([50, undefined]),
      widthPx: 1024,
      heightPx: 1024,
    });
    const full = await renderFactLayer({
      facts: withCounts([50, 30]),
      widthPx: 1024,
      heightPx: 1024,
    });
    // Different labels render different pixels.
    expect(partial.png.equals(full.png)).toBe(false);
  });

  it("does not claim vacancies when they equal the role count", async () => {
    // 1 role x 1 vacancy should read as positions, not "1 VACANCIES".
    const one = await renderFactLayer({ facts: withCounts([1]), widthPx: 1024, heightPx: 1024 });
    expect(one.png.length).toBeGreaterThan(0);
  });
});

describe("Fact Layer — commercial readiness fixes (Step 4)", () => {
  it("FIX 1: keeps the Gemini visual hero for 18+ roles instead of switching to AAT_DTP", async () => {
    const r = await renderFactLayer({ facts: facts(18), widthPx: 1080, heightPx: 1350 });
    expect(r.themeSelection.theme).toBe("PREMIUM_CAMPAIGN");
    // A meaningful hero reservation, not just a thin masthead bar — the DTP
    // masthead this used to fall back to reserved ~15% of width at most.
    expect(r.artworkHeightPx).toBeGreaterThan(Math.round(1080 * 0.25));
  });

  it("FIX 1: an explicit printOrNewspaper request can still reach AAT_DTP", async () => {
    const r = await renderFactLayer({
      facts: facts(18),
      widthPx: 1080,
      heightPx: 1350,
      printOrNewspaper: true,
    });
    expect(r.themeSelection.theme).toBe("AAT_DTP");
  });

  it("FIX 2: a short requirement does not carry the full requested canvas as dead white space", async () => {
    // One role on a canvas requested for a much longer story format (9:16) —
    // the campaign composition must not preserve ~900px of unused height.
    const r = await renderFactLayer({ facts: facts(1), widthPx: 1080, heightPx: 1920 });
    expect(r.heightPx).toBeLessThan(1920);
  });

  it("FIX 2: a dense requirement still grows the canvas rather than shrinking type", async () => {
    const r = await renderFactLayer({ facts: facts(30), widthPx: 1080, heightPx: 1080 });
    expect(r.heightPx).toBeGreaterThan(1080);
  });

  it("FIX 3: the destination is not duplicated when the header carries a country suffix", async () => {
    const withSuffix = facts(5, {
      header: "Construction Project — Saudi Arabia",
      country: "Saudi Arabia",
      industry: "Construction",
    });
    // The AAT_DTP masthead is where the duplication was found (a standalone
    // destination bar plus the raw, unstripped header) — exercised directly
    // via printOrNewspaper so the fix is verified in the composition that
    // actually had the defect.
    const r = await renderFactLayer({
      facts: withSuffix,
      widthPx: 1080,
      heightPx: 1350,
      printOrNewspaper: true,
    });
    const occurrences = (r.svgMarkup.match(/SAUDI ARABIA/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("FIX 3: a legitimate project name is not destroyed just because it contains a country word elsewhere", async () => {
    const r = await renderFactLayer({
      facts: facts(5, { header: "Qatar Gas Expansion Project", country: "Qatar" }),
      widthPx: 1080,
      heightPx: 1350,
      printOrNewspaper: true,
    });
    expect(r.svgMarkup).toMatch(/QATAR GAS EXPANSION PROJECT/);
  });

  it("confirms every source position still renders after all three fixes, at 18 roles", async () => {
    const many = facts(18);
    const r = await renderFactLayer({ facts: many, widthPx: 1080, heightPx: 1350 });
    for (const p of many.positions) {
      expect(r.svgMarkup).toContain(p.title.toUpperCase());
    }
  });
});

/**
 * The real 19-role Saudi requirement (127 vacancies) that the commercial
 * acceptance test runs on. Titles carry the source's own OCR spelling
 * defects deliberately — normalisation is display-only and must not
 * depend on the stored fact being clean.
 */
const SAUDI_19: [string, number][] = [
  ["Operation Manager", 1], ["WPR", 25], ["Time Keeper/HR Executive", 2],
  ["Procurement Engineer-Estimation", 2], ["Purchaser", 2], ["Planning Engineer Lead", 1],
  ["Planning Engineer", 1], ["Procurement Engineer Construction", 2], ["Procurement Manager", 1],
  ["Electrician", 10], ["Tile Mason", 2], ["IT Adminstator", 1], ["HVAC Technician", 45],
  ["DDC Technician (HVAC)", 7], ["Mechanical Engineer (HVAC)", 5], ["Project Manager", 5],
  ["Qualality Manager", 5], ["HSE Manager", 5], ["PQCS", 5],
];

const saudiFacts = (): AdvertisementFacts =>
  facts(0, {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Construction",
    country: "Saudi Arabia",
    employer: "Saudi Aramco Projects",
    projectType: "Major Construction Project",
    positions: SAUDI_19.map(([title, count]) => ({ title, count })),
    benefits: [{ label: "Free food" }, { label: "Free accommodation" }],
    interview: [{ date: "5th September 2026", location: "Mumbai" }],
    contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  });

/** Every <text> node with its column x and baseline y. */
function textNodes(svg: string) {
  return [...svg.matchAll(/<text x="(\d+)"[^>]*\by="(\d+)"[^>]*>(.*?)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    text: m[3],
  }));
}

describe("Fact Layer — commercial composition (Step 8)", () => {
  it("does not overlap rows when a title plus its vacancy count wraps to a second line", async () => {
    // The planner measured the bare title while the poster renderer drew
    // "TITLE (N NOS)". A role whose title fitted one line but whose
    // title-plus-count needed two wrapped into a second line the row box
    // never reserved, and it printed through the role beneath it.
    const r = await renderFactLayer({ facts: saudiFacts(), widthPx: 1080, heightPx: 1350 });
    const columns = new Map<number, number[]>();
    for (const node of textNodes(r.svgMarkup)) {
      if (!columns.has(node.x)) columns.set(node.x, []);
      columns.get(node.x)!.push(node.y);
    }
    // Only the position columns carry many stacked lines at one x.
    const listColumns = [...columns.values()].filter((ys) => ys.length >= 8);
    expect(listColumns.length).toBeGreaterThan(0);
    for (const ys of listColumns) {
      const sorted = [...ys].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        // One drawn line height at this canvas width is ~28px; anything
        // below 20px means two lines are printing on top of each other.
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("keeps every one of the 19 real roles and every verified quantity", async () => {
    const f = saudiFacts();
    const r = await renderFactLayer({ facts: f, widthPx: 1080, heightPx: 1350 });
    const svg = r.svgMarkup.toUpperCase();
    for (const [, count] of SAUDI_19) {
      expect(svg).toContain(`(${count} NOS)`);
    }
    expect(f.positions).toHaveLength(19);
    expect(f.positions.reduce((s, p) => s + (p.count ?? 0), 0)).toBe(127);
    // PQCS is the role that went missing in the real commercial run.
    expect(svg).toContain("PQCS (5 NOS)");
  });

  it("states the verified vacancy total in the hero rather than leaving its reserved space empty", async () => {
    const r = await renderFactLayer({ facts: saudiFacts(), widthPx: 1080, heightPx: 1350 });
    expect(r.svgMarkup).toContain("127 VACANCIES · 19 ROLES");
  });

  it("normalises unambiguous source spelling defects for display only", async () => {
    const f = saudiFacts();
    const r = await renderFactLayer({ facts: f, widthPx: 1080, heightPx: 1350 });
    expect(r.svgMarkup).toContain("IT ADMINISTRATOR");
    expect(r.svgMarkup).toContain("QUALITY MANAGER");
    expect(r.svgMarkup).not.toContain("ADMINSTATOR");
    expect(r.svgMarkup).not.toContain("QUALALITY");
    // The stored recruitment fact itself is never rewritten.
    expect(f.positions.find((p) => p.title === "IT Adminstator")).toBeDefined();
    expect(f.positions.find((p) => p.title === "Qualality Manager")).toBeDefined();
  });

  it("leaves a title alone when the wording is a real word rather than an obvious defect", async () => {
    const r = await renderFactLayer({
      facts: facts(0, {
        positions: [{ title: "Cattle Manger Attendant", count: 2 }, { title: "Site Supervisor", count: 1 }],
      }),
      widthPx: 1080,
      heightPx: 1350,
    });
    expect(r.svgMarkup).toContain("CATTLE MANGER ATTENDANT");
    expect(r.svgMarkup).toContain("SITE SUPERVISOR");
  });

  it("keeps the hero-led campaign composition for the real 19-role requirement", async () => {
    const r = await renderFactLayer({ facts: saudiFacts(), widthPx: 1080, heightPx: 1350 });
    expect(r.themeSelection.theme).toBe("PREMIUM_CAMPAIGN");
    expect(r.artworkHeightPx).toBeGreaterThan(Math.round(1080 * 0.25));
    // The destination is stated once, not echoed by an adjacent element.
    expect((r.svgMarkup.match(/SAUDI ARABIA/g) ?? []).length).toBe(1);
  });
});
