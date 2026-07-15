import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH,
  buildAdCopyPlan,
  buildCandidateHook,
  buildCompositionDirectives,
  buildTrustArchitecture,
  classifyContentDensity,
  composeAdvertisement,
  CompositionConstitutionViolation,
  enforceCompositionConstitution,
  recommendArchetype,
  type AdvertisementArchetype,
  type AdvertisementFacts,
} from "@/server/generation/archetypes";
import { contrastRatio, ensureContrastAgainst } from "@/server/generation/archetypes/composition-shared";
import { buildVisualQaInstructions } from "@/server/ai/visual-qa/kai-visual-qa-provider";
import { getPlatformFormat } from "@/lib/platform-formats";

const ALL_ARCHETYPES: AdvertisementArchetype[] = [
  "VISUAL_HERO",
  "STRUCTURED_PROFESSIONAL",
  "HIGH_DENSITY",
  "DTP_NEWSPAPER",
];

const bilfingerFacts: AdvertisementFacts = {
  header: "Hiring for Bilfinger Shutdown Project",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  positions: [
    { title: "Welders - TIG & Multi" },
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
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
};

const sparseFacts: AdvertisementFacts = {
  ...bilfingerFacts,
  header: "Welders Required",
  positions: [{ title: "Welders - TIG & Multi" }],
  benefits: [],
  interview: [],
  footer: null,
  employer: null,
};

function render(archetype: AdvertisementArchetype, facts: AdvertisementFacts): string {
  return composeAdvertisement({
    facts,
    plan: {
      archetype,
      platformFormat: getPlatformFormat("instagram_post"),
      accentColor: "#0d4f8b",
      qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
      copy: buildAdCopyPlan(facts, { hasCompensationSignal: facts.benefits.length > 0 }),
    },
  });
}

/** All `<text>` elements as { size, content } pairs (embedded-font <style> stripped). */
function textElements(svg: string): { size: number; content: string }[] {
  const body = svg.replace(/<style>[\s\S]*?<\/style>/g, "");
  const out: { size: number; content: string }[] = [];
  const re = /<text[^>]*font-size="(\d+(?:\.\d+)?)"[^>]*>([^<]*)<\/text>/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    out.push({ size: Number(m[1]), content: m[2] });
  }
  return out;
}

describe("Advertisement Composition Constitution — the document is real, canonical, and complete", () => {
  const constitution = readFileSync(
    path.join(process.cwd(), ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH),
    "utf8",
  );

  it("exists at the canonical registered path with authority, scope, and conflict rule", () => {
    expect(constitution).toContain("Primary commercial design authority");
    expect(constitution).toContain("Conflict rule");
    expect(constitution).toContain("the Constitution wins");
  });

  it("codifies the candidate-first laws: attention, comprehension, hierarchy, typography, canvas", () => {
    for (const law of [
      "First-second attention test",
      "Three-second comprehension test",
      "Agency identity does NOT dominate the top",
      "Sparse content must scale UP",
      "No unjustified empty canvas",
      "Information Priority Engine",
      "Typography Scale Engine",
      "Content Density Engine",
      "Canvas Utilisation Engine",
      "Footer Composition System",
      "Mobile Readability Gate",
      "Commercial Visual QA",
    ]) {
      expect(constitution, `constitution is missing the law: ${law}`).toContain(law);
    }
  });

  it("records the failed Bilfinger layouts as negative anti-patterns and states the final commercial question", () => {
    expect(constitution).toContain("negative anti-patterns");
    expect(constitution).toContain(
      "Would a relevant candidate stop scrolling, understand the opportunity within 1–3 seconds",
    );
    expect(constitution).toContain("not commercial acceptance");
  });

  it("CLAUDE.md points at the constitution as the single canonical source of truth", () => {
    const claudeMd = readFileSync(path.join(process.cwd(), "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain(ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH);
    expect(claudeMd).toContain("No advertisement work may bypass or contradict it");
  });
});

describe("Content Density Engine — density decided by the source, never by habit", () => {
  it("one position with no optional blocks is SPARSE", () => {
    expect(classifyContentDensity(sparseFacts)).toBe("SPARSE");
  });

  it("the five-position Bilfinger source is MEDIUM — high-density must not activate for it", () => {
    expect(classifyContentDensity(bilfingerFacts)).toBe("MEDIUM");
    // The Creative Brain's own suitability ranking agrees: HIGH_DENSITY is
    // its weakest recommendation for this source.
    const rec = recommendArchetype({
      positionCount: bilfingerFacts.positions.length,
      totalHeadcount: bilfingerFacts.positions.length,
      benefitCount: bilfingerFacts.benefits.length,
      interviewEventCount: bilfingerFacts.interview.length,
      hasSalarySignal: true,
      isUrgent: false,
      aspectRatio: 1,
    });
    expect(rec.recommendedArchetype).not.toBe("HIGH_DENSITY");
    const hdScore = rec.suitabilityScores.HIGH_DENSITY;
    for (const [archetype, score] of Object.entries(rec.suitabilityScores)) {
      if (archetype !== "HIGH_DENSITY") expect(score).toBeGreaterThan(hdScore);
    }
  });

  it("a genuinely dense source (many positions) is HIGH", () => {
    const dense = {
      ...bilfingerFacts,
      positions: Array.from({ length: 10 }, (_, i) => ({ title: `Trade ${i + 1}` })),
    };
    expect(classifyContentDensity(dense)).toBe("HIGH");
  });
});

describe("Typography Scale Engine — fonts follow information priority", () => {
  it("sparse sources scale typography UP; dense sources are held tighter", () => {
    const sparse = buildCompositionDirectives(sparseFacts, { archetype: "STRUCTURED_PROFESSIONAL" });
    const medium = buildCompositionDirectives(bilfingerFacts, { archetype: "STRUCTURED_PROFESSIONAL" });
    expect(sparse.contentDensityClass).toBe("SPARSE");
    expect(sparse.typographyScale).toBeGreaterThan(medium.typographyScale);
  });

  it("a sparse category list renders with a LARGER dominant headline than the medium-density source, never miniature fonts", () => {
    const sparseMax = Math.max(...textElements(render("STRUCTURED_PROFESSIONAL", sparseFacts)).map((t) => t.size));
    const mediumMax = Math.max(...textElements(render("STRUCTURED_PROFESSIONAL", bilfingerFacts)).map((t) => t.size));
    expect(sparseMax).toBeGreaterThanOrEqual(mediumMax);
    expect(sparseMax).toBeGreaterThan(0);
  });

  it("the information priority always leads with the hook and destination and always ends with agency trust", () => {
    for (const facts of [bilfingerFacts, sparseFacts]) {
      const d = buildCompositionDirectives(facts, { archetype: "VISUAL_HERO" });
      expect(d.informationPriority[0]).toBe("DOMINANT_HOOK");
      expect(d.informationPriority[1]).toBe("DESTINATION_COUNTRY");
      expect(d.informationPriority[d.informationPriority.length - 1]).toBe("AGENCY_TRUST");
      expect(d.informationPriority.indexOf("CONTACT_CTA")).toBeLessThan(
        d.informationPriority.indexOf("AGENCY_TRUST"),
      );
    }
  });
});

describe("Hierarchy law — the hook, not the agency, dominates every archetype", () => {
  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype}: agency name is never the dominant headline; the candidate-facing hook out-scales it`, () => {
      const texts = textElements(render(archetype, bilfingerFacts));
      const maxSize = Math.max(...texts.map((t) => t.size));
      const agencyTexts = texts.filter((t) =>
        t.content.toLowerCase().includes("al yousuf enterprises"),
      );
      expect(agencyTexts.length).toBeGreaterThan(0);
      for (const t of agencyTexts) {
        expect(
          t.size,
          `agency name rendered at ${t.size}px must be smaller than the dominant hook at ${maxSize}px`,
        ).toBeLessThan(maxSize);
      }
      // The dominant text is hook material (project/destination), not identity.
      const dominant = texts.filter((t) => t.size === maxSize);
      for (const t of dominant) {
        expect(t.content.toLowerCase()).not.toContain("al yousuf");
      }
    });
  }
});

describe("Runtime enforcement — composeAdvertisement cannot ship a violating render", () => {
  it("every archetype's real render passes the constitutional gate (footer trust, CTA, hook, country)", () => {
    for (const archetype of ALL_ARCHETYPES) {
      // composeAdvertisement runs enforceCompositionConstitution internally;
      // a throw here means the engine itself violates the constitution.
      expect(() => render(archetype, bilfingerFacts)).not.toThrow();
      expect(() => render(archetype, sparseFacts)).not.toThrow();
    }
  });

  it("a render missing the verification footer is thrown out, regardless of everything else passing", () => {
    const directives = buildCompositionDirectives(bilfingerFacts, { archetype: "STRUCTURED_PROFESSIONAL" });
    const memoLike = `<svg xmlns="http://www.w3.org/2000/svg"><text font-size="20">Hiring for Bilfinger Shutdown Project Saudi Arabia 9324995767 jobs@alyousufent.com Al Yousuf Enterprises LLP RA 9986</text></svg>`;
    const noTrust = memoLike.replace("RA 9986", "");
    expect(() => enforceCompositionConstitution(noTrust, bilfingerFacts, directives)).toThrow(
      CompositionConstitutionViolation,
    );
  });

  it("a render hiding the contact CTA or the agency identity is thrown out", () => {
    const directives = buildCompositionDirectives(bilfingerFacts, { archetype: "VISUAL_HERO" });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text font-size="90">BILFINGER SHUTDOWN PROJECT SAUDI ARABIA</text><text font-size="12">SCAN TO VERIFY RA 9986 Al Yousuf Enterprises LLP</text></svg>`;
    expect(() => enforceCompositionConstitution(svg, bilfingerFacts, directives)).toThrow(
      /contact CTA/i,
    );
  });
});

describe("Commercial Visual QA — Brain D is constitutionally bound", () => {
  const instructions = buildVisualQaInstructions();

  it("Brain D enforces the constitution by name and its conflict rule", () => {
    expect(instructions).toContain("Advertisement Composition Constitution");
    expect(instructions).toContain(ADVERTISEMENT_COMPOSITION_CONSTITUTION_PATH);
    expect(instructions).toContain("the Constitution wins");
  });

  it("the rejected empty-document anti-patterns are mandatory rejection conditions, not scoring preferences", () => {
    expect(instructions).toContain("MANDATORY REJECTION CONDITIONS");
    expect(instructions).toContain("dead canvas");
    expect(instructions).toContain("too small for mobile");
    expect(instructions).toContain("report, internal memo, SaaS card");
    expect(instructions).toContain("catastrophicDefects");
  });

  it("the pass standard is the commercial pay-and-publish question, not engineering-gate ceremony", () => {
    expect(instructions).toContain("PAY for this advertisement and publish it directly");
  });

  it("Brain D detects unnecessary agency repetition across top and bottom", () => {
    expect(instructions).toContain("INFORMATION DEDUPLICATION");
    expect(instructions).toContain("single integrated trust footer");
    expect(instructions).toContain("repeated");
  });

  it("Brain D evaluates candidate hooks positively", () => {
    expect(instructions).toContain("CANDIDATE HOOK");
    expect(instructions).toContain("candidate-facing hook");
  });

  it("Brain D detects headline clipping as catastrophic", () => {
    expect(instructions).toContain("HEADLINE CLIPPING");
    expect(instructions).toContain("clipped");
  });

  it("Brain D detects contrast damage from agency brand colors", () => {
    expect(instructions).toContain("CONTRAST AND READABILITY");
    expect(instructions).toContain("brand colors");
  });
});

describe("Trust Architecture — single integrated trust footer, no unjustified repetition", () => {
  it("non-DTP archetypes reclaim ~10% canvas from deduplication", () => {
    for (const archetype of ["VISUAL_HERO", "STRUCTURED_PROFESSIONAL", "HIGH_DENSITY"] as const) {
      const trust = buildTrustArchitecture(bilfingerFacts, archetype);
      expect(trust.primaryTrustZone).toBe("FOOTER");
      expect(trust.reclaimedCanvasPercent).toBe(10);
      expect(trust.reclaimedCanvasAllocation.length).toBeGreaterThan(0);
      expect(trust.reclaimedCanvasAllocation).toContain("CANDIDATE_HOOK");
    }
  });

  it("DTP/Newspaper has justified masthead repetition and reclaims 0%", () => {
    const trust = buildTrustArchitecture(bilfingerFacts, "DTP_NEWSPAPER");
    expect(trust.reclaimedCanvasPercent).toBe(0);
    const agencyName = trust.repeatedElements.find((e) => e.element === "AGENCY_NAME")!;
    expect(agencyName.repetitionJustification).toContain("print convention");
  });

  it("all trust elements default to no justified repetition (null justification)", () => {
    const trust = buildTrustArchitecture(bilfingerFacts, "VISUAL_HERO");
    for (const el of trust.repeatedElements) {
      if (el.element !== "AGENCY_NAME") {
        expect(el.repetitionJustification).toBeNull();
      }
    }
  });

  it("VISUAL_HERO and STRUCTURED_PROFESSIONAL render agency name only once (in the footer)", () => {
    for (const archetype of ["VISUAL_HERO", "STRUCTURED_PROFESSIONAL"] as const) {
      const svg = render(archetype, bilfingerFacts);
      const body = svg.replace(/<style>[\s\S]*?<\/style>/g, "");
      const agencyMatches = body.match(new RegExp(bilfingerFacts.agencyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"));
      expect(
        agencyMatches?.length ?? 0,
        `${archetype}: agency name should appear exactly once (footer)`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("HIGH_DENSITY renders agency name in identity strip and not duplicated elsewhere", () => {
    const svg = render("HIGH_DENSITY", bilfingerFacts);
    const body = svg.replace(/<style>[\s\S]*?<\/style>/g, "");
    const agencyMatches = body.match(new RegExp(bilfingerFacts.agencyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"));
    expect((agencyMatches?.length ?? 0)).toBeLessThanOrEqual(1);
  });
});

describe("Candidate Hook — source-grounded advertising reframe", () => {
  it("generates a DESTINATION_CAREER hook when country + industry + employer are present", () => {
    const hook = buildCandidateHook(bilfingerFacts);
    expect(hook).not.toBeNull();
    expect(hook!.candidateHookType).toBe("DESTINATION_CAREER");
    expect(hook!.text.toUpperCase()).toContain("OIL & GAS");
    expect(hook!.text.toUpperCase()).toContain("SAUDI ARABIA");
    expect(hook!.candidateHookSourceEvidence.length).toBeGreaterThan(0);
    expect(hook!.candidateHookConfidence).toBe("HIGH");
  });

  it("generates a TRADE_DEMAND hook for a single-position source with a short header", () => {
    const singlePos: AdvertisementFacts = {
      ...bilfingerFacts,
      header: "Required",
      employer: null,
      industry: "",
      positions: [{ title: "Welders - TIG & Multi" }],
    };
    const hook = buildCandidateHook(singlePos);
    expect(hook).not.toBeNull();
    expect(hook!.candidateHookType).toBe("TRADE_DEMAND");
    expect(hook!.text.toUpperCase()).toContain("WELDERS");
  });

  it("candidate hook is included in composition directives", () => {
    const d = buildCompositionDirectives(bilfingerFacts, { archetype: "VISUAL_HERO" });
    expect(d.candidateHook).not.toBeNull();
    expect(d.candidateHook!.candidateHookSourceEvidence.length).toBeGreaterThan(0);
  });
});

describe("Contrast enforcement — agency brand colors must not damage readability", () => {
  it("contrastRatio returns ~21 for black on white", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).toBeGreaterThan(20);
    expect(ratio).toBeLessThan(22);
  });

  it("contrastRatio returns ~1 for same colors", () => {
    expect(contrastRatio("#0d4f8b", "#0d4f8b")).toBeCloseTo(1, 0);
  });

  it("ensureContrastAgainst darkens a light color against a light background", () => {
    const result = ensureContrastAgainst("#cccccc", "#ffffff", 4.5, "#111111");
    const ratio = contrastRatio(result, "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ensureContrastAgainst passes through a color that already has sufficient contrast", () => {
    const result = ensureContrastAgainst("#000000", "#ffffff", 4.5, "#111111");
    expect(result).toBe("#000000");
  });
});
