import { describe, expect, it } from "vitest";
import { runCreativeDirector, type CreativeInput } from "@/server/generation/creative-director";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";

// Sprint 007: buildCommercialAdvertisementBrief is a pure shape-adapter over
// the EXISTING, UNCHANGED CreativeDirection output — it must add no new
// intelligence, only restructure decisions the Brain already made.

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

const BILFINGER: CreativeInput = {
  employer: "Bilfinger",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  header: "Mega Shutdown Project in Saudi Arabia",
  positions: [
    { title: "QA/QC Inspector", count: 2, salary: "5,500" },
    { title: "Welder - TIG", count: 5, salary: "2,500" },
  ],
  benefits: [{ label: "Basic Salary" }, { label: "Overtime up to 4 hours" }, { label: "Food", detail: "SR 300" }],
  interview: [{ date: "14–15 July", location: "Baroda" }],
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  agencyPalette: { primary: "#0B3D2E", secondary: "#C9A227", accent: "#E4572E" },
  channel: "DTP_NEWSPAPER",
};

describe("buildCommercialAdvertisementBrief", () => {
  it("maps the Brain's opportunity hero and psychology into the commercial goal, without inventing new values", () => {
    const direction = runCreativeDirector(HALLIBURTON);
    const brief = buildCommercialAdvertisementBrief(direction);

    expect(brief.commercialGoal.hero).toBe(direction.opportunity.hero);
    expect(brief.commercialGoal.motivation).toBe(direction.psychology.motivation);
    expect(brief.candidatePsychology.dominantHook).toBe(direction.psychology.dominantHook);
  });

  it("reading order leads with the opportunity hero and ends with trust", () => {
    const direction = runCreativeDirector(BILFINGER);
    const brief = buildCommercialAdvertisementBrief(direction);

    expect(brief.readingOrder[0]).toBe(direction.opportunity.hero);
    expect(brief.readingOrder[brief.readingOrder.length - 1]).toBe("TRUST");
    expect(new Set(brief.readingOrder).size).toBe(brief.readingOrder.length);
  });

  it("reserves a fixed bottom-right trust zone GPT must never draw into", () => {
    const direction = runCreativeDirector(BILFINGER);
    const brief = buildCommercialAdvertisementBrief(direction);
    expect(brief.trustPlacement.reservedZone).toBe("BOTTOM_RIGHT");
  });

  it("classifies whitespace density from vacancy count, matching the pipeline adapter's own thresholds", () => {
    const sparse = buildCommercialAdvertisementBrief(runCreativeDirector(BILFINGER));
    const dense = buildCommercialAdvertisementBrief(runCreativeDirector(HALLIBURTON));
    expect(sparse.whitespaceDirection.density).not.toBe("HIGH");
    expect(dense.whitespaceDirection.density).toBe("HIGH");
  });

  it("publication readiness is false whenever the Brain's truth validation fails, regardless of commercial score", () => {
    const direction = runCreativeDirector(HALLIBURTON);
    const brief = buildCommercialAdvertisementBrief(direction);
    expect(brief.publicationReadiness).toBe(
      direction.commercialScore.gate === "AUTO_APPROVE" && direction.truth.pass,
    );
  });

  it("carries the full commercial score through untouched", () => {
    const direction = runCreativeDirector(BILFINGER);
    const brief = buildCommercialAdvertisementBrief(direction);
    expect(brief.commercialScore).toBe(direction.commercialScore.overall);
  });
});
