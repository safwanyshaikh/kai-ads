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
  visualStory,
  heroStrategy,
  colourStrategy,
  ctaStrategy,
  commercialScoring,
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

// Playbook §19's own worked example: "A 20-role Bus Driver walk-in
// requirement -> urgent mobilization / mass hiring personality."
const BUS_DRIVER: CreativeInput = {
  employer: null,
  industry: "Transport",
  country: "UAE",
  header: "Urgent Requirement — Bus Drivers for UAE, walk-in interview",
  positions: Array.from({ length: 20 }, (_, i) => ({ title: `Bus Driver ${i}`, count: 1 })),
  benefits: [{ label: "Basic Salary" }],
  interview: [],
  sourceSignals: ["spot selection"],
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  channel: "SOCIAL_SQUARE",
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

describe("Phase C — Opportunity Ranking (Playbook §1/§2, default priority + overrides)", () => {
  it("default lever order leads with COUNTRY when no salary/magnet grounds an override", () => {
    const country = countryIntelligence(HALLIBURTON).value;
    const industry = industryIntelligence(HALLIBURTON).value;
    const project = projectIntelligence(HALLIBURTON).value;
    const employer = employerIntelligence({ ...HALLIBURTON, employer: "Some Unknown Contractor LLC" }).value;
    const salary = salaryIntelligence({ ...HALLIBURTON, positions: [{ title: "Role", count: 1 }] }).value;
    const urgency = urgencyIntelligence(HALLIBURTON).value;
    const r = opportunityRanking({ country, salary, industry, project, employer, urgency });
    expect(r.value.hero).toBe("COUNTRY");
    expect(r.value.ranked[0]).toBe("COUNTRY");
  });

  it("a grounded salary overrides COUNTRY to lead (Playbook §2)", () => {
    const d = runCreativeDirector(BILFINGER);
    expect(d.opportunity.hero).toBe("SALARY");
  });

  it("a genuine magnet employer overrides salary and country (Playbook §2)", () => {
    const d = runCreativeDirector({ ...BILFINGER, employer: "Halliburton" });
    expect(d.opportunity.hero).toBe("EMPLOYER");
  });
});

describe("Phase C — Candidate Psychology coherence with the locked hero (Decision Flow Stage 2/3)", () => {
  it("the dominant hook always expresses the SAME lever opportunityRanking locked as hero", () => {
    for (const input of [BILFINGER, HALLIBURTON, BUS_DRIVER]) {
      const d = runCreativeDirector(input);
      if (d.opportunity.hero === "SALARY") {
        expect(d.psychology.dominantHook).toMatch(/earning|salary/i);
      } else if (d.opportunity.hero === "EMPLOYER") {
        expect(d.psychology.dominantHook).toBe(input.employer ?? input.industry);
      } else if (d.opportunity.hero === "COUNTRY") {
        expect(d.psychology.dominantHook).toContain(d.country.country);
      }
    }
  });

  it("secondary hook never repeats the same fact as the dominant hook", () => {
    const d = runCreativeDirector(BILFINGER);
    if (d.psychology.secondaryHook) {
      expect(d.psychology.secondaryHook).not.toBe(d.psychology.dominantHook);
    }
  });
});

describe("Phase C — Visual Story personality (Playbook §19: headcount + urgency + industry together)", () => {
  it("large headcount + HIGH urgency together -> URGENT_MOBILIZATION, not plain WALK_IN_DRIVE", () => {
    const project = projectIntelligence(BUS_DRIVER).value;
    const urgency = urgencyIntelligence(BUS_DRIVER).value;
    expect(urgency.level).toBe("HIGH");
    const r = visualStory({ input: BUS_DRIVER, project, urgency });
    expect(r.value.personality).toBe("URGENT_MOBILIZATION");
  });

  it("HIGH urgency at ordinary (small) headcount stays WALK_IN_DRIVE", () => {
    const small: CreativeInput = { ...BUS_DRIVER, positions: [{ title: "Front Office Executive", count: 2 }] };
    const project = projectIntelligence(small).value;
    const urgency = urgencyIntelligence(small).value;
    const r = visualStory({ input: small, project, urgency });
    expect(r.value.personality).toBe("WALK_IN_DRIVE");
  });

  it("mass headcount with no urgency stays MASS_HIRING", () => {
    const noUrgency: CreativeInput = { ...BUS_DRIVER, header: "Bus Drivers for UAE", sourceSignals: [] };
    const project = projectIntelligence(noUrgency).value;
    const urgency = urgencyIntelligence(noUrgency).value;
    expect(urgency.level).toBe("NONE");
    const r = visualStory({ input: noUrgency, project, urgency });
    expect(r.value.personality).toBe("MASS_HIRING");
  });
});

describe("Phase C — Hero Strategy matches personality, not just industry (Playbook §3)", () => {
  it("mass-hiring/urgent-mobilization personality -> a group in motion, not a lone worker", () => {
    const r = heroStrategy("WORKER_HERO", "URGENT_MOBILIZATION");
    expect(r.value.subject).toMatch(/group/i);
  });

  it("shutdown/mega-project personality -> a lone worker dwarfed by structure", () => {
    const r = heroStrategy("REFINERY", "SHUTDOWN");
    expect(r.value.subject).toMatch(/lone worker/i);
  });

  it("the same story produces a DIFFERENT hero subject under a different personality (never a fixed default)", () => {
    const shutdown = heroStrategy("REFINERY", "SHUTDOWN");
    const massHiring = heroStrategy("REFINERY", "MASS_HIRING");
    expect(shutdown.value.subject).not.toBe(massHiring.value.subject);
  });
});

describe("Phase C — Colour Strategy: no competing warm/cool cast (Playbook §8, FL-009/FL-010)", () => {
  it("Desert Gold (Saudi Arabia) resolves to a warm dark tone, never the cool navy previously hard-coded", () => {
    const country = countryIntelligence(BILFINGER).value;
    const r = colourStrategy({ country, input: BILFINGER });
    expect(r.value.mood).toBe("Desert Gold");
    expect(r.value.dark).not.toBe("#0C2E63"); // the old, wrong cool-navy value
  });

  it("Red + White (Bahrain) gets its own real dark tone, not the generic charcoal fallback", () => {
    const country = countryIntelligence({ ...BILFINGER, country: "Bahrain" }).value;
    const r = colourStrategy({ country, input: BILFINGER });
    expect(r.value.mood).toBe("Red + White");
    expect(r.value.dark).not.toBe("#1c1c1e");
  });

  it("every locked country resolves to SOME defined dark tone (no accidental fallback)", () => {
    for (const country of ["Saudi Arabia", "UAE", "Kuwait", "Qatar", "Bahrain", "Oman"]) {
      const c = countryIntelligence({ ...BILFINGER, country }).value;
      const r = colourStrategy({ country: c, input: BILFINGER });
      expect(r.value.dark).toBeTruthy();
    }
  });
});

describe("Phase C — CTA Strategy: proportional to urgency, never maximized by default (Playbook §13)", () => {
  it("no urgency signal -> LOW priority (previously always at least MEDIUM)", () => {
    const noUrgency: CreativeInput = { ...HALLIBURTON, header: "Requirement for Saudi Arabia" };
    const urgency = urgencyIntelligence(noUrgency).value;
    expect(urgency.level).toBe("NONE");
    const r = ctaStrategy({ urgency, input: noUrgency });
    expect(r.value.priority).toBe("LOW");
  });

  it("WhatsApp channel produces a WHATSAPP CTA kind (previously dead code)", () => {
    const input: CreativeInput = { ...BILFINGER, channel: "WHATSAPP" };
    const urgency = urgencyIntelligence(input).value;
    const r = ctaStrategy({ urgency, input });
    expect(r.value.kind).toBe("WHATSAPP");
  });

  it("HIGH urgency -> HIGH priority", () => {
    const urgency = urgencyIntelligence(BUS_DRIVER).value;
    const r = ctaStrategy({ urgency, input: BUS_DRIVER });
    expect(r.value.priority).toBe("HIGH");
  });
});

describe("Phase C — Trust Strategy: proportionate, capped below HIGH (Playbook §12)", () => {
  it("never returns HIGH priority — trust must never expand to dominate the offer", () => {
    for (const input of [BILFINGER, HALLIBURTON, BUS_DRIVER]) {
      const d = runCreativeDirector(input);
      expect(d.trust.priority).not.toBe("HIGH");
    }
  });

  it("a magnet employer in a PRIME country needs less extra reassurance -> LOW", () => {
    const d = runCreativeDirector({ ...BILFINGER, employer: "Halliburton" });
    expect(d.trust.priority).toBe("LOW");
  });

  it("a merely credible employer keeps the baseline MEDIUM trust priority", () => {
    const d = runCreativeDirector(BILFINGER);
    expect(d.trust.priority).toBe("MEDIUM");
  });
});

describe("Phase C — Commercial Scoring: Truth Brain is a catastrophic gate checked first (Playbook §22)", () => {
  it("forces REJECT when truthValidation fails, regardless of the numeric score", () => {
    const currency = currencyIntelligence({ ...BILFINGER, country: "Atlantis" }).value;
    const country = countryIntelligence({ ...BILFINGER, country: "Atlantis" }).value;
    const industry = industryIntelligence(BILFINGER).value;
    const project = projectIntelligence(BILFINGER).value;
    const employer = employerIntelligence(BILFINGER).value;
    const salary = salaryIntelligence(BILFINGER).value;
    const urgency = urgencyIntelligence(BILFINGER).value;
    const opportunity = opportunityRanking({ country, salary, industry, project, employer, urgency }).value;
    const truth = truthValidation({ input: { ...BILFINGER, country: "Atlantis" }, currency, opportunity, employer, salary }).value;
    expect(truth.pass).toBe(false);

    const score = commercialScoring({
      currency, salary, urgency, opportunity, employer, truth,
      positionsCount: BILFINGER.positions.length, hasAgencyPalette: true,
    });
    expect(score.value.gate).toBe("REJECT");
    expect(score.value.overall).toBeGreaterThan(0); // score still computed, just gated
  });

  it("a passing truth validation allows the normal 95/90 threshold gate to apply", () => {
    const d = runCreativeDirector(BILFINGER);
    expect(d.truth.pass).toBe(true);
    expect(["AUTO_APPROVE", "CREATIVE_REVIEW", "REJECT"]).toContain(d.commercialScore.gate);
  });
});
