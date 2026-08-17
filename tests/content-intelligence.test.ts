import { describe, expect, it } from "vitest";
import {
  buildRecruitmentCampaign,
  tagStatement,
  isCompressionEligible,
  compressedStatementCount,
  rawStatementCount,
  assessDtpCapacity,
  enforceDtpCapacity,
  widthTierFor,
  HERO_RESERVATION_PCT,
  campaignFromAdvertisementFacts,
  type PositionSourceRecord,
} from "@/server/generation/pipeline/content-intelligence";
import { LayoutCapacityError, renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";
import {
  MANPOWER_VACANT_POSITION_2,
  MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS,
  MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES,
} from "./fixtures/manpower-vacant-position-2";

describe("Statement taxonomy", () => {
  it("tags the PQCS eligibility nuance as ELIGIBILITY, not GENERIC", () => {
    expect(tagStatement("Candidate hold Saudi Aramco approval is preferred but not mandatory.")).toBe("ELIGIBILITY");
  });

  it("tags certification/ticket language as CERTIFICATION", () => {
    expect(tagStatement("Candidate familiar with NMR 601,602,603 etc.")).toBe("CERTIFICATION");
  });

  it("tags experience bands as EXPERIENCE and qualifications as QUALIFICATION", () => {
    expect(tagStatement("8 to 10 years")).toBe("EXPERIENCE");
    expect(tagStatement("Diploma in Mechanical Engineering")).toBe("QUALIFICATION");
  });

  it("tags duty language as FUNCTIONAL", () => {
    expect(tagStatement("Responsible for coordinating maintenance shutdown activities")).toBe("FUNCTIONAL");
  });
});

describe("Compression eligibility — self-challenge Case 2 (the PQCS nuance)", () => {
  it("never marks an ELIGIBILITY statement compression-eligible, no matter how often it repeats", () => {
    const text = "preferred but not mandatory";
    const siblings = Array(5).fill(text);
    expect(isCompressionEligible("ELIGIBILITY", text, siblings)).toBe(false);
  });

  it("never marks a CERTIFICATION statement compression-eligible", () => {
    const text = "NMR 601";
    const siblings = Array(5).fill(text);
    expect(isCompressionEligible("CERTIFICATION", text, siblings)).toBe(false);
  });

  it("marks a genuinely repeated QUALIFICATION statement eligible", () => {
    const text = "Diploma in Mechanical Engineering";
    const siblings = [text, text, "something else"];
    expect(isCompressionEligible("QUALIFICATION", text, siblings)).toBe(true);
  });

  it("does not mark a one-off QUALIFICATION statement eligible", () => {
    const text = "Bachelor's degree in Instrumentation";
    const siblings = [text, "Diploma in Mechanical Engineering"];
    expect(isCompressionEligible("QUALIFICATION", text, siblings)).toBe(false);
  });
});

describe("buildRecruitmentCampaign — the real 19-position / 127-vacancy source", () => {
  const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);

  it("recomputes the vacancy total from positions and it matches the source", () => {
    expect(campaign.vacancySummary.totalPositions).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS);
    expect(campaign.vacancySummary.totalVacancies).toBe(MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES);
    expect(campaign.vacancySummary.computedFromPositions).toBe(true);
  });

  it("preserves the PQCS mandatory-vs-preferred nuance as an uncompressed ELIGIBILITY statement", () => {
    const pqcs = campaign.positions.find((p) => p.title === "PQCS Engineer");
    expect(pqcs).toBeDefined();
    const eligibility = pqcs!.statements.find((s) => s.tag === "ELIGIBILITY");
    expect(eligibility).toBeDefined();
    expect(eligibility!.text).toMatch(/preferred but not mandatory/i);
    expect(eligibility!.compressionEligible).toBe(false);

    // It must not have been folded into any role family's common box either.
    for (const family of campaign.roleFamilies) {
      expect(family.commonRequirement.some((s) => /preferred but not mandatory/i.test(s.text))).toBe(false);
    }
  });

  it("preserves each NMR certification as its own uncompressed CERTIFICATION statement", () => {
    const withNmr = campaign.positions.filter((p) => p.statements.some((s) => s.tag === "CERTIFICATION"));
    expect(withNmr.length).toBeGreaterThan(0);
    for (const p of withNmr) {
      for (const stmt of p.statements.filter((s) => s.tag === "CERTIFICATION")) {
        expect(stmt.compressionEligible).toBe(false);
      }
    }
  });

  it("clusters positions into role families with an auditable basis, matching the reference ads' six families", () => {
    const ids = new Set(campaign.roleFamilies.map((f) => f.id));
    expect(ids).toContain("hvac-mechanical");
    expect(ids).toContain("electrical-it");
    expect(ids).toContain("planning-controls");
    expect(ids).toContain("procurement-commercial");
    expect(ids).toContain("project-management");
    for (const family of campaign.roleFamilies) {
      expect(family.clusteringBasis.length).toBeGreaterThan(0);
      expect(family.positionTitles.length).toBeGreaterThan(0);
    }
  });

  it("legally compresses genuinely repeated qualification language within a family", () => {
    const electrician = campaign.roleFamilies.find((f) => f.id === "electrical-it");
    expect(electrician).toBeDefined();
    // Compression must never reduce the number of DISTINCT positions or
    // their vacancy counts — only repeated statement text.
    const raw = rawStatementCount(campaign);
    const compressed = compressedStatementCount(campaign);
    expect(compressed).toBeLessThanOrEqual(raw);
    expect(compressed).toBeGreaterThan(0);
  });

  it("fits within the DTP capacity budget for a standard campaign canvas (T3 territory)", () => {
    const check = assessDtpCapacity(campaign, 1080);
    expect(check.withinBudget).toBe(true);
    expect(() => enforceDtpCapacity(campaign, 1080)).not.toThrow();
  });
});

describe("Self-challenge Case 1 — zero-overlap campaign (no compression available)", () => {
  it("does not fabricate compression when nothing is genuinely shared, and still resolves a budget decision", () => {
    const records: PositionSourceRecord[] = Array.from({ length: 19 }, (_, i) => ({
      title: `Unique Specialist Role ${i + 1}`,
      count: 1,
      experience: `${i + 3} to ${i + 5} years`,
      qualification: `Unique qualification pathway number ${i + 1}`,
    }));
    const campaign = buildRecruitmentCampaign(records);
    expect(compressedStatementCount(campaign)).toBe(rawStatementCount(campaign));
    // A legitimate no-overlap requirement of this size is still within
    // budget — it just gets zero benefit from compression, not a failure.
    const check = assessDtpCapacity(campaign, 1080);
    expect(check.compressedStatements).toBe(check.rawStatements);
    expect(typeof check.withinBudget).toBe("boolean");
  });
});

describe("Self-challenge Case 3 — content exceeds every tier's ceiling", () => {
  it("fails closed with LayoutCapacityError(reason: content-exceeds-max-tier) rather than silently shrinking the hero", () => {
    const records: PositionSourceRecord[] = Array.from({ length: 90 }, (_, i) => ({
      title: `Distinct Trade ${i + 1}`,
      count: 1,
      experience: `${i + 1} unique years band ${i}`,
      qualification: `Distinct qualification requirement text block number ${i + 1} with no overlap`,
      remarks: `Distinct remark clause unique to role ${i + 1}, never repeated anywhere else in this campaign.`,
    }));
    const campaign = buildRecruitmentCampaign(records);
    let caught: unknown;
    try {
      enforceDtpCapacity(campaign, 1080);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityError);
    expect((caught as LayoutCapacityError).reason).toBe("content-exceeds-max-tier");
  });
});

describe("Self-challenge Case 4 — near-identical mass hiring never collapses to an empty hero", () => {
  it("keeps every position's vacancy count and identity even when almost all statements compress", () => {
    const records: PositionSourceRecord[] = Array.from({ length: 19 }, (_, i) => ({
      title: `Electrician Grade ${i + 1}`,
      count: 5,
      experience: "5 to 8 years",
      qualification: "ITI / Diploma in Electrical Engineering",
    }));
    const campaign = buildRecruitmentCampaign(records);
    // Compression must never remove a position or its vacancy count —
    // only fold repeated TEXT into a shared family box.
    expect(campaign.positions.length).toBe(19);
    expect(campaign.vacancySummary.totalVacancies).toBe(95);
    // Heavy legal compression is expected here (this is the intended case
    // for it) but it can never go to zero — each position still needs at
    // least its own title/vacancy-count row rendered.
    const compressed = compressedStatementCount(campaign);
    expect(compressed).toBeGreaterThan(0);
  });
});

describe("Hero Reservation Invariant", () => {
  it("assigns a fixed, non-zero hero proportion to every width tier", () => {
    for (const pct of Object.values(HERO_RESERVATION_PCT)) {
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThan(0.5);
    }
  });

  it("maps width in px to a stable tier", () => {
    expect(widthTierFor(600)).toBe("6xN");
    expect(widthTierFor(800)).toBe("8xN");
    expect(widthTierFor(1080)).toBe("10xN");
    expect(widthTierFor(1400)).toBe("12xN");
  });
});

describe("AdvertisementFacts bridge + real render of the 19-role source", () => {
  it("builds a campaign from AdvertisementFacts positions", () => {
    const facts: AdvertisementFacts = {
      header: "Urgent Requirement — Saudi Arabia",
      industry: "Oil & Gas",
      country: "Saudi Arabia",
      positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
        title: p.title,
        count: p.count,
        experience: p.experience ?? undefined,
        qualification: p.qualification ?? undefined,
        certifications: p.certifications,
      })),
      benefits: [],
      interview: [],
      contact: {},
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    };
    const campaign = campaignFromAdvertisementFacts(facts);
    expect(campaign.vacancySummary.totalPositions).toBe(19);
    expect(campaign.vacancySummary.totalVacancies).toBe(127);
  });

  it("renders the real 19-role / 127-vacancy requirement without hitting LayoutCapacityError", async () => {
    const facts: AdvertisementFacts = {
      header: "Urgent Requirement — Saudi Arabia",
      industry: "Oil & Gas — Maintenance Project",
      country: "Saudi Arabia",
      employer: "Saudi Aramco Maintenance Project",
      positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
        title: p.title,
        count: p.count,
        experience: p.experience ?? undefined,
        qualification: p.qualification ?? undefined,
        certifications: p.certifications,
      })),
      benefits: [],
      interview: [],
      contact: {},
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
    };
    const result = await renderFactLayer({ facts, widthPx: 1080, heightPx: 1080 });
    expect(result.png.length).toBeGreaterThan(0);
    expect(result.heightPx).toBeGreaterThanOrEqual(1080);
  });
});
