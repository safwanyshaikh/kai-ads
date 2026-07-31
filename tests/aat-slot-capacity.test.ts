import { describe, it, expect } from "vitest";
import { renderFactLayer, LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const DPI = 300;
const cm = (v: number) => Math.round((v * DPI) / 2.54);

const TRADES = [
  "Instrument Technician", "Electrical Technician", "Mechanical Technician", "Rigger",
  "Scaffolder", "Welder 6G", "Pipe Fitter", "Mason", "Steel Fixer", "Painter",
  "Insulator", "Ductman", "HVAC Technician", "AC Technician", "Fire Watcher",
  "Valve Technician", "Crane Operator", "Forklift Operator", "Store Keeper", "Safety Officer",
];

function facts(n: number, salary: "none" | "same" | "varied"): AdvertisementFacts {
  return {
    header: "URGENT REQUIREMENT — SAUDI ARABIA",
    agencyName: "Al Yousuf Enterprises LLP",
    employer: "Refinery Shutdown",
    industry: "Oil & Gas",
    country: "SAUDI ARABIA",
    positions: Array.from({ length: n }, (_, i) => ({
      title: TRADES[i % TRADES.length],
      count: (i % 9) + 2,
      ...(salary === "none"
        ? {}
        : { salary: salary === "same" ? "SAR 1,500" : `SAR ${1400 + (i % 8) * 250}` }),
    })),
    benefits: [{ label: "Free Food" }, { label: "Accommodation" }],
    interview: [],
    contact: { phone: "+91 86559 60415", email: "jobs@alyousufent.com" },
    raLicenseId: "B-0655/MUM/PER",
  } as unknown as AdvertisementFacts;
}

const slot = (wCm: number, hCm: number) => ({ widthPx: cm(wCm), heightPx: cm(hCm) });

describe("AAT slot — the booked size is honoured exactly", () => {
  it("returns the booked height, never a taller canvas", async () => {
    const s = slot(13.5, 12.3);
    const r = await renderFactLayer({
      facts: facts(20, "varied"), ...s, printOrNewspaper: true, dpi: DPI,
    });
    // Outside print the canvas is allowed to grow; inside a bought slot it
    // is not — an oversized image is rejected at the newspaper desk.
    expect(r.heightPx).toBe(s.heightPx);
  });

  it("fails with an explicit capacity report rather than shrinking below legibility", async () => {
    // Far more roles than a small slot can hold at 7pt.
    const s = slot(13.5, 8.5);
    await expect(
      renderFactLayer({ facts: facts(120, "varied"), ...s, printOrNewspaper: true, dpi: DPI }),
    ).rejects.toBeInstanceOf(LayoutCapacityError);
  });

  it("names the shortfall so the agency knows to book a larger slot", async () => {
    const s = slot(13.5, 8.5);
    await expect(
      renderFactLayer({ facts: facts(120, "varied"), ...s, printOrNewspaper: true, dpi: DPI }),
    ).rejects.toThrow(/Short by \d+px|book a taller slot/i);
  });
});

describe("AAT slot — physical typography", () => {
  it("refuses a narrow column that could only be filled with sub-7pt type", async () => {
    // 4.3cm wide: a width-relative floor made this claim to hold 90 roles at
    // under 2pt. With a physical floor it must refuse.
    const s = slot(4.3, 9.5);
    await expect(
      renderFactLayer({ facts: facts(90, "varied"), ...s, printOrNewspaper: true, dpi: DPI }),
    ).rejects.toBeInstanceOf(LayoutCapacityError);
  });
});

describe("AAT slot — salaries are never merged", () => {
  it("keeps the salary column when roles carry DIFFERENT salaries", async () => {
    // Tight slot, varied salaries: collapsing them into one figure would
    // leave a candidate unable to tell which role pays what, so the engine
    // must fail on capacity instead of merging.
    const s = slot(13.5, 8.5);
    await expect(
      renderFactLayer({ facts: facts(60, "varied"), ...s, printOrNewspaper: true, dpi: DPI }),
    ).rejects.toBeInstanceOf(LayoutCapacityError);
  });

  it("may state the salary once when every role genuinely shares it", async () => {
    // Identical salaries across all roles: stating it once is a faithful
    // grouping, not a merge, and it buys the depth the slot needs. Asserted
    // as a relationship rather than a fixed count, so the invariant holds as
    // typography is polished.
    const s = slot(13.5, 12.3);
    const COUNT = 24; // beyond what varied salaries fit in this slot

    await expect(
      renderFactLayer({ facts: facts(COUNT, "varied"), ...s, printOrNewspaper: true, dpi: DPI }),
    ).rejects.toBeInstanceOf(LayoutCapacityError);

    const shared = await renderFactLayer({
      facts: facts(COUNT, "same"), ...s, printOrNewspaper: true, dpi: DPI,
    });
    expect(shared.heightPx).toBe(s.heightPx);
  });
});

describe("AAT slot — ink", () => {
  it("renders single-ink without changing the layout", async () => {
    const s = slot(13.5, 12.3);
    const colour = await renderFactLayer({
      facts: facts(20, "varied"), ...s, printOrNewspaper: true, dpi: DPI, ink: "COLOUR",
    });
    const mono = await renderFactLayer({
      facts: facts(20, "varied"), ...s, printOrNewspaper: true, dpi: DPI, ink: "SINGLE_INK",
    });
    // Ink is a palette substitution, not a second layout.
    expect(mono.heightPx).toBe(colour.heightPx);
    expect(mono.artworkHeightPx).toBe(colour.artworkHeightPx);
    expect(mono.png.equals(colour.png)).toBe(false);
  });
});
