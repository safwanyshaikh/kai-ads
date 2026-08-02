import { describe, expect, it } from "vitest";
import {
  assessCampaign,
  determineAudienceType,
  determineCampaignDensity,
  determineCandidateMotivation,
  determineCtaStrategy,
  determineEmployerBrandingPriority,
  determineHeroImageIntent,
  determineInformationPriority,
  determineLanguageStrategy,
  determineObjective,
  determinePrimaryMessage,
  determineSecondaryMessage,
  determineTrustStrategy,
  determineUrgencyStrategy,
  determineVisualFocus,
  type CampaignInput,
} from "@/server/campaign-intelligence/determinations";
import { UNKNOWN } from "@/server/job-order-intelligence/determinations";

/**
 * Campaign Intelligence (Task 005).
 *
 * The two properties that matter most:
 *
 *   1. UNKNOWN PROPAGATES. A campaign decision derived from an UNKNOWN
 *      fact is itself UNKNOWN. Anything else is a guess presented as a
 *      strategy.
 *   2. THE ENGINE STAYS ON ITS SIDE OF THE LINE. It decides what to say
 *      and to whom, never how it looks. No layout, typography, colour or
 *      position may appear in any output.
 */

function input(overrides: Partial<CampaignInput> = {}): CampaignInput {
  return {
    intelligence: {
      industry: { value: "Oil & Gas", confidencePct: 98 },
      plantStatus: { value: "Running Plant", confidencePct: 92 },
      plantType: { value: "Refinery", confidencePct: 95 },
      tradeCategories: { value: "Instrumentation, Mechanical", confidencePct: 92 },
      candidateScarcity: { value: "Very Scarce", confidencePct: 85 },
      hiringPattern: { value: "Bulk Mobilization", confidencePct: 92 },
      urgency: { value: "Normal", confidencePct: 60 },
      languagesRequired: { value: "English", confidencePct: 70 },
    },
    compliance: { readiness: "ACTION_REQUIRED", agencyVerified: true },
    jobOrder: {
      employerName: "ABC Contracting",
      interviewDateStated: true,
      contactStated: true,
      positions: [
        { title: "Instrument Technician", count: 18, salary: "SAR 3,200" },
        { title: "Mechanical Fitter", count: 12, salary: "SAR 2,800" },
      ],
    },
    ...overrides,
  };
}

/** Strips one upstream attribute to UNKNOWN. */
function withUnknown(attribute: string, base = input()): CampaignInput {
  return {
    ...base,
    intelligence: { ...base.intelligence, [attribute]: { value: UNKNOWN, confidencePct: 0 } },
  };
}

describe("the specification's worked examples", () => {
  it("reads a running plant as long-term maintenance", () => {
    const result = determinePrimaryMessage(input());
    expect(result.value).toContain("Long-term running plant maintenance");
    expect(result.reason).toContain("Running Plant");
  });

  it("reads a running plant as career stability", () => {
    const result = determineCandidateMotivation(input());
    expect(result.value).toBe("Career Stability");
    expect(result.reason).toContain("ongoing operation");
  });

  it("intends a hero image of an operating plant with the right disciplines", () => {
    const result = determineHeroImageIntent(input());
    expect(result.value).toContain("Oil & Gas");
    expect(result.value).toContain("operating plant");
    expect(result.value).toContain("Instrumentation");
    expect(result.reason).toContain("recognises the job before reading a word");
  });
});

describe("UNKNOWN propagates from upstream", () => {
  it.each([
    ["plantStatus", determinePrimaryMessage],
    ["plantStatus", determineCandidateMotivation],
    ["hiringPattern", determineObjective],
    ["hiringPattern", determineCtaStrategy],
    ["hiringPattern", determineVisualFocus],
    ["candidateScarcity", determineSecondaryMessage],
    ["tradeCategories", determineAudienceType],
    ["languagesRequired", determineLanguageStrategy],
  ])("makes the decision UNKNOWN when %s is UNKNOWN", (attribute, determiner) => {
    const result = determiner(withUnknown(attribute));
    expect(result.value).toBe(UNKNOWN);
    expect(result.confidencePct).toBe(0);
    expect(result.reason).toContain(attribute);
  });

  it("names the missing input so the gap is traceable to its cause", () => {
    const result = determinePrimaryMessage(withUnknown("plantStatus"));
    expect(result.reason).toContain("UNKNOWN upstream");
    expect(result.reason).toContain("a guess presented as a strategy");
  });

  it("makes a decision UNKNOWN when any one of several inputs is UNKNOWN", () => {
    // Hero image intent needs industry, plant status and trades. Losing
    // any one of them is enough.
    for (const attribute of ["industry", "plantStatus", "tradeCategories"]) {
      expect(determineHeroImageIntent(withUnknown(attribute)).value).toBe(UNKNOWN);
    }
  });

  it("cascades through a decision derived from another decision", () => {
    // Information priority follows from audience, which follows from trades.
    const result = determineInformationPriority(withUnknown("tradeCategories"));
    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("audience is UNKNOWN");
  });

  it("treats a missing upstream determination exactly like an UNKNOWN one", () => {
    const bare = input({ intelligence: {} });
    const assessment = assessCampaign(bare);
    // Only the record-based decisions survive with no intelligence at all.
    expect(assessment.unknownAttributes.length).toBeGreaterThan(10);
  });
});

describe("confidence is capped by the least certain input", () => {
  it("never exceeds the weakest dependency", () => {
    const result = determineHeroImageIntent(input());
    // industry 98, plantStatus 92, tradeCategories 92 -> 92.
    expect(result.confidencePct).toBe(92);
  });

  it("falls when an upstream determination weakens", () => {
    const weak = input();
    weak.intelligence.plantStatus = { value: "Running Plant", confidencePct: 55 };
    expect(determinePrimaryMessage(weak).confidencePct).toBe(55);
  });

  it("states the cap and its cause in the reason", () => {
    const result = determinePrimaryMessage(input());
    expect(result.reason).toContain("Confidence capped at");
    expect(result.reason).toContain("least certain input");
  });

  it("never lets a campaign decision outrank the intelligence beneath it", () => {
    const assessment = assessCampaign(input());
    for (const determination of assessment.determinations) {
      if (determination.value === UNKNOWN) continue;
      for (const dependency of determination.dependsOn) {
        const upstream = input().intelligence[dependency];
        if (!upstream) continue;
        expect(determination.confidencePct).toBeLessThanOrEqual(upstream.confidencePct);
      }
    }
  });
});

describe("determinism", () => {
  it("produces an identical campaign on repeated runs", () => {
    const runs = Array.from({ length: 5 }, () => assessCampaign(input()));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it("gives the same answer for the same intelligence regardless of position order", () => {
    const reversed = input();
    reversed.jobOrder.positions = [...reversed.jobOrder.positions].reverse();
    const values = (assessment: ReturnType<typeof assessCampaign>) =>
      assessment.determinations.map((d) => [d.attribute, d.value]);
    expect(values(assessCampaign(input()))).toEqual(values(assessCampaign(reversed)));
  });
});

describe("campaign strategy by plant status", () => {
  it.each([
    ["Shutdown", "Short-term concentrated earning", "Deadline-driven"],
    ["Turnaround", "Short-term concentrated earning", "Deadline-driven"],
    ["Commissioning", "New project experience", "Milestone-driven"],
    ["Construction", "Sustained project duration", "Phase-driven"],
    ["Running Plant", "Career Stability", "Steady-state"],
  ])("reads %s as %s with %s urgency", (plantStatus, motivation, urgency) => {
    const scoped = input();
    scoped.intelligence.plantStatus = { value: plantStatus, confidencePct: 92 };

    expect(determineCandidateMotivation(scoped).value).toBe(motivation);
    expect(determineUrgencyStrategy(scoped).value).toContain(urgency);
  });

  it("lets stated urgency sharpen a schedule without inventing one", () => {
    const urgent = input();
    urgent.intelligence.urgency = { value: "Immediate", confidencePct: 70 };
    const result = determineUrgencyStrategy(urgent);

    expect(result.value).toContain("immediate priority");
    expect(result.reason).toContain("does not invent one");
  });
});

describe("audience governs tone and information order", () => {
  it("speaks to the most specialised audience present", () => {
    // A drive mixing helpers and instrument technicians must address the
    // technicians — they are the ones who would not otherwise recognise it.
    const mixed = input();
    mixed.intelligence.tradeCategories = {
      value: "General Labour, Instrumentation",
      confidencePct: 92,
    };
    expect(determineAudienceType(mixed).value).toBe("Certified technical specialists");
  });

  it.each([
    ["Healthcare", "Licensed healthcare professionals"],
    ["Supervision & Management", "Supervisory and management professionals"],
    ["General Labour", "General workforce"],
    ["Welding & Fabrication", "Skilled trades workforce"],
  ])("maps %s to %s", (category, audience) => {
    const scoped = input();
    scoped.intelligence.tradeCategories = { value: category, confidencePct: 90 };
    expect(determineAudienceType(scoped).value).toBe(audience);
  });

  it("orders information for the audience, and says it is not placement", () => {
    const result = determineInformationPriority(input());
    expect(result.value).toContain("Trade and certification");
    expect(result.reason).toContain("not where anything is placed");
  });
});

describe("trust strategy follows compliance, not content", () => {
  it("stops the campaign when compliance is BLOCKED", () => {
    const blocked = input({ compliance: { readiness: "BLOCKED", agencyVerified: true } });
    const result = determineTrustStrategy(blocked);
    expect(result.value).toContain("Do not communicate");
    expect(result.reason).toContain("publishes the violation");
  });

  it("withholds the verification mark for an unverified agency", () => {
    const unverified = input({ compliance: { readiness: "ACTION_REQUIRED", agencyVerified: false } });
    const result = determineTrustStrategy(unverified);
    expect(result.value).toContain("no verification mark");
    expect(result.reason).toContain("launders exactly the risk it signals");
  });

  it("leads with verified credentials when verification is current", () => {
    expect(determineTrustStrategy(input()).value).toContain("Verified credentials foremost");
  });

  it("is UNKNOWN when compliance itself could not be assessed", () => {
    const uncovered = input({ compliance: { readiness: UNKNOWN, agencyVerified: false } });
    const result = determineTrustStrategy(uncovered);
    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("present an unchecked corridor as a cleared one");
  });
});

describe("nothing is invented", () => {
  it("leads with the agency when no employer is named, asserting nothing about prominence", () => {
    const anonymous = input();
    anonymous.jobOrder.employerName = null;
    const result = determineEmployerBrandingPriority(anonymous);

    expect(result.value).toBe("Agency-forward");
    expect(result.reason).toContain("the platform holds no such data");
  });

  it("refuses to pick a campaign language when none was stated", () => {
    // JobOrder Intelligence deliberately refuses to infer language from
    // the destination; this engine must not undo that refusal.
    const result = determineLanguageStrategy(withUnknown("languagesRequired"));
    expect(result.value).toBe(UNKNOWN);
  });

  it("notes when the CTA cannot state an interview date or contact", () => {
    const bare = input();
    bare.jobOrder.interviewDateStated = false;
    bare.jobOrder.contactStated = false;
    const result = determineCtaStrategy(bare);

    expect(result.reason).toContain("no interview date");
    expect(result.reason).toContain("no contact");
  });

  it("reports UNKNOWN for a strategy the map does not define", () => {
    const exotic = input();
    exotic.intelligence.hiringPattern = { value: "Seasonal Rotation", confidencePct: 90 };
    const result = determineObjective(exotic);

    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("rather than approximated from a neighbouring case");
  });

  it("reports UNKNOWN campaign density when there are no positions", () => {
    const empty = input();
    empty.jobOrder.positions = [];
    expect(determineCampaignDensity(empty).value).toBe(UNKNOWN);
  });
});

describe("the engine stays on its side of the line", () => {
  it("never emits a layout, typography, colour or position decision", () => {
    const serialized = JSON.stringify(assessCampaign(input())).toLowerCase();
    for (const forbidden of [
      "font", "typeface", "typography", "pixel", "px", "colour", "color",
      "hex", "#", "margin", "padding", "align", "top-left", "bottom-right",
      "column", "grid", "canvas", "render",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("describes image SUBJECT MATTER only, never composition", () => {
    const hero = determineHeroImageIntent(input());
    const focus = determineVisualFocus(input());
    // Subject is in scope; how it is framed is not.
    expect(hero.value).toContain("workers at task");
    expect(focus.reason).toContain("subject of the image");
    for (const composition of ["close-up", "wide shot", "angle", "lighting", "crop"]) {
      expect(`${hero.value} ${focus.value}`.toLowerCase()).not.toContain(composition);
    }
  });

  it("states that campaign density is communication load, not layout", () => {
    const result = determineCampaignDensity(input());
    expect(result.reason).toContain("how it is arranged is decided later");
  });

  it("produces no advertisement copy — only strategy", () => {
    const assessment = assessCampaign(input());
    // Strategy names an approach; it never writes the headline itself.
    for (const determination of assessment.determinations) {
      expect(determination.value).not.toMatch(/^["'].*["']$/);
    }
  });
});

describe("the assessment as a whole", () => {
  it("covers every attribute the specification requires", () => {
    expect(assessCampaign(input()).determinations.map((d) => d.attribute)).toEqual(
      expect.arrayContaining([
        "primaryCampaignObjective", "primaryCommunicationMessage", "secondaryMessage",
        "candidateMotivation", "trustStrategy", "employerBrandingPriority",
        "recruitmentUrgencyStrategy", "ctaStrategy", "languageStrategy", "audienceType",
        "communicationTone", "informationPriority", "campaignDensity", "heroImageIntent",
        "visualFocus", "suggestedImageContext",
      ]),
    );
  });

  it("gives every determination a source, confidence and reason", () => {
    for (const determination of assessCampaign(input()).determinations) {
      expect(determination.source.length).toBeGreaterThan(0);
      expect(determination.reason.length).toBeGreaterThan(0);
      expect(determination.confidencePct).toBeGreaterThanOrEqual(0);
      expect(determination.confidencePct).toBeLessThanOrEqual(100);
    }
  });

  it("records what each decision depended on", () => {
    for (const determination of assessCampaign(input()).determinations) {
      expect(Array.isArray(determination.dependsOn)).toBe(true);
    }
  });

  it("handles a requirement with no intelligence at all without throwing", () => {
    const assessment = assessCampaign(
      input({
        intelligence: {},
        compliance: { readiness: UNKNOWN, agencyVerified: false },
        jobOrder: { employerName: null, interviewDateStated: false, contactStated: false, positions: [] },
      }),
    );
    expect(assessment.overallConfidencePct).toBeLessThanOrEqual(100);
    expect(assessment.unknownAttributes.length).toBeGreaterThan(0);
  });
});
