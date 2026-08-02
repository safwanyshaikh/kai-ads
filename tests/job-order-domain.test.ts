import { describe, expect, it } from "vitest";
import {
  normalizeEntityName,
  normalizeEmployerName,
  normalizePositionTitle,
} from "@/lib/normalize-entity-name";
import { projectRequirement } from "@/server/services/job-order.service";
import { createAdvertisementSchema } from "@/lib/validations/advertisement";

/**
 * The permanent business domain (Task 001).
 *
 * These tests cover the projection rules — how advertisement content
 * becomes an agency's employer and demand history. They are pure and
 * need no database, because the mapping decisions here are what that
 * history will look like permanently: a rule that merges two genuinely
 * different employers, or drops a vacancy, is not recoverable later.
 *
 * The real-database behaviour of the migration itself (backfill, zero
 * data loss, 1:1 pairing) is covered by
 * tests/integration/job-order-backfill.test.ts.
 */

/** Builds validated advertisement content the same way the API boundary does. */
function content(overrides: Record<string, unknown> = {}) {
  return createAdvertisementSchema.parse({
    header: "Urgent Requirement for Saudi Arabia",
    industry: "Construction",
    country: "Saudi Arabia",
    positions: [{ title: "Scaffolder", count: 20 }],
    ...overrides,
  });
}

describe("normalizeEntityName — the de-duplication key", () => {
  it("collapses whitespace runs, trims, and case-folds", () => {
    expect(normalizeEntityName("  ABC   Contracting  ")).toBe("abc contracting");
  });

  it("treats the spellings an agency actually produces as one key", () => {
    const variants = ["ABC Contracting", "abc  contracting", " ABC Contracting ", "ABC CONTRACTING"];
    const keys = new Set(variants.map(normalizeEntityName));
    expect(keys.size).toBe(1);
  });

  it("normalizes tabs and newlines, not just spaces", () => {
    expect(normalizeEntityName("ABC\tContracting\nLLC")).toBe("abc contracting llc");
  });

  it("keeps genuinely different employers apart", () => {
    expect(normalizeEntityName("ABC Contracting")).not.toBe(normalizeEntityName("ABC Contracting LLC"));
  });

  it("does not transliterate or strip non-ASCII — a different name stays a different employer", () => {
    expect(normalizeEntityName("Al-Yousuf Enterprises")).toBe("al-yousuf enterprises");
    expect(normalizeEntityName("Türk İnşaat")).not.toBe(normalizeEntityName("Turk Insaat"));
  });
});

describe("normalizeEmployerName — absent employers link to nothing", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("returns null for %s rather than an employer named ''", (_label, value) => {
    expect(normalizeEmployerName(value)).toBeNull();
  });

  it("returns the key for a real name", () => {
    expect(normalizeEmployerName("  Bilfinger  ")).toBe("bilfinger");
  });
});

describe("normalizePositionTitle — trades aggregate, vacancies are never dropped", () => {
  it("groups spelling variants of one trade", () => {
    expect(normalizePositionTitle("Rigger III")).toBe(normalizePositionTitle("rigger  iii"));
  });

  it("returns a key rather than null for odd input, so the row is still kept", () => {
    expect(normalizePositionTitle("   ")).toBe("");
  });
});

describe("projectRequirement — advertisement content becomes the business domain", () => {
  it("carries the employer through verbatim, with a separate grouping key", () => {
    const projected = projectRequirement(content({ employer: "  ABC   Contracting  " }));
    // Display name keeps the source's own wording; only the key is folded.
    expect(projected.employerName).toBe("ABC Contracting");
    expect(projected.employerNormalizedName).toBe("abc contracting");
  });

  it("links no employer when the requirement named none", () => {
    const projected = projectRequirement(content());
    expect(projected.employerName).toBeNull();
    expect(projected.employerNormalizedName).toBeNull();
  });

  it("treats an employer given as an empty string as absent", () => {
    const projected = projectRequirement(content({ employer: "" }));
    expect(projected.employerName).toBeNull();
  });

  it("seeds the requirement's identity from the advertisement", () => {
    const projected = projectRequirement(content());
    expect(projected.title).toBe("Urgent Requirement for Saudi Arabia");
    expect(projected.industry).toBe("Construction");
    expect(projected.country).toBe("Saudi Arabia");
  });

  it("projects every position — none is dropped, merged or reordered", () => {
    const projected = projectRequirement(
      content({
        positions: [
          { title: "Scaffolder", count: 20 },
          { title: "Rigger", count: 7 },
          { title: "QC Inspector", count: 4 },
        ],
      }),
    );

    expect(projected.positions).toHaveLength(3);
    expect(projected.positions.map((p) => p.title)).toEqual(["Scaffolder", "Rigger", "QC Inspector"]);
    expect(projected.positions.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });

  it("preserves a large bulk requirement in full", () => {
    const positions = Array.from({ length: 60 }, (_, i) => ({ title: `Trade ${i}`, count: i + 1 }));
    const projected = projectRequirement(content({ positions }));

    expect(projected.positions).toHaveLength(60);
    // Total stated demand must survive the projection exactly.
    expect(projected.positions.reduce((sum, p) => sum + (p.count ?? 0), 0)).toBe(1830);
  });

  it("keeps duplicate trade lines as separate vacancies", () => {
    // Two lines for the same trade at different salaries are two real
    // lines in the requirement; collapsing them would understate demand.
    const projected = projectRequirement(
      content({
        positions: [
          { title: "Welder", count: 10, salary: "SAR 2,000" },
          { title: "Welder", count: 5, salary: "SAR 2,800" },
        ],
      }),
    );

    expect(projected.positions).toHaveLength(2);
    expect(projected.positions[0].normalizedTitle).toBe(projected.positions[1].normalizedTitle);
    expect(projected.positions.map((p) => p.salary)).toEqual(["SAR 2,000", "SAR 2,800"]);
  });

  it("keeps salary as source-verbatim text and never parses it to a number", () => {
    const projected = projectRequirement(
      content({ positions: [{ title: "Welder", salary: "SAR 3,200 + food allowance" }] }),
    );
    expect(projected.positions[0].salary).toBe("SAR 3,200 + food allowance");
  });

  it("records a missing count as null rather than inventing a headcount", () => {
    const projected = projectRequirement(content({ positions: [{ title: "Foreman" }] }));
    expect(projected.positions[0].count).toBeNull();
  });

  it("collapses blank optional fields to null so 'not stated' has one representation", () => {
    const projected = projectRequirement(
      content({ positions: [{ title: "Helper", experience: "   ", language: "" }] }),
    );
    expect(projected.positions[0].experience).toBeNull();
    expect(projected.positions[0].language).toBeNull();
  });

  it("keeps qualifications verbatim, and empty lists become null", () => {
    const withQuals = projectRequirement(
      content({ positions: [{ title: "QC", qualifications: ["ITI", "CSWIP 3.1"] }] }),
    );
    expect(withQuals.positions[0].qualifications).toEqual(["ITI", "CSWIP 3.1"]);

    const withoutQuals = projectRequirement(content({ positions: [{ title: "QC", qualifications: [] }] }));
    expect(withoutQuals.positions[0].qualifications).toBeNull();
  });

  it("carries the interview block onto the requirement, where it belongs", () => {
    const projected = projectRequirement(
      content({ interview: { date: "14 August", location: "Mumbai", mode: "in_person" } }),
    );
    expect(projected.interview).toMatchObject({ date: "14 August", location: "Mumbai" });
  });

  it("invents nothing: every projected value traces back to the input", () => {
    const input = content({ employer: "Bilfinger", positions: [{ title: "Pipe Fitter", count: 12 }] });
    const projected = projectRequirement(input);

    expect(projected.employerName).toBe(input.employer);
    expect(projected.title).toBe(input.header);
    expect(projected.positions[0].title).toBe(input.positions[0].title);
    expect(projected.positions[0].count).toBe(input.positions[0].count);
    expect(projected.positions[0].salary).toBeNull();
    expect(projected.positions[0].experience).toBeNull();
  });

  it("is deterministic — the same requirement always projects identically", () => {
    const input = content({ employer: "ABC Contracting", positions: [{ title: "Rigger", count: 9 }] });
    expect(projectRequirement(input)).toEqual(projectRequirement(input));
  });
});
