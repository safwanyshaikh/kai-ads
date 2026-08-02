import { describe, expect, it } from "vitest";
import {
  UNKNOWN,
  assessJobOrder,
  buildCorpus,
  determineChannels,
  determineComplexity,
  determineCountry,
  determineEmployer,
  determineHiringPattern,
  determineIndustry,
  determineLanguages,
  determinePlantStatus,
  determinePlantType,
  determineProjectName,
  determineRecruitmentPattern,
  determineScarcity,
  determineSector,
  determineTradeCategories,
  determineTradeCount,
  determineUrgency,
  type JobOrderInput,
  type PositionInput,
} from "@/server/job-order-intelligence/determinations";
import { CONFIDENCE_THRESHOLD, confidenceFor } from "@/server/job-order-intelligence/signals";

/**
 * JobOrder Intelligence (Task 003).
 *
 * The contract under test:
 *   * every determination carries Source, Confidence and Reason,
 *   * every determination is deterministic,
 *   * uncertainty returns UNKNOWN — never a guess.
 *
 * The third is the one that matters most and gets the most coverage. An
 * agency owner can work with "we could not tell whether this is a
 * shutdown". They cannot work with a confident wrong answer, because
 * they will act on it.
 */

function position(overrides: Partial<PositionInput> = {}): PositionInput {
  return {
    title: "Welder",
    normalizedTitle: "welder",
    count: 10,
    experience: "5 years",
    qualifications: null,
    sortOrder: 0,
    ...overrides,
  };
}

function jobOrder(overrides: Partial<JobOrderInput> = {}): JobOrderInput {
  return {
    title: "Welder — Saudi Arabia",
    industry: "Construction",
    country: "Saudi Arabia",
    employerName: "ABC Contracting",
    projectType: null,
    positions: [position()],
    sourceTexts: [],
    ...overrides,
  };
}

/** The worked example from the Task 003 specification. */
const OIL_AND_GAS_SHUTDOWN = jobOrder({
  title: "Instrument Technician and 2 other roles — Saudi Arabia",
  industry: "Not stated",
  positions: [
    position({ title: "Instrument Technician", normalizedTitle: "instrument technician", count: 18, sortOrder: 0 }),
    position({ title: "Analyzer Technician", normalizedTitle: "analyzer technician", count: 6, sortOrder: 1 }),
    position({ title: "Process Operator", normalizedTitle: "process operator", count: 12, sortOrder: 2 }),
  ],
  sourceTexts: ["Running Plant Maintenance at Jubail refinery. Shutdown scope, immediate joining required."],
});

describe("the specification's worked example", () => {
  it("determines Oil & Gas at high confidence, citing the signals", () => {
    const result = determineIndustry(buildCorpus(OIL_AND_GAS_SHUTDOWN));

    expect(result.value).toBe("Oil & Gas");
    expect(result.confidencePct).toBe(98);
    expect(result.reason).toContain("Detected from:");
    // The evidence is named, not summarized.
    expect(result.reason).toContain("Analyzer Technician");
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
  });
});

describe("every determination carries source, confidence and reason", () => {
  const result = assessJobOrder(OIL_AND_GAS_SHUTDOWN);

  it("produces no determination without all three", () => {
    expect(result.determinations.length).toBeGreaterThan(0);
    for (const determination of result.determinations) {
      expect(determination.attribute.length).toBeGreaterThan(0);
      expect(determination.source.length).toBeGreaterThan(0);
      expect(determination.reason.length).toBeGreaterThan(0);
      expect(determination.confidencePct).toBeGreaterThanOrEqual(0);
      expect(determination.confidencePct).toBeLessThanOrEqual(100);
    }
  });

  it("covers every attribute the specification requires", () => {
    expect(result.determinations.map((d) => d.attribute)).toEqual(
      expect.arrayContaining([
        "industry", "sector", "country", "employer", "projectName", "plantType",
        "plantStatus", "tradeCategories", "tradeCount", "recruitmentComplexity",
        "candidateScarcity", "languagesRequired", "suggestedChannels", "urgency",
        "hiringPattern", "recruitmentPattern",
      ]),
    );
  });

  it("explains an UNKNOWN as thoroughly as a determined value", () => {
    const bare = assessJobOrder(jobOrder({ industry: "Not stated", employerName: null }));
    for (const determination of bare.determinations.filter((d) => d.value === UNKNOWN)) {
      expect(determination.reason.length).toBeGreaterThan(0);
      expect(determination.confidencePct).toBe(0);
    }
  });
});

describe("determinism", () => {
  it("produces an identical assessment on repeated runs", () => {
    const runs = Array.from({ length: 5 }, () => assessJobOrder(OIL_AND_GAS_SHUTDOWN));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it("does not depend on the order positions were listed in", () => {
    const reversed = {
      ...OIL_AND_GAS_SHUTDOWN,
      positions: [...OIL_AND_GAS_SHUTDOWN.positions].reverse().map((p, i) => ({ ...p, sortOrder: i })),
    };
    const a = assessJobOrder(OIL_AND_GAS_SHUTDOWN);
    const b = assessJobOrder(reversed);

    const values = (r: typeof a) => r.determinations.map((d) => [d.attribute, d.value]);
    expect(values(a)).toEqual(values(b));
  });

  it("uses no clock — urgency ignores interview-date proximity by design", () => {
    // Proximity would make the same requirement classify differently
    // tomorrow, which breaks reproducibility outright.
    const result = determineUrgency(buildCorpus(jobOrder()));
    expect(result.reason).toContain("today's date");
  });

  it("counts a repeated word once, so repetition cannot manufacture certainty", () => {
    const once = determinePlantStatus(buildCorpus(jobOrder({ sourceTexts: ["Shutdown scope."] })));
    const many = determinePlantStatus(
      buildCorpus(jobOrder({ sourceTexts: ["Shutdown shutdown shutdown shutdown shutdown."] })),
    );
    expect(many.confidencePct).toBe(once.confidencePct);
  });
});

describe("UNKNOWN rather than a guess", () => {
  it("returns UNKNOWN for an industry with no matching evidence", () => {
    const result = determineIndustry(
      buildCorpus(jobOrder({ industry: "Not stated", title: "Requirement", positions: [position({ title: "Staff" })], employerName: null })),
    );
    expect(result.value).toBe(UNKNOWN);
    expect(result.confidencePct).toBe(0);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("returns UNKNOWN when only a single weak signal fired", () => {
    // One weak signal scores below the threshold — by design, so a
    // passing mention can never decide anything.
    expect(confidenceFor(0, 1)).toBeLessThan(CONFIDENCE_THRESHOLD);
    const result = determineIndustry(
      buildCorpus(jobOrder({ industry: "Not stated", title: "Requirement", positions: [position({ title: "Cook" })], employerName: null })),
    );
    expect(result.value).toBe(UNKNOWN);
  });

  it("returns UNKNOWN when two candidates are equally supported", () => {
    // A refinery turnaround staffed by a construction contractor reads
    // both ways. Picking one would be a coin toss dressed as a finding.
    const result = determinePlantStatus(
      buildCorpus(jobOrder({ sourceTexts: ["Shutdown works and commissioning support required."] })),
    );
    if (result.value === UNKNOWN) {
      expect(result.reason).toContain("equally");
    } else {
      // If one side genuinely won, it must be on strictly better evidence.
      expect(result.confidencePct).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    }
  });

  it("never invents a project name from the employer and destination", () => {
    const result = determineProjectName(jobOrder({ projectType: null }));
    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("rather than constructed");
  });

  it("never infers a language from the destination country", () => {
    // Printing "Arabic required" because the job is in Saudi Arabia
    // invents a requirement the employer never set.
    const result = determineLanguages(buildCorpus(jobOrder({ country: "Saudi Arabia" })));
    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("rather than inferred from the destination");
  });

  it("returns UNKNOWN for an employer that was never linked", () => {
    const result = determineEmployer(jobOrder({ employerName: null }));
    expect(result.value).toBe(UNKNOWN);
  });

  it("treats the Requirement Intelligence placeholder as unstated, not as a value", () => {
    // "Not stated" is what the previous stage records for absence. It
    // must never be reported as though it were an industry.
    const result = determineCountry(jobOrder({ country: "Not stated" }));
    expect(result.value).toBe(UNKNOWN);
  });

  it("returns UNKNOWN for scarcity when no trade could be categorized", () => {
    const input = jobOrder({ positions: [position({ title: "Staff", normalizedTitle: "staff" })] });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(determineScarcity(categories, input, buildCorpus(input)).value).toBe(UNKNOWN);
  });

  it("returns UNKNOWN for hiring pattern when no headcount was stated", () => {
    const input = jobOrder({ positions: [position({ count: null })] });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(determineHiringPattern(input, categories).value).toBe(UNKNOWN);
  });
});

describe("industry and sector", () => {
  it.each([
    ["refinery shutdown, process operator, flare", "Oil & Gas"],
    ["hospital staff nurse radiographer ward", "Healthcare"],
    ["shipyard dry dock hull fabrication", "Marine & Shipyard"],
    ["hotel restaurant banquet chef", "Hospitality"],
    ["power plant gas turbine switchyard", "Power Generation"],
  ])("detects %s as %s", (text, expected) => {
    const result = determineIndustry(buildCorpus(jobOrder({ industry: "Not stated", sourceTexts: [text] })));
    expect(result.value).toBe(expected);
  });

  it("derives sector from the industry rather than detecting it separately", () => {
    const industry = determineIndustry(buildCorpus(OIL_AND_GAS_SHUTDOWN));
    const sector = determineSector(industry);
    expect(sector.value).toBe("Energy");
    expect(sector.confidencePct).toBe(industry.confidencePct);
    expect(sector.reason).toContain("Derived from industry");
  });

  it("reports UNKNOWN sector when the industry is UNKNOWN", () => {
    const unknownIndustry = determineIndustry(
      buildCorpus(jobOrder({ industry: "Not stated", title: "x", positions: [position({ title: "Staff" })], employerName: null })),
    );
    expect(determineSector(unknownIndustry).value).toBe(UNKNOWN);
  });

  it("does not match a phrase inside an unrelated word", () => {
    // "lng" must not fire inside "challenging"; "marine" not in "submarine".
    const result = determinePlantType(
      buildCorpus(jobOrder({ sourceTexts: ["A challenging role on a submarine cable project."] })),
    );
    expect(result.value).toBe(UNKNOWN);
  });
});

describe("plant status — the most commercially loaded field", () => {
  it.each([
    ["Plant shutdown scope for 30 days", "Shutdown"],
    ["Major turnaround at the complex", "Turnaround"],
    ["Commissioning and start-up support", "Commissioning"],
    ["O&M contract, operation and maintenance of the running plant", "Running Plant"],
  ])("reads %s as %s", (text, expected) => {
    expect(determinePlantStatus(buildCorpus(jobOrder({ sourceTexts: [text] }))).value).toBe(expected);
  });

  it("is UNKNOWN when the requirement never says", () => {
    expect(determinePlantStatus(buildCorpus(jobOrder())).value).toBe(UNKNOWN);
  });
});

describe("trades", () => {
  it("categorizes from position titles only, never from the narrative", () => {
    // A shutdown scope document mentions scaffolding whether or not a
    // single scaffolder is being hired.
    const input = jobOrder({
      positions: [position({ title: "Instrument Technician", normalizedTitle: "instrument technician" })],
      sourceTexts: ["Scaffolding and painting will be handled by the main contractor."],
    });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(categories).toContain("Instrumentation");
    expect(categories).not.toContain("Scaffolding");
    expect(categories).not.toContain("Painting & Blasting");
  });

  it("reports every trade family present, not just the largest", () => {
    const input = jobOrder({
      positions: [
        position({ title: "Welder", normalizedTitle: "welder", count: 40 }),
        position({ title: "HSE Officer", normalizedTitle: "hse officer", count: 2, sortOrder: 1 }),
        position({ title: "Rigger", normalizedTitle: "rigger", count: 8, sortOrder: 2 }),
      ],
    });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(categories).toEqual(expect.arrayContaining(["Welding & Fabrication", "HSE", "Rigging & Lifting"]));
  });

  it("counts distinct trades on the normalized title, so casing variants are one trade", () => {
    const input = jobOrder({
      positions: [
        position({ title: "Welder", normalizedTitle: "welder" }),
        position({ title: "WELDER", normalizedTitle: "welder", sortOrder: 1 }),
        position({ title: "Rigger", normalizedTitle: "rigger", sortOrder: 2 }),
      ],
    });
    const result = determineTradeCount(input);
    expect(result.value).toBe("2");
    expect(result.confidencePct).toBe(100);
  });
});

describe("scarcity and complexity", () => {
  it("follows the scarcest trade, not the average", () => {
    // 200 helpers and 4 analyzer technicians is not an easy drive.
    const input = jobOrder({
      positions: [
        position({ title: "Helper", normalizedTitle: "helper", count: 200 }),
        position({ title: "Analyzer Technician", normalizedTitle: "analyzer technician", count: 4, sortOrder: 1 }),
      ],
    });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    const result = determineScarcity(categories, input, corpus);

    expect(result.value).toBe("Very Scarce");
    expect(result.reason).toContain("not the average");
  });

  it("escalates scarcity when a certification is demanded", () => {
    const plain = jobOrder({ positions: [position({ title: "Welder", normalizedTitle: "welder" })] });
    const certified = jobOrder({
      positions: [position({ title: "Welder", normalizedTitle: "welder", qualifications: ["CSWIP 3.1"] })],
    });

    const scarcityOf = (input: JobOrderInput) => {
      const corpus = buildCorpus(input);
      return determineScarcity(determineTradeCategories(corpus).categories, input, corpus);
    };

    expect(scarcityOf(plain).value).toBe("Moderate");
    expect(scarcityOf(certified).value).toBe("Scarce");
    expect(scarcityOf(certified).reason).toContain("CSWIP");
  });

  it("rates a broad multi-trade bulk drive as high complexity", () => {
    const positions = [
      "Welder", "Rigger", "Scaffolder", "Electrician", "Instrument Technician",
      "Pipe Fitter", "HSE Officer", "QC Inspector", "Painter", "Insulator",
    ].map((title, index) =>
      position({ title, normalizedTitle: title.toLowerCase(), count: 20, sortOrder: index }),
    );
    const input = jobOrder({ positions });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    const scarcity = determineScarcity(categories, input, corpus);

    const result = determineComplexity(input, categories, scarcity);
    expect(["High", "Very High"]).toContain(result.value);
    expect(result.reason).toContain("distinct trades");
  });

  it("rates a single small-team trade as low or moderate complexity", () => {
    const input = jobOrder({ positions: [position({ title: "Mason", normalizedTitle: "mason", count: 4 })] });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    const scarcity = determineScarcity(categories, input, corpus);
    expect(["Low", "Moderate"]).toContain(determineComplexity(input, categories, scarcity).value);
  });
});

describe("languages and urgency", () => {
  it("reports a language only when it was explicitly required", () => {
    const result = determineLanguages(
      buildCorpus(jobOrder({ sourceTexts: ["Candidates must have fluent English and Arabic speaking ability."] })),
    );
    expect(result.value).toBe("Arabic, English");
  });

  it.each([
    ["Immediate joining required, mobilize immediately", "Immediate"],
    ["ASAP, as soon as possible", "Immediate"],
    // "urgent" plus "expedite" is pressure, not a stated immediate start.
    ["Priority requirement, please expedite", "High"],
  ])("reads %s as %s urgency", (text, expected) => {
    expect(determineUrgency(buildCorpus(jobOrder({ sourceTexts: [text] }))).value).toBe(expected);
  });

  it("treats silence about urgency as Normal, at modest confidence", () => {
    const result = determineUrgency(buildCorpus(jobOrder()));
    expect(result.value).toBe("Normal");
    // Silence is weaker evidence than a statement, and scores lower.
    expect(result.confidencePct).toBeLessThan(80);
  });
});

describe("hiring pattern and recruitment pattern", () => {
  it("reads a large multi-trade requirement as a bulk mobilization", () => {
    const input = jobOrder({
      positions: [
        position({ title: "Welder", normalizedTitle: "welder", count: 60 }),
        position({ title: "Rigger", normalizedTitle: "rigger", count: 20, sortOrder: 1 }),
      ],
    });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(determineHiringPattern(input, categories).value).toBe("Bulk Mobilization");
  });

  it("reads a lone senior vacancy as specialist hiring", () => {
    const input = jobOrder({
      positions: [position({ title: "Analyzer Technician", normalizedTitle: "analyzer technician", count: 2 })],
    });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(determineHiringPattern(input, categories).value).toBe("Specialist Hiring");
  });

  it("reads an all-supervisory requirement as management hiring", () => {
    const input = jobOrder({
      positions: [
        position({ title: "Project Manager", normalizedTitle: "project manager", count: 1 }),
        position({ title: "Site Manager", normalizedTitle: "site manager", count: 2, sortOrder: 1 }),
      ],
    });
    const { categories } = determineTradeCategories(buildCorpus(input));
    expect(determineHiringPattern(input, categories).value).toBe("Management Hiring");
  });

  it("prefers the campaign named in the wording over the structural shape", () => {
    const input = jobOrder({
      positions: [position({ title: "Welder", normalizedTitle: "welder", count: 80 })],
      sourceTexts: ["Plant shutdown at the refinery, 30-day scope."],
    });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    const hiring = determineHiringPattern(input, categories);

    // Structurally a bulk mobilization, but the requirement says shutdown.
    expect(hiring.value).toBe("Bulk Mobilization");
    expect(determineRecruitmentPattern(corpus, hiring).value).toBe("Shutdown Campaign");
  });

  it("falls back to the structural shape when the wording names no campaign, and says so", () => {
    const input = jobOrder({
      positions: [position({ title: "Welder", normalizedTitle: "welder", count: 80 })],
    });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    const result = determineRecruitmentPattern(corpus, determineHiringPattern(input, categories));

    expect(result.value).toBe("Bulk Mobilization");
    expect(result.reason).toContain("names no campaign type");
  });

  it.each([
    ["Greenfield project, new plant construction", "Greenfield"],
    ["Brownfield expansion and revamp project", "Brownfield"],
    ["Annual maintenance contract for the facility", "Annual Maintenance"],
    ["Emergency requirement due to breakdown maintenance", "Emergency Hiring"],
    ["Replacement of existing manpower, backfill positions", "Replacement Hiring"],
  ])("reads %s as %s", (text, expected) => {
    const input = jobOrder({ sourceTexts: [text] });
    const corpus = buildCorpus(input);
    const { categories } = determineTradeCategories(corpus);
    expect(determineRecruitmentPattern(corpus, determineHiringPattern(input, categories)).value).toBe(expected);
  });
});

describe("suggested channels", () => {
  it("suggests wide local reach for a bulk drive and direct approach for a specialist", () => {
    const bulkInput = jobOrder({ positions: [position({ title: "Helper", normalizedTitle: "helper", count: 120 })] });
    const bulkCorpus = buildCorpus(bulkInput);
    const bulkCategories = determineTradeCategories(bulkCorpus).categories;
    const bulk = determineChannels({
      hiringPattern: determineHiringPattern(bulkInput, bulkCategories),
      scarcity: determineScarcity(bulkCategories, bulkInput, bulkCorpus),
      categories: bulkCategories,
    });
    expect(bulk.value).toContain("Regional newspaper");

    const specialistInput = jobOrder({
      positions: [position({ title: "Analyzer Technician", normalizedTitle: "analyzer technician", count: 2 })],
    });
    const specialistCorpus = buildCorpus(specialistInput);
    const specialistCategories = determineTradeCategories(specialistCorpus).categories;
    const specialist = determineChannels({
      hiringPattern: determineHiringPattern(specialistInput, specialistCategories),
      scarcity: determineScarcity(specialistCategories, specialistInput, specialistCorpus),
      categories: specialistCategories,
    });
    expect(specialist.value).toContain("Targeted trade-network outreach");
  });

  it("states plainly that it publishes nothing", () => {
    const input = jobOrder({ positions: [position({ title: "Helper", normalizedTitle: "helper", count: 120 })] });
    const corpus = buildCorpus(input);
    const categories = determineTradeCategories(corpus).categories;
    const result = determineChannels({
      hiringPattern: determineHiringPattern(input, categories),
      scarcity: determineScarcity(categories, input, corpus),
      categories,
    });
    expect(result.reason).toContain("nothing is published by this engine");
  });
});

describe("the assessment as a whole", () => {
  it("reports which attributes came back UNKNOWN", () => {
    const result = assessJobOrder(jobOrder({ industry: "Not stated", employerName: null, projectType: null }));
    expect(result.unknownAttributes).toContain("projectName");
    expect(result.unknownAttributes).toContain("employer");
  });

  it("averages confidence over the determinations that resolved", () => {
    const result = assessJobOrder(OIL_AND_GAS_SHUTDOWN);
    expect(result.overallConfidencePct).toBeGreaterThan(0);
    expect(result.overallConfidencePct).toBeLessThanOrEqual(100);
  });

  it("assesses a requirement with nothing in it without throwing", () => {
    const result = assessJobOrder(
      jobOrder({ title: "", industry: "Not stated", country: "Not stated", employerName: null, positions: [], sourceTexts: [] }),
    );
    expect(result.overallConfidencePct).toBe(0);
    expect(result.determinations.every((d) => d.value === UNKNOWN)).toBe(true);
  });

  it("produces no advertisement, layout, or compliance judgement", () => {
    // This engine only understands. Anything resembling creative output
    // or a legal verdict here would belong to a later stage.
    const serialized = JSON.stringify(assessJobOrder(OIL_AND_GAS_SHUTDOWN)).toLowerCase();
    for (const forbidden of ["headline", "layout", "template", "render", "compliant", "prohibited"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
