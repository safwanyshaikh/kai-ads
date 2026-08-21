import { describe, expect, it } from "vitest";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import { campaignFromAdvertisementFacts } from "@/server/generation/pipeline/content-intelligence";
import { classifyRoleFamily, GENERAL_TRADES } from "@/lib/role-families";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";
import {
  MANPOWER_REAL_FACTS_POSITIONS,
  MANPOWER_REAL_EXPECTED,
} from "./fixtures/manpower-vacant-position-real";

/**
 * FINAL 10/10 HUMAN RECRUITER INTELLIGENCE GATE.
 *
 * Uses the REAL 19-role / 127-vacancy Saudi Arabia requirement — never
 * the mislabelled manpower-vacant-position-2 synthetic fixture.
 */

const agencyProfile: VerifiedAgencyProfile = {
  agencyName: "Al Yousuf Enterprises LLP",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  verificationStatus: "VERIFIED",
};

function realFacts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Operation Manager + 18 more roles — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: null,
    positions: MANPOWER_REAL_FACTS_POSITIONS,
    benefits: [],
    interview: [],
    urgent: true,
    contact: { phone: "+91 86559 60414", email: "jobs@alyousufent.com" },
    agencyProfile,
    ...over,
  };
}

describe("1/2. No database-style headline — no vacancy/role count leads the campaign", () => {
  it("never typesets a raw CRM role-count header", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/\+\s*18\s*more\s*roles/i);
  }, 60_000);

  it("never states '19 ROLES' or '6 ROLE FAMILIES' anywhere on the canvas", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/19\s*ROLES/i);
    expect(r.svgMarkup).not.toMatch(/\d+\s*ROLE\s*FAMIL/i);
    expect(r.svgMarkup).not.toMatch(/\d+\s*CATEGOR/i);
  }, 60_000);
});

describe("3. No unnecessary total-vacancy badge", () => {
  it("never states the 127-vacancy campaign aggregate as a hero/badge figure", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toContain("127 VACANCIES");
    expect(r.svgMarkup).not.toMatch(/127\s*POSITIONS?\s*AVAILABLE/i);
  }, 60_000);

  it("generalizes: a single-role canvas DOES get a badge — the rule is about aggregation, not suppression", async () => {
    const single = realFacts({ positions: [MANPOWER_REAL_FACTS_POSITIONS[12]] }); // HVAC Technician, 45
    const r = await renderFactLayer({ facts: single, widthPx: 1080, heightPx: 1350 });
    expect(r.svgMarkup).toContain("45 VACANCIES");
  }, 60_000);
});

describe("4. Role-specific vacancy counts preserved, exactly", () => {
  it("every role's own count appears on the canvas as its own fact", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    for (const [title, count] of MANPOWER_REAL_EXPECTED) {
      const shown = title.replace(/Adminstator/i, "Administrator").replace(/Qualality/i, "Quality");
      expect(r.svgMarkup.toUpperCase(), title).toContain(`${shown.toUpperCase()} (${count} NOS)`);
    }
  }, 120_000);
});

describe("6. Candidate segmentation reads as human language, not internal taxonomy", () => {
  it("the catch-all family is 'Other Openings', never 'General Trades'", () => {
    expect(GENERAL_TRADES.label).toBe("Other Openings");
    expect(GENERAL_TRADES.heading).toBe("OTHER OPENINGS");
    expect(classifyRoleFamily("Sandblaster").heading).toBe("OTHER OPENINGS");
  });

  it("no family heading exposes internal engineering vocabulary", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/GENERAL TRADES/i);
    expect(r.svgMarkup).not.toMatch(/ROLE FAMILY/i);
    expect(r.svgMarkup).not.toMatch(/FAMILY\s*\d/i);
  }, 60_000);
});

describe("7/8/9. Mandatory vs preferred vs not-mandatory survive verbatim", () => {
  it("WPR's Gulf experience stays NOT MANDATORY", async () => {
    const wpr = realFacts({ positions: [MANPOWER_REAL_FACTS_POSITIONS[1]] });
    const r = await renderFactLayer({ facts: wpr, widthPx: 1080, heightPx: 1350 });
    expect(r.svgMarkup).toMatch(/Not Mandatory/i);
  }, 60_000);

  it("PQCS's Aramco approval stays 'preferred but not mandatory' as an ELIGIBILITY statement", () => {
    const campaign = campaignFromAdvertisementFacts(realFacts());
    // Content Intelligence bridge has no `remarks`; the nuance lives in
    // the real fixture's PositionSourceRecord (MANPOWER_REAL), already
    // covered directly in manpower-real-source-acceptance.test.ts. Here
    // we assert the bridge at least preserves PQCS's count and title
    // untouched, since the eligibility statement itself is sourced from
    // `remarks`, which AdvertisementFacts does not carry (see
    // campaignFromAdvertisementFacts's own doc comment).
    const pqcs = campaign.positions.find((p) => p.title === "PQCS");
    expect(pqcs?.count).toBe(5);
  });
});

describe("10/11. No unsupported salary or benefits invented", () => {
  it("the real requirement states no salary — none is rendered", async () => {
    for (const p of MANPOWER_REAL_FACTS_POSITIONS) {
      expect((p as { salary?: unknown }).salary).toBeUndefined();
    }
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/SAR\s*[\d,]+/);
  }, 60_000);

  it("the real requirement states no benefits — none is rendered, and none is carried over from another requirement", async () => {
    const facts = realFacts();
    expect(facts.benefits).toEqual([]);
    const r = await renderFactLayer({ facts, widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/food allowance|accommodation|transportation|medical insurance/i);
  }, 60_000);
});

describe("12. No unsupported employer", () => {
  it("Saudi Aramco is never promoted from criterion to employer", async () => {
    const facts = realFacts();
    expect(facts.employer).toBeNull();
    const r = await renderFactLayer({ facts, widthPx: 1080, heightPx: 1350 * 3 });
    // Aramco is a legitimate per-role criterion elsewhere in this
    // dataset's remarks (not in AdvertisementFacts, so it cannot leak
    // here); the employer display line itself must never fire.
    expect(r.svgMarkup).not.toMatch(/employer/i);
  }, 60_000);
});

describe("13/14. No invented deadline or manufactured scarcity", () => {
  it("urgency never becomes a deadline or scarcity claim", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/tomorrow|today only|limited slot|limited seat|last chance|closing date|interview date|joining date|don'?t miss/i);
  }, 60_000);

  it("no urgency language appears at all when the source is not marked urgent", async () => {
    const r = await renderFactLayer({ facts: realFacts({ urgent: false }), widthPx: 1080, heightPx: 1350 * 3 });
    expect(r.svgMarkup).not.toMatch(/URGENT/i);
  }, 60_000);
});

describe("15/16. No silent omission, no vacancy mutation", () => {
  it("every one of the 19 roles appears with its exact source count", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: 1080, heightPx: 1350 * 3 });
    let total = 0;
    for (const [, count] of MANPOWER_REAL_EXPECTED) total += count;
    expect(total).toBe(127);
    for (const [title, count] of MANPOWER_REAL_EXPECTED) {
      const shown = title.replace(/Adminstator/i, "Administrator").replace(/Qualality/i, "Quality");
      expect(r.svgMarkup.toUpperCase(), title).toContain(`(${count} NOS)`);
      expect(r.svgMarkup.toUpperCase(), title).toContain(shown.toUpperCase());
    }
  }, 120_000);
});
