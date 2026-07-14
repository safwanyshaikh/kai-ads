import { beforeAll, describe, expect, it } from "vitest";
import {
  MAX_ACCEPTANCE_ITERATIONS,
  runAcceptanceLoop,
  type AcceptanceLoopDeps,
} from "@/server/generation/acceptance/acceptance-loop";
import { composeAdvertisement, recommendArchetype, selectArchetype } from "@/server/generation/archetypes";
import type { AdvertisementFacts, CompositionPlan } from "@/server/generation/archetypes";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { getPlatformFormat } from "@/lib/platform-formats";
import {
  visualQaResultSchema,
  VISUAL_QA_PASS_THRESHOLD,
  type VisualQaProvider,
  type VisualQaResult,
} from "@/server/ai/visual-qa";
import sharp from "sharp";

const platformFormat = getPlatformFormat("instagram_post");
const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "av_loop_test", advertisementId: "ad_loop_test" });

const bilfingerFacts: AdvertisementFacts = Object.freeze({
  header: "Hiring for Bilfinger Shutdown Project",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  positions: [
    { title: "Welders — TIG & Multi" },
    { title: "Instrument and Control Technician" },
    { title: "Rotating Equipment Technician" },
    { title: "Mechanical Technician" },
    { title: "Electrical Technician" },
  ],
  benefits: [{ label: "Basic salary + daily up to 4 hours OT" }],
  interview: [
    { date: "14th & 15th July", location: "Baroda" },
    { date: "18th July", location: "Mumbai" },
  ],
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  footer: "All applicants must have experience in shutdown projects",
  agencyName: "AL Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
});

let basePlan: CompositionPlan;

beforeAll(async () => {
  const qr = await generateAndVerifyQr(qrUrl);
  expect(qr.decodable).toBe(true);
  basePlan = {
    archetype: "STRUCTURED_PROFESSIONAL",
    platformFormat,
    accentColor: "#0d4f8b",
    qrDataUri: `data:image/png;base64,${qr.png.toString("base64")}`,
    backgroundImageDataUri: null,
    agencyLogoDataUri: null,
  };
});

function qaScore(overallScore: number, corrections: VisualQaResult["requiredCorrections"] = []): VisualQaResult {
  return {
    overallScore,
    commercialQualityScore: overallScore,
    hierarchyScore: overallScore,
    readabilityScore: overallScore,
    imageryScore: overallScore,
    canvasUtilizationScore: overallScore,
    ctaScore: overallScore,
    trustScore: overallScore,
    defects: overallScore >= VISUAL_QA_PASS_THRESHOLD ? [] : ["synthetic defect"],
    catastrophicDefects: [],
    requiredCorrections: corrections,
    verdict: overallScore >= VISUAL_QA_PASS_THRESHOLD ? "PASS" : "REGENERATE",
  };
}

/** Scripted Brain C: returns the queued results in order and counts calls. */
function fakeQa(script: VisualQaResult[]): VisualQaProvider & { calls: number } {
  const provider = {
    name: "fake",
    calls: 0,
    async evaluate() {
      const result = script[Math.min(provider.calls, script.length - 1)];
      provider.calls += 1;
      return result;
    },
  };
  return provider;
}

function realDeps(overrides: Partial<AcceptanceLoopDeps> = {}): AcceptanceLoopDeps {
  return {
    compose: (facts, plan) => composeAdvertisement({ facts, plan }),
    rasterize: (svg) => rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx),
    visualQa: null,
    expectedQrUrl: qrUrl,
    cropQrRegion: (png) =>
      sharp(png)
        .extract({
          left: platformFormat.widthPx - Math.round(platformFormat.widthPx * 0.45),
          top: platformFormat.heightPx - Math.round(platformFormat.heightPx * 0.3),
          width: Math.round(platformFormat.widthPx * 0.45),
          height: Math.round(platformFormat.heightPx * 0.3),
        })
        .png()
        .toBuffer(),
    ...overrides,
  };
}

describe("visualQaResultSchema — structured verdict contract", () => {
  it("accepts a complete valid verdict", () => {
    expect(visualQaResultSchema.safeParse(qaScore(90)).success).toBe(true);
  });
  it("rejects out-of-range scores and unknown verdicts", () => {
    expect(visualQaResultSchema.safeParse({ ...qaScore(90), overallScore: 140 }).success).toBe(false);
    expect(visualQaResultSchema.safeParse({ ...qaScore(90), verdict: "MAYBE" }).success).toBe(false);
  });
});

describe("runAcceptanceLoop — closed-loop generation", () => {
  it(`passes on the first iteration at exactly the ${VISUAL_QA_PASS_THRESHOLD} threshold`, async () => {
    const qa = fakeQa([qaScore(VISUAL_QA_PASS_THRESHOLD)]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa }));
    expect(outcome.status).toBe("PASS");
    expect(outcome.finalScore).toBe(VISUAL_QA_PASS_THRESHOLD);
    expect(qa.calls).toBe(1);
    expect(outcome.iterations).toHaveLength(1);
  });

  it("regenerates below threshold and passes on a later iteration", async () => {
    const qa = fakeQa([
      qaScore(70, [{ type: "INCREASE_HEADLINE_EMPHASIS", note: "headline weak" }]),
      qaScore(88),
    ]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa }));
    expect(outcome.status).toBe("PASS");
    expect(qa.calls).toBe(2);
    // The correction was applied as bounded presentation tuning.
    expect(outcome.iterations[1].tuning.headlineScale).toBeCloseTo(1.12, 5);
  });

  it(`stops after exactly ${MAX_ACCEPTANCE_ITERATIONS} iterations and returns BLOCKED_VISUAL_QA with full defect history`, async () => {
    const qa = fakeQa([qaScore(60, [{ type: "IMPROVE_SPACING", note: "crowded" }])]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa }));
    expect(outcome.status).toBe("BLOCKED_VISUAL_QA");
    expect(qa.calls).toBe(MAX_ACCEPTANCE_ITERATIONS);
    expect(outcome.iterations).toHaveLength(MAX_ACCEPTANCE_ITERATIONS);
    expect(outcome.finalScore).toBe(60);
    expect(outcome.blockReason).toContain("synthetic defect");
  });

  it("never mutates the facts object (Truth Brain immutability through the correction loop)", async () => {
    const factsSnapshot = JSON.stringify(bilfingerFacts);
    const qa = fakeQa([
      qaScore(50, [
        { type: "INCREASE_HEADLINE_EMPHASIS", note: "x" },
        { type: "IMPROVE_SPACING", note: "y" },
      ]),
    ]);
    // bilfingerFacts is Object.freeze'd — any mutation attempt would throw
    // in strict mode; the snapshot comparison catches deep changes too.
    await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa }));
    expect(JSON.stringify(bilfingerFacts)).toBe(factsSnapshot);
  });

  it("never calls Visual QA when the source-fidelity gate fails (deterministic gates run first)", async () => {
    const qa = fakeQa([qaScore(99)]);
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      basePlan,
      realDeps({
        visualQa: qa,
        compose: () => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`,
      }),
    );
    expect(outcome.status).toBe("BLOCKED_DETERMINISTIC");
    expect(outcome.blockReason).toContain("Source fidelity");
    expect(qa.calls).toBe(0);
  });

  it("never calls Visual QA when the technical render gate fails, and a high AI score cannot override it", async () => {
    const qa = fakeQa([qaScore(100)]);
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      basePlan,
      realDeps({ visualQa: qa, rasterize: async () => Buffer.from("not a png") }),
    );
    expect(outcome.status).toBe("BLOCKED_DETERMINISTIC");
    expect(outcome.blockReason).toContain("Technical render");
    expect(qa.calls).toBe(0);
  });

  it("never calls Visual QA when the QR gate fails (wrong verification URL)", async () => {
    const qa = fakeQa([qaScore(100)]);
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      basePlan,
      realDeps({ visualQa: qa, expectedQrUrl: "https://kai.example/v/some-other-advertisement" }),
    );
    expect(outcome.status).toBe("BLOCKED_DETERMINISTIC");
    expect(outcome.blockReason).toContain("QR verification");
    expect(qa.calls).toBe(0);
  });

  it("the commercial launch threshold (95) rejects a score that passes the technical minimum (85)", async () => {
    const qa = fakeQa([qaScore(90)]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa, passThreshold: 95 }));
    expect(outcome.status).toBe("BLOCKED_VISUAL_QA");
    expect(qa.calls).toBe(MAX_ACCEPTANCE_ITERATIONS);
    expect(outcome.blockReason).toContain("below 95/100");
  });

  it("keeps the best-scoring iteration's artifact when a correction makes the score worse", async () => {
    const qa = fakeQa([
      qaScore(82, [{ type: "IMPROVE_SPACING", note: "x" }]),
      qaScore(87, [{ type: "IMPROVE_SPACING", note: "y" }]),
      qaScore(84),
    ]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa, passThreshold: 95 }));
    expect(outcome.status).toBe("BLOCKED_VISUAL_QA");
    expect(outcome.finalScore).toBe(87); // best, not last
    expect(outcome.blockReason).toContain("best score: 87");
  });

  it("a catastrophic defect blocks PASS even at a high overall score (score can never hide a broken output)", async () => {
    const catastrophic = { ...qaScore(95), catastrophicDefects: ["position text overlaps contact bar"] };
    const qa = fakeQa([catastrophic, catastrophic, catastrophic]);
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: qa }));
    expect(outcome.status).toBe("BLOCKED_VISUAL_QA");
    expect(qa.calls).toBe(MAX_ACCEPTANCE_ITERATIONS);
  });

  it("returns PASS_DETERMINISTIC_ONLY (not PASS) when the Visual QA Brain is not configured", async () => {
    const outcome = await runAcceptanceLoop(bilfingerFacts, basePlan, realDeps({ visualQa: null }));
    expect(outcome.status).toBe("PASS_DETERMINISTIC_ONLY");
    expect(outcome.finalScore).toBeNull();
  });

  it("degrades gracefully to PASS_DETERMINISTIC_ONLY when the vision API call fails", async () => {
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      basePlan,
      realDeps({
        visualQa: {
          name: "failing",
          evaluate: async () => {
            throw new Error("vision API down");
          },
        },
      }),
    );
    expect(outcome.status).toBe("PASS_DETERMINISTIC_ONLY");
    expect(outcome.iterations[0].visualQaError).toContain("vision API down");
  });

  it("reuses the generated image across layout-only corrections (no image regeneration call)", async () => {
    let imageRegenCalls = 0;
    const qa = fakeQa([qaScore(70, [{ type: "IMPROVE_SPACING", note: "crowded" }]), qaScore(90)]);
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      { ...basePlan, archetype: "VISUAL_HERO" },
      realDeps({
        visualQa: qa,
        regenerateImage: async () => {
          imageRegenCalls += 1;
          return null;
        },
      }),
    );
    expect(outcome.status).toBe("PASS");
    expect(imageRegenCalls).toBe(0);
  });

  it("regenerates imagery only when Visual QA explicitly requires REGENERATE_IMAGE on an imagery-bearing archetype", async () => {
    let imageRegenCalls = 0;
    const qa = fakeQa([qaScore(70, [{ type: "REGENERATE_IMAGE", note: "irrelevant background" }]), qaScore(90)]);
    const outcome = await runAcceptanceLoop(
      bilfingerFacts,
      { ...basePlan, archetype: "VISUAL_HERO" },
      realDeps({
        visualQa: qa,
        regenerateImage: async () => {
          imageRegenCalls += 1;
          return null; // image-generation API failure — loop must continue gracefully
        },
      }),
    );
    expect(imageRegenCalls).toBe(1);
    expect(outcome.status).toBe("PASS"); // regen failure did not sink the loop
  });

  it("never regenerates imagery for a non-imagery archetype even when Visual QA asks for it", async () => {
    let imageRegenCalls = 0;
    const qa = fakeQa([qaScore(70, [{ type: "REGENERATE_IMAGE", note: "n/a" }]), qaScore(90)]);
    await runAcceptanceLoop(
      bilfingerFacts,
      { ...basePlan, archetype: "DTP_NEWSPAPER" },
      realDeps({
        visualQa: qa,
        regenerateImage: async () => {
          imageRegenCalls += 1;
          return null;
        },
      }),
    );
    expect(imageRegenCalls).toBe(0);
  });
});

describe("recommendArchetype — content-aware suitability (Creative Brain)", () => {
  const bilfingerShape = {
    positionCount: 5,
    totalHeadcount: 5,
    benefitCount: 1,
    interviewEventCount: 2,
    hasSalarySignal: true,
    isUrgent: false,
    aspectRatio: 1080 / 1350,
  };

  it("recommends Structured Professional for the real Bilfinger shape (5 positions), never High-Density", () => {
    const rec = recommendArchetype(bilfingerShape);
    expect(rec.recommendedArchetype).toBe("STRUCTURED_PROFESSIONAL");
    expect(rec.suitabilityScores.HIGH_DENSITY).toBeLessThan(60);
    expect(rec.reasons.join(" ")).toContain("does not justify a vacancy table");
  });

  it("recommends High-Density for a genuine mass-hiring shape (25 positions, 120 headcount)", () => {
    const rec = recommendArchetype({
      ...bilfingerShape,
      positionCount: 25,
      totalHeadcount: 120,
      hasSalarySignal: false,
    });
    expect(rec.recommendedArchetype).toBe("HIGH_DENSITY");
  });

  it("favors Visual Hero for a single focal role on a social portrait format", () => {
    const rec = recommendArchetype({
      ...bilfingerShape,
      positionCount: 1,
      totalHeadcount: 1,
      benefitCount: 0,
      interviewEventCount: 0,
      hasSalarySignal: false,
    });
    expect(rec.recommendedArchetype).toBe("VISUAL_HERO");
  });

  it("returns suitability scores for all four archetypes with reasons", () => {
    const rec = recommendArchetype(bilfingerShape);
    expect(Object.keys(rec.suitabilityScores).sort()).toEqual([
      "DTP_NEWSPAPER",
      "HIGH_DENSITY",
      "STRUCTURED_PROFESSIONAL",
      "VISUAL_HERO",
    ]);
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("manual override remains possible: an explicit style maps through selectArchetype regardless of the recommendation", () => {
    // The recommendation says Structured for 5 positions...
    expect(recommendArchetype(bilfingerShape).recommendedArchetype).toBe("STRUCTURED_PROFESSIONAL");
    // ...but a recruiter explicitly choosing NEWSPAPER still gets DTP.
    expect(selectArchetype({ style: "NEWSPAPER", density: "MEDIUM" })).toBe("DTP_NEWSPAPER");
  });
});
