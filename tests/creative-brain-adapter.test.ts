import { describe, expect, it } from "vitest";
import {
  buildAdCopyPlan,
  buildCompositionDirectives,
} from "@/server/generation/archetypes";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";
import type { AgencyVisualDna } from "@/server/generation/archetypes/visual-dna";
import {
  generateGptBackgroundBrief,
  toCreativeBrainDecisions,
} from "@/server/generation/background-brief";
import { getFeatureFlags } from "@/lib/env";

/** The Bilfinger reference as PRODUCTION artifacts (grounded facts). */
const FACTS: AdvertisementFacts = {
  header: "Urgently Hiring for Oil & Gas Shutdown in Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  positions: [
    { title: "Welders — TIG & Multi", count: 10 },
    { title: "Instrument & Control Technician", count: 5 },
    { title: "Rotating Equipment Technician", count: 5 },
    { title: "Mechanical Technician", count: 5 },
    { title: "Electrical Technician", count: 5 },
  ],
  benefits: [{ label: "Basic Salary" }, { label: "Daily Overtime up to 4 Hours" }],
  interview: [
    { date: "14–15 July", location: "Baroda" },
    { date: "18 July", location: "Mumbai" },
  ],
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  footer: null,
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
};

const DNA: AgencyVisualDna = {
  primaryColor: "#0B3D2E",
  secondaryColor: "#C9A227",
  accentColor: "#E4572E",
  hasLogo: true,
};

function buildDecisions() {
  const copy = buildAdCopyPlan(FACTS, { hasCompensationSignal: false });
  const directives = buildCompositionDirectives(FACTS, { archetype: "VISUAL_HERO", copy });
  return toCreativeBrainDecisions({ facts: FACTS, copy, directives, dna: DNA, aspectRatio: 1 });
}

describe("toCreativeBrainDecisions — Creative Brain adapter (FULL PARITY)", () => {
  it("derives grounded creative direction from Oil & Gas + Saudi Arabia", () => {
    const d = buildDecisions();
    expect(d.industry).toBe("Oil & Gas");
    expect(d.destination).toBe("Saudi Arabia");
    expect(d.colourMood).toBe("DESERT_GOLD");
    expect(d.visualStory).toBe("WORKER_HERO");
    expect(d.emotionalDirection[0]).toBe("MONEY"); // benefits present
    expect(d.emotionalDirection).toContain("PRESTIGE"); // Gulf oil & gas
    expect(d.emotionalDirection).toContain("URGENCY"); // interviews present
  });

  it("carries content density through (full parity, no loss)", () => {
    const d = buildDecisions();
    expect(d.contentDensityClass).toBeDefined();
    expect(["SPARSE", "MEDIUM", "HIGH"]).toContain(d.contentDensityClass);
  });

  it("carries Agency Visual DNA palette through — colours only, never the name", () => {
    const d = buildDecisions();
    expect(d.agencyPalette).toEqual({
      primary: "#0B3D2E",
      secondary: "#C9A227",
      accent: "#E4572E",
    });
  });

  it("never derives factual overlay content into the decisions", () => {
    const d = buildDecisions();
    const blob = JSON.stringify(d).toLowerCase();
    expect(blob).not.toContain("bilfinger"); // employer name
    expect(blob).not.toContain("al yousuf"); // agency name
    expect(blob).not.toContain("welder"); // positions
    expect(blob).not.toContain("9324995767"); // phone
    expect(blob).not.toContain("@"); // email
    expect(blob).not.toContain("baroda"); // interview city
    expect(blob).not.toContain("9986"); // RA license
  });

  it("projectType is a thematic industry descriptor, not roles or the header", () => {
    const d = buildDecisions();
    expect(d.projectType).toBe("a major oil & gas project");
  });
});

describe("generateGptBackgroundBrief — full-parity prompt from adapter output", () => {
  it("combines creative direction + agency identity + density guidance", () => {
    const { prompt, traceability } = generateGptBackgroundBrief(buildDecisions());
    // Creative direction
    expect(prompt).toMatch(/desert gold/i);
    expect(prompt).toMatch(/refinery/i);
    // Agency identity (palette biases the grade)
    expect(prompt).toContain("AGENCY VISUAL IDENTITY");
    expect(prompt).toContain("#0B3D2E");
    expect(prompt).toContain("#C9A227");
    expect(prompt).toContain("#E4572E");
    // Density guidance present
    expect(traceability.contentDensityClass).not.toBeNull();
    expect(traceability.agencyPaletteApplied).toBe(true);
  });

  it("still exposes no factual overlay content or renderable text in the prompt", () => {
    const { prompt } = generateGptBackgroundBrief(buildDecisions());
    expect(prompt).not.toMatch(/bilfinger/i);
    expect(prompt).not.toMatch(/al yousuf/i);
    expect(prompt).not.toMatch(/welder|technician/i);
    expect(prompt).not.toMatch(/\+?\d[\d\s-]{7,}/); // phone-like
    expect(prompt).not.toMatch(/[\w.]+@[\w.]+/); // email
    expect(prompt).toContain("NO text");
  });

  it("agency palette biases the grade WITHOUT rendering colour as shapes/text", () => {
    const { prompt } = generateGptBackgroundBrief(buildDecisions());
    expect(prompt).toMatch(/without rendering these colours as blocks, swatches, bars, or graphic shapes/i);
  });
});

describe("feature flag — default OFF (production path unchanged)", () => {
  it("CREATIVE_BRAIN_BACKGROUND_BRIEF defaults to false", () => {
    // No env override in the test environment → flag must be OFF.
    expect(getFeatureFlags().creativeBrainBackgroundBrief).toBe(false);
  });
});
