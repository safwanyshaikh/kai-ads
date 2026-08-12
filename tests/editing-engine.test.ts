import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyEdits, EditValidationError, requiresArtworkRegeneration } from "@/server/generation/pipeline/editing";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const facts: AdvertisementFacts = {
  header: "Urgent Requirement — Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger Middle East",
  positions: [
    { title: "TIG Welder 6G", count: 20, salary: "SAR 2,500" },
    { title: "Pipe Fitter", count: 15, salary: "SAR 2,000" },
    { title: "Scaffolder", count: 10, salary: "SAR 1,800" },
  ],
  benefits: [{ label: "Free Food" }, { label: "Accommodation" }],
  interview: [{ date: "12th September 2026", location: "Mumbai" }],
  contact: { phone: "+91 86559 60415", email: "jobs@alyousuf.test" },
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "B-0655/MUM/PER",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
};

const doc = buildAdvertisementDocument({
  advertisementId: "ad-1",
  facts,
  agency: buildAgencyDna({
    id: "agency-1",
    name: "Al Yousuf Enterprises LLP",
    registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  }),
  format: { key: "KAI-SQ", widthPx: 1080, heightPx: 1080, dpi: null, printOrNewspaper: false },
});

const withArtwork = { ...doc, artwork: { source: "AI_GENERATED" as const, brief: "a refinery", assetRef: "asset-1" } };

describe("Editing edits JSON, never pixels — and never calls AI", () => {
  it("has no AI dependency at all", () => {
    // The law is enforced by the module's imports, so this is the thing
    // worth asserting: an editing path that could reach a model would
    // have to import one, and there is nowhere else for the dependency
    // to hide.
    const source = readFileSync("src/server/generation/pipeline/editing.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/getTextGenerationProvider|getImageGenerationProvider|from "@\/server\/ai/);
    expect(source).not.toMatch(/\basync\b|\bawait\b|\bfetch\(/);
  });

  it("reuses the artwork an advertisement already has", () => {
    const { document } = applyEdits(withArtwork, [
      { type: "UPDATE_POSITION", index: 0, patch: { salary: "SAR 2,900" } },
    ]);
    // The single property that makes editing free: a corrected salary does
    // not buy a new photograph.
    expect(document.artwork).toEqual(withArtwork.artwork);
    expect(requiresArtworkRegeneration()).toBe(false);
  });

  it("never mutates the document it was given", () => {
    const before = JSON.stringify(doc);
    applyEdits(doc, [{ type: "SET_HEADER", value: "Something else entirely" }]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("increments the revision once per edit, not once per operation", () => {
    const { document } = applyEdits(doc, [
      { type: "SET_HEADER", value: "New headline" },
      { type: "SET_EMPLOYER", value: "New employer" },
    ]);
    expect(document.revision).toBe(doc.revision + 1);
  });
});

describe("An edit sets exactly what the recruiter supplied", () => {
  it("clears a field when the recruiter clears it", () => {
    const { document } = applyEdits(doc, [{ type: "SET_EMPLOYER", value: null }]);
    expect(document.facts.employer).toBeNull();
  });

  it("treats whitespace as absent rather than as a value", () => {
    const stated = applyEdits(doc, [{ type: "SET_PROJECT_TYPE", value: "Refinery Shutdown 2026" }]).document;
    expect(stated.facts.projectType).toBe("Refinery Shutdown 2026");
    const cleared = applyEdits(stated, [{ type: "SET_PROJECT_TYPE", value: "   " }]).document;
    expect(cleared.facts.projectType).toBeNull();
  });

  it("refuses to blank a fact the advertisement cannot do without", () => {
    expect(() => applyEdits(doc, [{ type: "SET_HEADER", value: "  " }])).toThrow(EditValidationError);
    expect(() => applyEdits(doc, [{ type: "UPDATE_POSITION", index: 0, patch: { title: "" } }])).toThrow(
      EditValidationError,
    );
  });

  it("refuses to remove the last remaining position", () => {
    const single = { ...doc, facts: { ...facts, positions: [facts.positions[0]] } };
    expect(() => applyEdits(single, [{ type: "REMOVE_POSITION", index: 0 }])).toThrow(
      /at least one position/i,
    );
  });

  it("rejects an index that does not exist", () => {
    expect(() => applyEdits(doc, [{ type: "REMOVE_POSITION", index: 9 }])).toThrow(EditValidationError);
    expect(() => applyEdits(doc, [{ type: "MOVE_POSITION", from: 0, to: 9 }])).toThrow(EditValidationError);
  });
});

describe("The Golden Rule — editing one block never touches another", () => {
  it("leaves every other block byte-identical when one is edited", () => {
    const { document, changes } = applyEdits(doc, [
      { type: "SET_BENEFITS", benefits: [{ label: "Medical Insurance" }] },
    ]);
    expect(changes).toEqual([{ section: "BENEFITS", summary: "Benefits updated (1 listed)." }]);
    expect(document.facts.positions).toEqual(doc.facts.positions);
    expect(document.facts.interview).toEqual(doc.facts.interview);
    expect(document.facts.contact).toEqual(doc.facts.contact);
    expect(document.facts.header).toEqual(doc.facts.header);
    expect(document.design).toEqual(doc.design);
  });

  it("names the section each change belongs to", () => {
    const { changes } = applyEdits(doc, [
      { type: "SET_HEADER", value: "Refinery Shutdown 2026" },
      { type: "UPDATE_CONTACT", patch: { whatsapp: "+91 90000 00000" } },
      { type: "SET_DESIGN_DNA", dnaId: "CP-04" },
    ]);
    expect(changes.map((c) => c.section)).toEqual(["HEADER", "CONTACT", "DESIGN"]);
  });

  it("reorders positions without editing any of them", () => {
    const { document } = applyEdits(doc, [{ type: "MOVE_POSITION", from: 2, to: 0 }]);
    expect(document.facts.positions.map((p) => p.title)).toEqual([
      "Scaffolder",
      "TIG Welder 6G",
      "Pipe Fitter",
    ]);
    expect(document.facts.positions[0]).toEqual(doc.facts.positions[2]);
  });
});

describe("A no-op edit is not history", () => {
  it("reports unchanged and returns the same document", () => {
    const result = applyEdits(doc, [{ type: "SET_HEADER", value: facts.header }]);
    expect(result.unchanged).toBe(true);
    expect(result.changes).toEqual([]);
    expect(result.document).toBe(doc);
  });

  it("does not count a re-selected design as a change", () => {
    const result = applyEdits(doc, [{ type: "SET_DESIGN_DNA", dnaId: doc.design.dnaId }]);
    expect(result.unchanged).toBe(true);
  });
});

describe("Design edits", () => {
  it("switches design without touching a single fact", () => {
    const { document } = applyEdits(doc, [{ type: "SET_DESIGN_DNA", dnaId: "OG-06" }]);
    expect(document.design.dnaId).toBe("OG-06");
    expect(document.design.dnaFromOverride).toBe(true);
    expect(document.facts).toEqual(doc.facts);
  });

  it("rejects a design that is not in the library", () => {
    expect(() => applyEdits(doc, [{ type: "SET_DESIGN_DNA", dnaId: "XX-99" }])).toThrow(/Unknown Design DNA/);
  });

  it("rejects an impossible format", () => {
    expect(() => applyEdits(doc, [{ type: "SET_FORMAT", format: { widthPx: 0 } }])).toThrow(
      EditValidationError,
    );
  });
});
