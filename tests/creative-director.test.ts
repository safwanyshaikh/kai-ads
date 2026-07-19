import { describe, expect, it } from "vitest";
import {
  runCreativeDirector,
  currencyIntelligence,
  employerIntelligence,
  opportunityRanking,
  salaryIntelligence,
  truthValidation,
  countryIntelligence,
  industryIntelligence,
  benefitsIntelligence,
  projectIntelligence,
  urgencyIntelligence,
  type CreativeInput,
} from "@/server/generation/creative-director";
import { getFeatureFlags } from "@/lib/env";

// Bilfinger-shaped (has salary) and Halliburton-shaped (no salary) inputs.
const BILFINGER: CreativeInput = {
  employer: "Bilfinger",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  header: "Mega Shutdown Project in Saudi Arabia",
  positions: [
    { title: "QA/QC Inspector", count: 2, salary: "5,500" },
    { title: "Welder - TIG", count: 5, salary: "2,500" },
  ],
  benefits: [{ label: "Basic Salary" }, { label: "Overtime up to 4 hours" }, { label: "Food", detail: "SR 300" }, { label: "Insurance" }],
  interview: [{ date: "14–15 July", location: "Baroda" }, { date: "18 July", location: "Mumbai" }],
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  agencyPalette: { primary: "#0B3D2E", secondary: "#C9A227", accent: "#E4572E" },
  channel: "DTP_NEWSPAPER",
};

const HALLIBURTON: CreativeInput = {
  employer: "Halliburton",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  header: "Requirement for Saudi Arabia — Oil & Gas Field Services",
  positions: Array.from({ length: 30 }, (_, i) => ({ title: `Role ${i}`, count: 1 })),
  benefits: [],
  interview: [],
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  channel: "DTP_NEWSPAPER",
};

describe("Creative Director Brain — orchestrator", () => {
  it("produces a full immutable CreativeDirection with per-engine traceability", () => {
    const d = runCreativeDirector(BILFINGER);
    expect(Object.isFrozen(d)).toBe(true);
    expect(d.traceability.length).toBeGreaterThanOrEqual(21); // one trace per engine
    // every trace explains WHY
    for (const t of d.traceability) expect(t.reason.length).toBeGreaterThan(5);
  });

  it("is deterministic — identical input yields identical output", () => {
    expect(JSON.stringify(runCreativeDirector(BILFINGER))).toEqual(JSON.stringify(runCreativeDirector(BILFINGER)));
  });
});

describe("Currency Intelligence — wrong currency = FAIL", () => {
  it("Saudi Arabia → SAR, valid", () => {
    const r = currencyIntelligence(BILFINGER);
    expect(r.value.currency).toBe("SAR");
    expect(r.value.valid).toBe(true);
    expect(r.value.format).toBe("SAR 12,000");
  });
  it("unknown destination → UNKNOWN and invalid (FAIL)", () => {
    const r = currencyIntelligence({ ...BILFINGER, country: "Atlantis" });
    expect(r.value.valid).toBe(false);
    expect(r.value.currency).toBe("UNKNOWN");
  });
  it("GCC map covers SAR/AED/KWD/QAR/BHD/OMR", () => {
    const map: [string, string][] = [["Saudi Arabia", "SAR"], ["UAE", "AED"], ["Kuwait", "KWD"], ["Qatar", "QAR"], ["Bahrain", "BHD"], ["Oman", "OMR"]];
    for (const [country, cur] of map) {
      expect(currencyIntelligence({ ...BILFINGER, country }).value.currency).toBe(cur);
    }
  });
});

describe("Country + Industry Intelligence", () => {
  it("Saudi Arabia → PRIME / Desert Gold / Opportunity", () => {
    const r = countryIntelligence(BILFINGER).value;
    expect(r.prestige).toBe("PRIME");
    expect(r.premiumColour).toBe("Desert Gold");
    expect(r.flagKey).toBe("SA");
  });
  it("Oil & Gas → high attractiveness + prominence", () => {
    const r = industryIntelligence(BILFINGER).value;
    expect(r.attractiveness).toBeGreaterThanOrEqual(85);
    expect(r.prominence).toBe("HIGH");
  });
  it("Hospitality → HOTEL story, not HOSPITAL (\"hospital\" is a substring of \"hospitality\")", () => {
    const d = runCreativeDirector({ ...BILFINGER, industry: "Hospitality", employer: "Royal Palace Hotel" });
    expect(d.visualStory.story).toBe("HOTEL");
  });
});

describe("Employer + Opportunity ranking (one hero; employer not over opportunity)", () => {
  it("magnet brand (Halliburton) is HIGH", () => {
    expect(employerIntelligence(HALLIBURTON).value.brandStrength).toBe("MAGNET");
  });
  it("credible-only brand (Bilfinger) is MEDIUM, never the hero on its own", () => {
    expect(employerIntelligence(BILFINGER).value.brandStrength).toBe("CREDIBLE");
    const d = runCreativeDirector(BILFINGER);
    expect(d.opportunity.hero).not.toBe("EMPLOYER");
  });
  it("exactly one hero is chosen", () => {
    const d = runCreativeDirector(HALLIBURTON);
    expect(typeof d.opportunity.hero).toBe("string");
    expect(d.opportunity.ranked[0]).toBeDefined();
  });
});

describe("Salary / Benefits / Project / Urgency (never invent)", () => {
  it("Bilfinger has salary → HIGH prominence; Halliburton has none → LOW", () => {
    expect(salaryIntelligence(BILFINGER).value.hasSalary).toBe(true);
    expect(salaryIntelligence(BILFINGER).value.prominence).toBe("HIGH");
    expect(salaryIntelligence(HALLIBURTON).value.hasSalary).toBe(false);
    expect(salaryIntelligence(HALLIBURTON).value.prominence).toBe("LOW");
  });
  it("benefits ranked by priority; empty stays empty (no invention)", () => {
    expect(benefitsIntelligence(BILFINGER).value.ranked[0]).toBe("Salary");
    expect(benefitsIntelligence(HALLIBURTON).value.ranked).toEqual([]);
  });
  it("shutdown header → shutdown project descriptor", () => {
    expect(projectIntelligence(BILFINGER).value.projectType).toMatch(/shutdown/i);
  });
  it("walk-in/interview dates drive urgency", () => {
    expect(urgencyIntelligence(BILFINGER).value.level).toBe("MEDIUM");
  });
});

describe("Truth Validation", () => {
  it("valid case passes with invented: NONE", () => {
    const d = runCreativeDirector(BILFINGER);
    expect(d.truth.pass).toBe(true);
    expect(d.truth.invented).toBe("NONE");
  });
  it("unknown destination fails on currency", () => {
    const r = truthValidation({
      input: { ...BILFINGER, country: "Atlantis" },
      currency: currencyIntelligence({ ...BILFINGER, country: "Atlantis" }).value,
      opportunity: opportunityRanking({
        country: countryIntelligence({ ...BILFINGER, country: "Atlantis" }).value,
        salary: salaryIntelligence(BILFINGER).value,
        industry: industryIntelligence(BILFINGER).value,
        project: projectIntelligence(BILFINGER).value,
        employer: employerIntelligence(BILFINGER).value,
        urgency: urgencyIntelligence(BILFINGER).value,
      }).value,
      employer: employerIntelligence(BILFINGER).value,
      salary: salaryIntelligence(BILFINGER).value,
    });
    expect(r.value.pass).toBe(false);
    expect(r.value.violations.join(" ")).toMatch(/currency/i);
  });
});

describe("Feature flag — default OFF (production unwired)", () => {
  it("CREATIVE_DIRECTOR_BRAIN defaults to false", () => {
    expect(getFeatureFlags().creativeDirectorBrain).toBe(false);
  });
});
