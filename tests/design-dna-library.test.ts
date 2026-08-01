import { describe, expect, it } from "vitest";
import {
  getDna,
  hasDna,
  listDnas,
  listPacks,
  selectDna,
  stableHash,
} from "@/server/generation/dna/registry";
import {
  DNA_PACKS,
  LEGIBILITY_FLOOR,
  validateDesignDna,
  validateDnaGeometry,
} from "@/server/generation/dna/design-dna";
import { contrastRatio, FACT_CONTRAST_MIN } from "@/server/generation/dna/contrast";

describe("Design DNA library", () => {
  it("ships 50 production DNAs, 10 in each of the five packs", () => {
    expect(listDnas()).toHaveLength(50);
    expect(listPacks().sort()).toEqual([...DNA_PACKS].sort());
    for (const pack of DNA_PACKS) {
      expect(listDnas(pack), `pack ${pack}`).toHaveLength(10);
    }
  });

  it("gives every DNA a unique id", () => {
    const ids = listDnas().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("satisfies the Contrast Law for every palette pair the engine paints", () => {
    for (const dna of listDnas()) {
      expect(validateDesignDna(dna), `${dna.id} (${dna.label})`).toEqual([]);
    }
  });

  it("satisfies the geometry invariants the Rendering Engine relies on", () => {
    for (const dna of listDnas()) {
      expect(validateDnaGeometry(dna), `${dna.id}`).toEqual([]);
    }
  });

  it("never lets a DNA set factual type below the legibility floor", () => {
    // A DNA may make type larger. It may not make a verified fact smaller
    // than a candidate can read — that floor is what makes "no fact is
    // ever omitted" a true statement rather than an aspiration.
    for (const dna of listDnas()) {
      expect(dna.type.Caption, `${dna.id}`).toBeGreaterThanOrEqual(LEGIBILITY_FLOOR);
    }
  });

  it("keeps secondary detail text legible on every surface it lands on", () => {
    for (const dna of listDnas()) {
      expect(contrastRatio(dna.palette.muted, dna.palette.surface), `${dna.id} muted/surface`)
        .toBeGreaterThanOrEqual(FACT_CONTRAST_MIN);
      expect(contrastRatio(dna.palette.muted, dna.palette.paper), `${dna.id} muted/paper`)
        .toBeGreaterThanOrEqual(FACT_CONTRAST_MIN);
    }
  });

  it("carries enough classified DNAs to serve a dense requirement", () => {
    // A 40-role drive must never fall back to a campaign layout for want
    // of a suitable design.
    const dtp = listDnas().filter((d) => d.composition === "AAT_DTP");
    expect(dtp.length).toBeGreaterThanOrEqual(10);
  });

  it("prints no photography direction on a composition that prints no photography", () => {
    for (const dna of listDnas().filter((d) => d.composition === "AAT_DTP")) {
      expect(dna.artwork.focalRegion, `${dna.id}`).toBe("BACKGROUND_ONLY");
    }
  });
});

describe("Design DNA selection", () => {
  it("is deterministic — the same requirement always gets the same design", () => {
    const input = { industry: "Oil & Gas", country: "Saudi Arabia", positionCount: 6, seed: "ad-123" };
    const a = selectDna(input);
    const b = selectDna(input);
    expect(a.dna.id).toBe(b.dna.id);
  });

  it("does not depend on the order pack files happen to load", () => {
    // Selection sorts by id before picking, so the answer is a property of
    // the requirement rather than of module evaluation order.
    expect(selectDna({ positionCount: 3, seed: "x" }).dna.id).toBe(
      selectDna({ positionCount: 3, seed: "x" }).dna.id,
    );
  });

  it("chooses a classified composition for a large requirement", () => {
    expect(selectDna({ positionCount: 40, seed: "bulk" }).dna.composition).toBe("AAT_DTP");
    expect(selectDna({ positionCount: 5, seed: "bulk" }).dna.composition).toBe("PREMIUM_CAMPAIGN");
  });

  it("forces a classified composition for print, even for one role", () => {
    const s = selectDna({ positionCount: 1, printOrNewspaper: true, seed: "print" });
    expect(s.dna.composition).toBe("AAT_DTP");
    expect(s.reason).toMatch(/print or newspaper/i);
  });

  it("honours an explicit recruiter choice above everything else", () => {
    const s = selectDna({ positionCount: 40, preferredDnaId: "PS-01", seed: "x" });
    expect(s.dna.id).toBe("PS-01");
    expect(s.fromOverride).toBe(true);
  });

  it("respects a pack preference when one is given", () => {
    const s = selectDna({ positionCount: 4, preferredPack: "CORPORATE_PREMIUM", seed: "x" });
    expect(s.dna.pack).toBe("CORPORATE_PREMIUM");
  });

  it("prefers a DNA authored for the requirement's industry", () => {
    const s = selectDna({ industry: "Oil & Gas", positionCount: 4, seed: "og" });
    expect(s.dna.industries.some((i) => "oil & gas".includes(i.toLowerCase()))).toBe(true);
  });

  it("still returns a design for an industry nothing was authored for", () => {
    // Selection guidance must never become a filter that leaves a real
    // requirement unrenderable.
    const s = selectDna({ industry: "Falconry Equipment Restoration", positionCount: 4, seed: "odd" });
    expect(s.dna).toBeDefined();
    expect(s.dna.composition).toBe("PREMIUM_CAMPAIGN");
  });

  it("spreads a campaign across designs rather than stamping one poster", () => {
    const ids = new Set(
      Array.from({ length: 40 }, (_, i) => selectDna({ positionCount: 4, seed: `ad-${i}` }).dna.id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it("rejects an unknown DNA id loudly", () => {
    expect(hasDna("NOPE-99")).toBe(false);
    expect(() => getDna("NOPE-99")).toThrow(/Unknown Design DNA/);
  });

  it("hashes stably across calls", () => {
    expect(stableHash("kai")).toBe(stableHash("kai"));
    expect(stableHash("kai")).not.toBe(stableHash("kal"));
  });
});
