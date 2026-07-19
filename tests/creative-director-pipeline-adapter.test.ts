import { describe, expect, it } from "vitest";
import {
  buildCreativeDirectorBrief,
  creativeDirectionToVisualDecisions,
  factsToCreativeInput,
  runCreativeDirector,
} from "@/server/generation/creative-director";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";
import type { AgencyVisualDna } from "@/server/generation/archetypes/visual-dna";
import { getFeatureFlags } from "@/lib/env";

// Bilfinger-shaped facts (has salary) mirroring the app's AdvertisementFacts.
const FACTS: AdvertisementFacts = {
  header: "Mega Shutdown Project in Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  positions: [
    { title: "QA/QC Inspector", count: 2 },
    { title: "Welder - TIG", count: 5 },
  ],
  benefits: [
    { label: "Basic Salary" },
    { label: "Overtime up to 4 hours" },
    { label: "Food", detail: "SR 300" },
  ],
  interview: [{ date: "14–15 July", location: "Baroda" }],
  contact: { phone: "+91 22 1234 5678" },
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
};

describe("Phase B — Background Brief Adapter", () => {
  it("factsToCreativeInput maps AdvertisementFacts to CreativeInput without inventing data", () => {
    const input = factsToCreativeInput(FACTS);
    expect(input.employer).toBe("Bilfinger");
    expect(input.industry).toBe("Oil & Gas");
    expect(input.country).toBe("Saudi Arabia");
    expect(input.header).toBe(FACTS.header);
    expect(input.positions).toEqual([
      { title: "QA/QC Inspector", count: 2 },
      { title: "Welder - TIG", count: 5 },
    ]);
    expect(input.agencyName).toBe("Al-Yousuf Enterprises LLP");
    expect(input.raLicenseId).toBe("9986");
    expect(input.channel).toBe("DTP_NEWSPAPER");
  });

  it("factsToCreativeInput carries through optional channel/aspectRatio/palette", () => {
    const input = factsToCreativeInput(FACTS, {
      channel: "SOCIAL_SQUARE",
      aspectRatio: 1,
      agencyPalette: { primary: "#000", secondary: "#111", accent: "#222" },
    });
    expect(input.channel).toBe("SOCIAL_SQUARE");
    expect(input.aspectRatio).toBe(1);
    expect(input.agencyPalette).toEqual({ primary: "#000", secondary: "#111", accent: "#222" });
  });

  it("creativeDirectionToVisualDecisions maps every required field of CreativeBrainVisualDecisions", () => {
    const direction = runCreativeDirector(factsToCreativeInput(FACTS));
    const decisions = creativeDirectionToVisualDecisions(direction);
    expect(decisions.primaryHook).toBe(direction.psychology.dominantHook);
    expect(decisions.visualStory).toBeDefined();
    expect(decisions.colourMood).toBeDefined();
    expect(decisions.destination).toBe("Saudi Arabia");
    expect(decisions.projectType).toBe(direction.project.projectType);
    expect(["HERO_LEFT_DATA_RIGHT", "HERO_RIGHT_DATA_LEFT"]).toContain(decisions.compositionPriority);
    expect(["SPARSE", "MEDIUM", "HIGH"]).toContain(decisions.contentDensityClass);
  });

  it("never places the employer as the sole visual weight when the brand isn't a magnet", () => {
    const direction = runCreativeDirector(factsToCreativeInput(FACTS));
    const decisions = creativeDirectionToVisualDecisions(direction);
    expect(decisions.visualWeight).not.toMatch(/^Bilfinger$/);
  });

  it("buildCreativeDirectorBrief produces a non-empty prompt plus the CreativeDirection for traceability", () => {
    const { prompt, direction } = buildCreativeDirectorBrief(FACTS);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(50);
    expect(Object.isFrozen(direction)).toBe(true);
    expect(direction.traceability.length).toBeGreaterThanOrEqual(21);
  });

  it("is deterministic — same facts yield the same prompt and direction", () => {
    const a = buildCreativeDirectorBrief(FACTS);
    const b = buildCreativeDirectorBrief(FACTS);
    expect(a.prompt).toEqual(b.prompt);
    expect(JSON.stringify(a.direction)).toEqual(JSON.stringify(b.direction));
  });

  it("respects agency Visual DNA palette when supplied via ctx.dna", () => {
    const dna: AgencyVisualDna = {
      primaryColor: "#0B3D2E",
      secondaryColor: "#C9A227",
      accentColor: "#E4572E",
      hasLogo: true,
    };
    const { direction } = buildCreativeDirectorBrief(FACTS, { dna });
    expect(direction.colour.agencyPaletteApplied).toBe(true);
  });
});

describe("Phase B — Feature flag precedence (zero behaviour drift)", () => {
  it("CREATIVE_DIRECTOR_BRAIN defaults to false — production path untouched", () => {
    expect(getFeatureFlags().creativeDirectorBrain).toBe(false);
  });

  it("CREATIVE_BRAIN_BACKGROUND_BRIEF defaults to false — production path untouched", () => {
    expect(getFeatureFlags().creativeBrainBackgroundBrief).toBe(false);
  });

  it("both flags OFF means neither Brain path is reachable from getFeatureFlags()", () => {
    const flags = getFeatureFlags();
    expect(flags.creativeDirectorBrain || flags.creativeBrainBackgroundBrief).toBe(false);
  });
});
