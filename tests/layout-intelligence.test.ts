import { describe, expect, it } from "vitest";
import {
  assessLayout,
  determineColourMood,
  determineCtaPriority,
  determineHeroImageImportance,
  determineInformationDensity,
  determineLayoutFamily,
  determineLogoImportance,
  determineMobileOrPrintFirst,
  determineMultiLanguageRequirement,
  determinePublicationType,
  determineQrImportance,
  determineReadingDirection,
  determineTextImageRatio,
  determineTrustElementPriority,
  determineTypographyStrategy,
  determineVisualHierarchy,
  determineWhitespaceStrategy,
  type LayoutInput,
} from "@/server/layout-intelligence/determinations";
import { UNKNOWN } from "@/server/job-order-intelligence/determinations";

/**
 * Layout Intelligence (Task 006).
 *
 * The three properties that matter most:
 *
 *   1. INPUT IS CAMPAIGN INTELLIGENCE ONLY. Every fixture below is a
 *      Campaign Intelligence output; nothing raw is read.
 *   2. UNKNOWN PROPAGATES, with confidence capped by the least certain
 *      dependency — identical guarantee to Task 005, one stage later.
 *   3. THE ENGINE NEVER CROSSES INTO RENDERING. No coordinate, pixel,
 *      canvas size, font name or colour value may appear anywhere in
 *      its output.
 */

function input(overrides: Partial<LayoutInput["campaign"]> = {}): LayoutInput {
  return {
    campaign: {
      audienceType: { value: "Skilled trades workforce", confidencePct: 90 },
      communicationTone: { value: "Direct and concrete", confidencePct: 90 },
      campaignDensity: { value: "HIGH", confidencePct: 100 },
      trustStrategy: {
        value: "Verified credentials foremost — licence number and verification mark",
        confidencePct: 100,
      },
      ctaStrategy: {
        value: "Open trade-test or walk-in call, with a stated venue and date",
        confidencePct: 92,
      },
      languageStrategy: { value: "Communicate in English", confidencePct: 70 },
      employerBrandingPriority: { value: "Employer-forward", confidencePct: 100 },
      heroImageIntent: {
        value: "Oil & Gas — an operating plant during routine maintenance, with Instrumentation and Mechanical workers at task",
        confidencePct: 92,
      },
      informationPriority: {
        value: "Trade and headcount > Salary > Destination > Interview details > How to apply",
        confidencePct: 90,
      },
      ...overrides,
    },
  };
}

function withUnknown(attribute: string, base = input()): LayoutInput {
  return { campaign: { ...base.campaign, [attribute]: { value: UNKNOWN, confidencePct: 0 } } };
}

describe("input is Campaign Intelligence only", () => {
  it("takes every dependency from the campaign map and nothing else", () => {
    // Every determiner's dependsOn must be a subset of the fixture's own
    // keys — confirming no determiner reaches for a JobOrder/raw fact.
    const assessment = assessLayout(input());
    const knownAttributes = new Set(Object.keys(input().campaign));
    for (const determination of assessment.determinations) {
      for (const dependency of determination.dependsOn) {
        if (dependency === "layoutFamily") continue; // internal, derived within this engine
        expect(knownAttributes.has(dependency)).toBe(true);
      }
    }
  });
});

describe("UNKNOWN propagates from Campaign Intelligence", () => {
  it.each([
    ["audienceType", determinePublicationType],
    ["campaignDensity", determinePublicationType],
    ["audienceType", determineLayoutFamily],
    ["campaignDensity", determineInformationDensity],
    ["languageStrategy", determineReadingDirection],
    ["informationPriority", determineVisualHierarchy],
    ["audienceType", determineHeroImageImportance],
    ["heroImageIntent", determineHeroImageImportance],
    ["audienceType", determineTextImageRatio],
    ["trustStrategy", determineQrImportance],
    ["employerBrandingPriority", determineLogoImportance],
    ["trustStrategy", determineTrustElementPriority],
    ["ctaStrategy", determineCtaPriority],
    ["languageStrategy", determineMultiLanguageRequirement],
    ["campaignDensity", determineWhitespaceStrategy],
  ])("makes the decision UNKNOWN when %s is UNKNOWN", (attribute, determiner) => {
    const result = determiner(withUnknown(attribute));
    expect(result.value).toBe(UNKNOWN);
    expect(result.confidencePct).toBe(0);
    expect(result.reason).toContain(attribute);
  });

  it("names the missing Campaign Intelligence input, not a vague blank", () => {
    const result = determineLayoutFamily(withUnknown("audienceType"));
    expect(result.reason).toContain("UNKNOWN in Campaign Intelligence");
    expect(result.reason).toContain("a guess");
  });

  it("cascades through mobile-or-print-first, which derives from this engine's own layout family", () => {
    const result = determineMobileOrPrintFirst(withUnknown("audienceType"));
    expect(result.value).toBe(UNKNOWN);
    expect(result.reason).toContain("layout family is UNKNOWN");
  });

  it("treats a missing Campaign Intelligence attribute exactly like an UNKNOWN one", () => {
    const assessment = assessLayout({ campaign: {} });
    expect(assessment.unknownAttributes.length).toBeGreaterThan(10);
  });
});

describe("confidence is capped by the least certain Campaign Intelligence input", () => {
  it("never exceeds the weakest dependency", () => {
    // audienceType 90, campaignDensity 100 -> 90.
    expect(determinePublicationType(input()).confidencePct).toBe(90);
  });

  it("falls when the upstream campaign determination weakens", () => {
    const weak = input({ audienceType: { value: "Skilled trades workforce", confidencePct: 55 } });
    expect(determinePublicationType(weak).confidencePct).toBe(55);
  });

  it("states the cap and its cause in the reason", () => {
    expect(determinePublicationType(input()).reason).toContain("Confidence capped at 90%");
  });

  it("never lets a layout decision outrank the campaign intelligence beneath it", () => {
    const assessment = assessLayout(input());
    for (const determination of assessment.determinations) {
      if (determination.value === UNKNOWN) continue;
      for (const dependency of determination.dependsOn) {
        const upstreamValue = input().campaign[dependency];
        if (!upstreamValue) continue;
        expect(determination.confidencePct).toBeLessThanOrEqual(upstreamValue.confidencePct);
      }
    }
  });
});

describe("determinism", () => {
  it("produces an identical publication strategy on repeated runs", () => {
    const runs = Array.from({ length: 5 }, () => assessLayout(input()));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });
});

describe("publication type and layout family by audience and density", () => {
  it.each([
    ["Licensed healthcare professionals", "LOW", "Corporate Premium"],
    ["Supervisory and management professionals", "HIGH", "Corporate Premium"],
    ["Certified technical specialists", "LOW", "Industrial Premium"],
    ["Certified technical specialists", "HIGH", "High Density"],
    ["Skilled trades workforce", "MEDIUM", "Industrial Premium"],
    ["Skilled trades workforce", "HIGH", "High Density"],
    ["General workforce", "MEDIUM", "High Density"],
    ["General workforce", "HIGH", "Newspaper Classified"],
  ])("resolves %s at %s density to %s", (audience, density, family) => {
    const scoped = input({
      audienceType: { value: audience, confidencePct: 90 },
      campaignDensity: { value: density, confidencePct: 100 },
    });
    expect(determineLayoutFamily(scoped).value).toBe(family);
  });

  it("recommends print and newspaper for a high-density bulk drive, and withholds them at low density", () => {
    const bulk = input({ campaignDensity: { value: "HIGH", confidencePct: 100 } });
    const small = input({ campaignDensity: { value: "LOW", confidencePct: 100 } });

    expect(determinePublicationType(bulk).value).toContain("Newspaper");
    expect(determinePublicationType(bulk).value).toContain("Print");
    expect(determinePublicationType(small).value).not.toContain("Newspaper");
  });

  it("routes management and healthcare audiences toward LinkedIn", () => {
    const management = input({ audienceType: { value: "Supervisory and management professionals", confidencePct: 90 } });
    expect(determinePublicationType(management).value).toContain("LinkedIn");
  });
});

describe("hero image importance, text/image ratio and colour mood by audience", () => {
  it("rates the general workforce and skilled trades as high hero-image importance", () => {
    for (const audience of ["Skilled trades workforce", "General workforce"]) {
      const scoped = input({ audienceType: { value: audience, confidencePct: 90 } });
      expect(determineHeroImageImportance(scoped).value).toContain("High");
    }
  });

  it("rates management as low-to-medium hero-image importance, favouring restraint", () => {
    const scoped = input({ audienceType: { value: "Supervisory and management professionals", confidencePct: 90 } });
    expect(determineHeroImageImportance(scoped).value).toContain("Low to Medium");
  });

  it("never emits a colour value — mood only", () => {
    const mood = determineColourMood(input());
    expect(mood.reason).toContain("no colour value");
    expect(mood.value).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});

describe("reading direction", () => {
  it("reads left-to-right for English", () => {
    expect(determineReadingDirection(input()).value).toBe("Left-to-right");
  });

  it("reads left-to-right for a mixed Arabic and English requirement", () => {
    const mixed = input({ languageStrategy: { value: "Communicate in Arabic, English", confidencePct: 70 } });
    expect(determineReadingDirection(mixed).value).toBe("Left-to-right");
  });

  it("reads right-to-left only for an Arabic-only requirement", () => {
    const arabicOnly = input({ languageStrategy: { value: "Communicate in Arabic", confidencePct: 70 } });
    expect(determineReadingDirection(arabicOnly).value).toBe("Right-to-left");
  });
});

describe("multi-language requirement", () => {
  it("flags two or more languages as requiring visual accommodation", () => {
    const bilingual = input({ languageStrategy: { value: "Communicate in Arabic, English", confidencePct: 70 } });
    const result = determineMultiLanguageRequirement(bilingual);
    expect(result.value).toContain("Yes");
    expect(result.value).toContain("2 languages");
  });

  it("reports no multi-language need for a single language", () => {
    expect(determineMultiLanguageRequirement(input()).value).toContain("No");
  });
});

describe("trust presentation follows Campaign Intelligence's trust strategy", () => {
  it("marks the QR not applicable when the campaign is blocked", () => {
    const blocked = input({
      trustStrategy: { value: "Do not communicate — compliance is unresolved", confidencePct: 100 },
    });
    expect(determineQrImportance(blocked).value).toContain("Not applicable");
    expect(determineTrustElementPriority(blocked).value).toContain("Not applicable");
  });

  it("orders licence disclosure before the verification mark when unverified", () => {
    const unverified = input({
      trustStrategy: { value: "Licence disclosure only — no verification mark", confidencePct: 100 },
    });
    expect(determineTrustElementPriority(unverified).value).toContain("no verification mark");
  });

  it("makes the verification mark critical when verified", () => {
    expect(determineQrImportance(input()).value).toContain("Critical");
  });
});

describe("logo importance follows employer branding priority", () => {
  it("is secondary when the employer is named", () => {
    expect(determineLogoImportance(input()).value).toContain("Secondary");
  });

  it("is primary when no employer is named", () => {
    const agencyForward = input({ employerBrandingPriority: { value: "Agency-forward", confidencePct: 100 } });
    expect(determineLogoImportance(agencyForward).value).toContain("Primary");
  });
});

describe("CTA priority follows Campaign Intelligence's CTA strategy, without retyping it", () => {
  it("makes venue and date primary for a bulk mobilization", () => {
    expect(determineCtaPriority(input()).value).toContain("venue and date");
  });

  it("makes a management CTA understated", () => {
    const management = input({
      ctaStrategy: { value: "Confidential application to a named contact", confidencePct: 90 },
    });
    expect(determineCtaPriority(management).value).toContain("Secondary, understated");
  });

  it("returns UNKNOWN for a CTA sentence the strategy map does not recognise", () => {
    const exotic = input({ ctaStrategy: { value: "Some future CTA sentence nobody wrote yet", confidencePct: 90 } });
    expect(determineCtaPriority(exotic).value).toBe(UNKNOWN);
  });
});

describe("whitespace strategy follows density", () => {
  it.each([
    ["LOW", "Generous"],
    ["MEDIUM", "Moderate"],
    ["HIGH", "Minimal"],
  ])("resolves %s density to %s whitespace", (density, expected) => {
    const scoped = input({ campaignDensity: { value: density, confidencePct: 100 } });
    expect(determineWhitespaceStrategy(scoped).value).toContain(expected);
  });
});

describe("mobile-first vs print-first follows this engine's own layout family", () => {
  it("is print-first only for the newspaper classified family", () => {
    const classified = input({
      audienceType: { value: "General workforce", confidencePct: 90 },
      campaignDensity: { value: "HIGH", confidencePct: 100 },
    });
    expect(determineMobileOrPrintFirst(classified).value).toBe("Print-first");
  });

  it("is mobile-first for every other family", () => {
    expect(determineMobileOrPrintFirst(input()).value).toBe("Mobile-first");
  });
});

describe("typography strategy is high-level only, never a font", () => {
  it("names a register, not a typeface", () => {
    const result = determineTypographyStrategy(input());
    expect(result.reason).toContain("no font, size or weight is specified");
    for (const font of ["arial", "helvetica", "liberation", "times new roman", "roboto"]) {
      expect(result.value.toLowerCase()).not.toContain(font);
    }
  });
});

describe("the engine never crosses into rendering", () => {
  it("emits no coordinate, pixel, canvas size, font name or colour value anywhere in the assessment", () => {
    const serialized = JSON.stringify(assessLayout(input())).toLowerCase();
    for (const forbidden of [
      "px", "pixel", "coordinate", "canvas", "template",
      "arial", "helvetica", "liberation sans", "times new roman",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    // An actual hex colour or rgb() value is forbidden; the WORD "hex"
    // is not, since the engine's own explanatory text correctly cites it
    // to describe what it is refusing to specify.
    expect(serialized).not.toMatch(/#[0-9a-f]{3,8}\b/);
    expect(serialized).not.toMatch(/rgb\(/);
  });

  it("never states a width or height", () => {
    const serialized = JSON.stringify(assessLayout(input()));
    expect(serialized).not.toMatch(/\b\d{3,4}\s*x\s*\d{3,4}\b/i);
    expect(serialized).not.toMatch(/width|height/i);
  });

  it("produces no advertisement copy, only strategy", () => {
    for (const determination of assessLayout(input()).determinations) {
      expect(determination.value).not.toMatch(/^["'].*["']$/);
    }
  });
});

describe("every determination carries source, confidence and reason", () => {
  it("produces no determination without all three", () => {
    for (const determination of assessLayout(input()).determinations) {
      expect(determination.source.length).toBeGreaterThan(0);
      expect(determination.reason.length).toBeGreaterThan(0);
      expect(determination.confidencePct).toBeGreaterThanOrEqual(0);
      expect(determination.confidencePct).toBeLessThanOrEqual(100);
    }
  });

  it("covers every attribute the specification requires", () => {
    expect(assessLayout(input()).determinations.map((d) => d.attribute)).toEqual(
      expect.arrayContaining([
        "publicationType", "layoutFamily", "informationDensity", "readingDirection",
        "visualHierarchy", "heroImageImportance", "textImageRatio", "qrImportance",
        "logoImportance", "trustElementPriority", "ctaPriority", "typographyStrategy",
        "languageStrategy", "multiLanguageRequirement", "colourMood",
        "whitespaceStrategy", "mobileOrPrintFirst",
      ]),
    );
  });

  it("records what each decision depended on", () => {
    for (const determination of assessLayout(input()).determinations) {
      expect(Array.isArray(determination.dependsOn)).toBe(true);
    }
  });

  it("handles no Campaign Intelligence input at all without throwing", () => {
    const assessment = assessLayout({ campaign: {} });
    expect(assessment.overallConfidencePct).toBe(0);
    expect(assessment.determinations.every((d) => d.value === UNKNOWN)).toBe(true);
  });
});
