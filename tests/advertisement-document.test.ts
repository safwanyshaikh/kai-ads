import { describe, expect, it } from "vitest";
import {
  ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION,
  buildAdvertisementDocument,
  documentDna,
  DocumentSchemaError,
  parseAdvertisementDocument,
  serialiseAdvertisementDocument,
} from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import { resolveRegionIntelligence } from "@/server/generation/dna/region-intelligence";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const facts: AdvertisementFacts = {
  header: "Urgent Requirement — Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger Middle East",
  positions: [
    { title: "TIG Welder 6G", count: 20, salary: "SAR 2,500" },
    { title: "Pipe Fitter", count: 15, salary: "SAR 2,000" },
  ],
  benefits: [{ label: "Free Food" }],
  interview: [{ date: "12th September 2026", location: "Mumbai" }],
  contact: { phone: "+91 86559 60415" },
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "B-0655/MUM/PER",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
};

const agency = buildAgencyDna({
  id: "agency-1",
  name: "Al Yousuf Enterprises LLP",
  registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  officialEmail: "jobs@alyousuf.test",
});

const format = { key: "KAI-SQ", widthPx: 1080, heightPx: 1080, dpi: null, printOrNewspaper: false };

type BuildInput = Parameters<typeof buildAdvertisementDocument>[0];

function build(over: Partial<BuildInput> = {}) {
  return buildAdvertisementDocument({ advertisementId: "ad-1", facts, agency, format, ...over });
}

describe("Advertisement JSON", () => {
  it("resolves the Design DNA once, at creation, and persists the choice", () => {
    const doc = build();
    expect(doc.design.dnaId).toBeTruthy();
    expect(doc.design.dnaReason).toBeTruthy();
    // Rebuilding the same advertisement must not produce a different poster.
    expect(build().design.dnaId).toBe(doc.design.dnaId);
  });

  it("starts at revision 1 with no artwork yet", () => {
    const doc = build();
    expect(doc.revision).toBe(1);
    expect(doc.artwork).toEqual({ source: "NONE", brief: null, assetRef: null });
    expect(doc.schemaVersion).toBe(ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION);
  });

  it("honours an explicit design choice", () => {
    const doc = build({ preferredDnaId: "CP-04" });
    expect(doc.design.dnaId).toBe("CP-04");
    expect(doc.design.dnaFromOverride).toBe(true);
    expect(documentDna(doc).label).toBe("White Paper");
  });

  it("carries objective region intelligence without altering a single fact", () => {
    const region = resolveRegionIntelligence({
      country: "Saudi Arabia",
      industry: "Oil & Gas",
      positionTitles: facts.positions.map((p) => p.title),
    });
    const doc = build({ region });
    expect(doc.region?.corridor?.label).toBe("Saudi Arabia");
    expect(doc.facts).toEqual(facts);
  });

  it("round-trips through JSON unchanged", () => {
    const doc = build();
    const parsed = parseAdvertisementDocument(JSON.parse(serialiseAdvertisementDocument(doc)));
    expect(parsed).toEqual(doc);
  });
});

describe("Advertisement JSON is validated on the way in, not trusted", () => {
  it("rejects a document referencing a design that no longer exists", () => {
    const doc = { ...build(), design: { ...build().design, dnaId: "GONE-01" } };
    expect(() => parseAdvertisementDocument(doc)).toThrow(DocumentSchemaError);
  });

  it("refuses a document written by a newer build rather than guessing at it", () => {
    const doc = { ...build(), schemaVersion: ADVERTISEMENT_DOCUMENT_SCHEMA_VERSION + 1 };
    expect(() => parseAdvertisementDocument(doc)).toThrow(/newer than this build understands/);
  });

  it("names every problem at once instead of failing on the first", () => {
    try {
      parseAdvertisementDocument({ schemaVersion: 1 });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentSchemaError);
      expect((e as DocumentSchemaError).problems.length).toBeGreaterThan(2);
    }
  });

  it("rejects a non-object outright", () => {
    expect(() => parseAdvertisementDocument(null)).toThrow(DocumentSchemaError);
    expect(() => parseAdvertisementDocument("{}")).toThrow(DocumentSchemaError);
  });
});
