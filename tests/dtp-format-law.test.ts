import { describe, expect, it } from "vitest";
import { renderFactLayer, LayoutCapacityError } from "@/server/generation/pipeline/fact-layer";
import { isApprovedDtpWidthPx, nearestApprovedDtpSlot, cmToPx, DTP_APPROVED_COLUMN_SLOTS } from "@/lib/dtp-format-law";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * DTP / PRINT FORMAT LAW (LOCKED, 2026-08): the renderer must select an
 * approved physical publication slot before rendering — never an
 * arbitrary giant canvas. Assignments Abroad Times appointment-ad
 * column widths: 2/4/6/8/10 columns = 6.0/12.7/19.4/26.1/32.8cm.
 */
function facts(count: number): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    positions: Array.from({ length: count }, (_, i) => ({ title: `Field Professional Level ${i + 1}` })),
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };
}

describe("dtp-format-law — approved column widths", () => {
  it("recognises all five approved slots at the default 300dpi", () => {
    for (const slot of DTP_APPROVED_COLUMN_SLOTS) {
      const px = cmToPx(slot.widthCm);
      expect(isApprovedDtpWidthPx(px)).toBe(true);
    }
  });

  it("rejects an arbitrary width that matches no approved slot", () => {
    expect(isApprovedDtpWidthPx(1080)).toBe(false);
  });

  it("nearestApprovedDtpSlot never silently substitutes — it only informs the rejection message", () => {
    const nearest = nearestApprovedDtpSlot(cmToPx(6.0) + 5);
    expect(nearest.columns).toBe(2);
    expect(nearest.widthCm).toBe(6.0);
  });
});

describe("fact-layer — print must select an approved physical slot", () => {
  it("renders normally at an approved column width", async () => {
    const r = await renderFactLayer({
      facts: facts(10),
      widthPx: cmToPx(12.7), // 4 columns
      heightPx: 1500,
      printOrNewspaper: true,
    });
    expect(r.themeSelection.theme).toBe("AAT_DTP");
    expect(r.heightPx).toBe(1500);
  });

  it("fails closed for an unapproved arbitrary width — never invents a giant canvas", async () => {
    let caught: unknown;
    try {
      await renderFactLayer({
        facts: facts(10),
        widthPx: 1080,
        heightPx: 1500,
        printOrNewspaper: true,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityError);
    expect((caught as Error).message).toMatch(/not an approved DTP column width/);
  });

  it("respects an explicit non-default DPI when validating the slot", async () => {
    // 6.0cm at 150dpi is a different px count than at 300dpi — the
    // approval check must use the request's own DPI, not a hard-coded one.
    const widthAt150 = cmToPx(6.0, 150);
    const r = await renderFactLayer({
      facts: facts(5),
      widthPx: widthAt150,
      heightPx: 1200,
      printOrNewspaper: true,
      dpi: 150,
    });
    expect(r.themeSelection.theme).toBe("AAT_DTP");
  });
});
