import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import sharp from "sharp";
import { PNG } from "pngjs";
import {
  archetypeUsesGeneratedImagery,
  buildImageBrief,
  composeAdvertisement,
  selectArchetype,
  type AdvertisementArchetype,
  type AdvertisementFacts,
  type CompositionTuning,
} from "@/server/generation/archetypes";
import { highDensityFacts } from "./fixtures/high-density-fixture";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { getPlatformFormat } from "@/lib/platform-formats";

const ALL_ARCHETYPES: AdvertisementArchetype[] = [
  "VISUAL_HERO",
  "STRUCTURED_PROFESSIONAL",
  "HIGH_DENSITY",
  "DTP_NEWSPAPER",
];

// The real Bilfinger acceptance source — exactly the grounded facts, no
// fabricated vacancy numbers, salary amounts, food, accommodation,
// transport, visa type, duty hours, or contract duration.
const bilfingerFacts: AdvertisementFacts = {
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
};

function render(archetype: AdvertisementArchetype, overrides: Partial<AdvertisementFacts> = {}): string {
  return composeAdvertisement({
    facts: { ...bilfingerFacts, ...overrides },
    plan: {
      archetype,
      platformFormat: getPlatformFormat("instagram_post"),
      accentColor: "#0d4f8b",
      qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
      backgroundImageDataUri: null,
      agencyLogoDataUri: null,
    },
  });
}

describe("selectArchetype — Creative Brain style/density mapping (no schema migration)", () => {
  it("VISUAL maps to the Visual Hero engine", () => {
    expect(selectArchetype({ style: "VISUAL", density: "LOW" })).toBe("VISUAL_HERO");
  });
  it("NEWSPAPER maps to the DTP/Newspaper engine", () => {
    expect(selectArchetype({ style: "NEWSPAPER", density: "HIGH" })).toBe("DTP_NEWSPAPER");
  });
  it("TYPOGRAPHY splits by density: MEDIUM -> Structured Professional, HIGH -> High-Density", () => {
    expect(selectArchetype({ style: "TYPOGRAPHY", density: "MEDIUM" })).toBe("STRUCTURED_PROFESSIONAL");
    expect(selectArchetype({ style: "TYPOGRAPHY", density: "HIGH" })).toBe("HIGH_DENSITY");
  });
  it("only the Visual Hero archetype spends image-generation budget", () => {
    expect(ALL_ARCHETYPES.filter(archetypeUsesGeneratedImagery)).toEqual(["VISUAL_HERO"]);
  });
});

describe("composeAdvertisement — Truth Brain fidelity (real Bilfinger source)", () => {
  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype}: preserves every grounded fact — positions, benefit, both interview events, contact`, () => {
      const svg = render(archetype);
      expect(svg.trim().startsWith("<svg")).toBe(true);
      expect(svg.trim().endsWith("</svg>")).toBe(true);
      for (const p of bilfingerFacts.positions) {
        expect(svg).toContain(p.title.replace(/&/g, "&amp;"));
      }
      // Presentation may legitimately uppercase for poster typography —
      // fidelity is about content, so the check is case-insensitive
      // (the runtime Gate A source-fidelity check is case-insensitive too).
      expect(svg.toLowerCase()).toContain("basic salary + daily up to 4 hours ot");
      expect(svg).toContain("Baroda — 14th &amp; 15th July");
      expect(svg).toContain("Mumbai — 18th July");
      expect(svg).toContain("9324995767");
      expect(svg).toContain("jobs@alyousufent.com");
      expect(svg).toContain("AL Yousuf Enterprises LLP");
    });

    it(`${archetype}: never fabricates unsupported claims (food/accommodation/transport/visa/urgency) or placeholders`, () => {
      // The embedded-font <style> block is base64 data that can
      // coincidentally contain any letter sequence — this check is about
      // recruiter-facing content, so strip it first.
      const svg = render(archetype).replace(/<style>[\s\S]*?<\/style>/g, "").toLowerCase();
      expect(svg).not.toContain("urgent");
      expect(svg).not.toContain("free food");
      expect(svg).not.toContain("accommodation");
      expect(svg).not.toContain("transport");
      expect(svg).not.toContain("visa");
      expect(svg).not.toContain("not available");
    });

    it(`${archetype}: embeds the KAI verification QR with its scan caption (integrated, never omitted)`, () => {
      const svg = render(archetype);
      expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
      expect(svg).toContain("SCAN TO VERIFY");
      expect(svg).toContain("MEA REGISTERED AGENCY");
      expect(svg).toContain("RA 9986");
    });

    it(`${archetype}: escapes XML special characters in recruiter-supplied text`, () => {
      const svg = render(archetype, { header: 'Urgent <hire> & "apply"' });
      const lower = svg.toLowerCase();
      expect(lower).not.toContain("<hire>");
      expect(lower).toContain("&lt;hire&gt;");
    });

    it(`${archetype}: optional blocks disappear cleanly when the source has no data for them`, () => {
      const svg = render(archetype, { benefits: [], interview: [], footer: null, employer: null });
      expect(svg).not.toContain("BENEFITS");
      expect(svg).not.toContain("INTERVIEW");
    });
  }

  it("the four archetypes are genuinely distinct compositions, not one template recolored", () => {
    const outputs = ALL_ARCHETYPES.map((a) => render(a));
    // Pairwise distinct...
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        expect(outputs[i]).not.toBe(outputs[j]);
      }
    }
    // ...via structural markers unique to each engine, not just colors.
    const [hero, structured, dense, dtp] = outputs;
    expect(hero).toContain("heroTopWash"); // photo-led wash zones are unique to the hero
    expect(structured).toContain("OPEN POSITIONS"); // card architecture
    expect(dense).toContain(">POSITION<"); // table header row
    expect(dtp).toContain("REQUIRED FOR SAUDI ARABIA"); // print treatment
    expect(structured).not.toContain("heroTopWash");
    expect(dtp).not.toContain("OPEN POSITIONS");
  });

  it("only the DTP archetype prints the FULL official registration number in small print (reference grammar)", () => {
    expect(render("DTP_NEWSPAPER")).toContain("RC-B1487/MUM/PART/1000+/9986/2022");
  });

  it("the multi-city interview events are never concatenated into one ambiguous string", () => {
    for (const archetype of ALL_ARCHETYPES) {
      const svg = render(archetype);
      // City–date pairing must be preserved: "Baroda, Mumbai" (cities with
      // no dates attached) is the ambiguous failure. A ribbon line listing
      // each city WITH its own date ("Baroda — 14th & 15th July · Mumbai —
      // 18th July") keeps the pairing and is the benchmark grammar.
      expect(svg).not.toContain("Baroda, Mumbai");
      if (svg.includes("Baroda — 14th &amp; 15th July  ·  Mumbai")) {
        expect(svg).toContain("Mumbai — 18th July");
      }
    }
  });
});

describe("buildImageBrief — GPT as text-free creative canvas designer (hybrid architecture)", () => {
  it("asks GPT to generate a premium visual canvas, not render factual text", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("ART DIRECTION");
    expect(brief).toContain("NO readable text");
    expect(brief).toContain("NO letters");
    expect(brief).toContain("NO numbers");
    expect(brief).toContain("text-safe zones");
  });
  it("provides thematic context but does NOT pass factual strings for rendering", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("Oil & Gas");
    expect(brief).toContain("Saudi Arabia");
    expect(brief).toContain("Bilfinger");
    // Factual details must NOT appear — GPT must not attempt to render them
    expect(brief).not.toContain("9324995767");
    expect(brief).not.toContain("jobs@alyousufent.com");
    expect(brief).not.toContain("Welders");
    expect(brief).not.toContain("RA 9986");
  });
  it("is dynamically constructed from the constitution's decisions and the Agency Visual DNA", () => {
    const withDna = buildImageBrief(bilfingerFacts, {
      dna: { primaryColor: "#7c9f53", secondaryColor: "#5d9bb9", accentColor: "#c0392b", hasLogo: true },
      aspectRatio: 1,
    });
    expect(withDna).toContain("#7c9f53");
    expect(withDna).toContain("square");
    const sparse = buildImageBrief({ ...bilfingerFacts, positions: [bilfingerFacts.positions[0]], benefits: [], interview: [], footer: null, employer: null });
    expect(sparse.toLowerCase()).toContain("sparse");
    expect(buildImageBrief(bilfingerFacts).toLowerCase()).not.toContain("sparse");
  });
  it("prohibits rendering text, logos, QR codes, and pseudo-text", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("Do NOT render any text");
    expect(brief).toContain("Do NOT render any logos");
    expect(brief).toContain("purely visual");
  });
  it("instructs composition zones for deterministic overlay", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("UPPER ZONE");
    expect(brief).toContain("MIDDLE ZONE");
    expect(brief).toContain("LOWER ZONE");
  });
});

describe("HIGH_DENSITY with genuinely dense fixture (18 positions, 201 headcount)", () => {
  function renderHd(tuning: CompositionTuning = {}): string {
    return composeAdvertisement({
      facts: highDensityFacts,
      plan: {
        archetype: "HIGH_DENSITY",
        platformFormat: getPlatformFormat("instagram_post"),
        accentColor: "#0d4f8b",
        qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
        backgroundImageDataUri: null,
        agencyLogoDataUri: null,
        tuning,
      },
    });
  }

  it("renders all 18 positions in the vacancy table", () => {
    const svg = renderHd();
    expect(svg).toContain("Pipe Fitter");
    expect(svg).toContain("Store Keeper");
    expect(svg).toContain("NDT Technician");
    expect(svg).toContain("Crane Operator");
    expect(svg.match(/<text /g)!.length).toBeGreaterThan(20);
  });

  it("shows vacancy counts for positions that have them", () => {
    const svg = renderHd();
    expect(svg).toContain(">25<");
    expect(svg).toContain(">20<");
    expect(svg).toContain(">15<");
  });

  it("preserves all three interview events with city-date pairing", () => {
    const svg = renderHd();
    expect(svg).toContain("Mumbai");
    expect(svg).toContain("Delhi");
    expect(svg).toContain("Chennai");
    expect(svg).toContain("21st");
    expect(svg).toContain("24th July");
  });

  it("responds to ctaScale tuning by increasing contact CTA size", () => {
    const base = renderHd();
    const tuned = renderHd({ ctaScale: 1.2 });
    expect(base).not.toBe(tuned);
  });

  it("responds to sectionGapScale tuning (on sparse-enough content)", () => {
    // With 18 positions the table absorbs nearly all vertical space, so
    // the section gap clamps at the floor — test on Bilfinger's 5-position
    // shape where HD has real leftover space to redistribute.
    const base = render("HIGH_DENSITY");
    const tuned = composeAdvertisement({
      facts: bilfingerFacts,
      plan: {
        archetype: "HIGH_DENSITY",
        platformFormat: getPlatformFormat("instagram_post"),
        accentColor: "#0d4f8b",
        qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
        backgroundImageDataUri: null,
        agencyLogoDataUri: null,
        tuning: { sectionGapScale: 1.2 },
      },
    });
    expect(base).not.toBe(tuned);
  });

  it("responds to qrPanelScale tuning", () => {
    const base = renderHd();
    const tuned = renderHd({ qrPanelScale: 1.1 });
    expect(base).not.toBe(tuned);
  });
});

describe("Actuator tuning changes composition output across archetypes", () => {
  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype}: ctaScale=1.15 produces a different composition than the default`, () => {
      const base = render(archetype);
      const tuned = composeAdvertisement({
        facts: bilfingerFacts,
        plan: {
          archetype,
          platformFormat: getPlatformFormat("instagram_post"),
          accentColor: "#0d4f8b",
          qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
          backgroundImageDataUri: null,
          agencyLogoDataUri: null,
          tuning: { ctaScale: 1.15 },
        },
      });
      expect(base).not.toBe(tuned);
    });

    it(`${archetype}: qrPanelScale=1.1 produces a different composition than the default`, () => {
      const base = render(archetype);
      const tuned = composeAdvertisement({
        facts: bilfingerFacts,
        plan: {
          archetype,
          platformFormat: getPlatformFormat("instagram_post"),
          accentColor: "#0d4f8b",
          qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
          backgroundImageDataUri: null,
          agencyLogoDataUri: null,
          tuning: { qrPanelScale: 1.1 },
        },
      });
      expect(base).not.toBe(tuned);
    });
  }

  it("VISUAL_HERO: scrimOpacity=1.2 changes the wash gradient opacity", () => {
    const base = render("VISUAL_HERO");
    const tuned = composeAdvertisement({
      facts: bilfingerFacts,
      plan: {
        archetype: "VISUAL_HERO",
        platformFormat: getPlatformFormat("instagram_post"),
        accentColor: "#0d4f8b",
        qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
        backgroundImageDataUri: null,
        agencyLogoDataUri: null,
        tuning: { scrimOpacity: 1.2 },
      },
    });
    expect(base).not.toBe(tuned);
    expect(tuned).toContain("heroTopWash");
  });
});

describe("KAI verification QR decodes from every archetype's final rasterized advertisement", () => {
  const platformFormat = getPlatformFormat("instagram_post");
  const url = buildQrTrackingUrl({ agencyVerificationId: "av_archetype_test", advertisementId: "ad_archetype_test" });

  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype}: full pipeline (compose -> rasterize -> decode) round-trips the KAI verification URL`, async () => {
      const qr = await generateAndVerifyQr(url);
      expect(qr.decodable).toBe(true);
      const svg = composeAdvertisement({
        facts: bilfingerFacts,
        plan: {
          archetype,
          platformFormat,
          accentColor: "#0d4f8b",
          qrDataUri: `data:image/png;base64,${qr.png.toString("base64")}`,
          backgroundImageDataUri: null,
          agencyLogoDataUri: null,
        },
      });
      const finalPng = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);
      const decodedPng = PNG.sync.read(finalPng);
      const fullScan = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
      // jsQR's finder can be confused at full-canvas scale by strong
      // rectangular graphics elsewhere in the composition (the DTP double
      // border). A phone scanner localizes on the code, so the fallback
      // scans the QR's own region — the bottom-right quadrant every
      // archetype places its verification panel in. The decode itself is
      // still from the real final raster, never from the source QR PNG.
      let decoded = fullScan?.data ?? null;
      if (!decoded) {
        const cropW = Math.round(platformFormat.widthPx * 0.45);
        const cropH = Math.round(platformFormat.heightPx * 0.3);
        const crop = await sharp(finalPng)
          .extract({
            left: platformFormat.widthPx - cropW,
            top: platformFormat.heightPx - cropH,
            width: cropW,
            height: cropH,
          })
          .png()
          .toBuffer();
        const croppedPng = PNG.sync.read(crop);
        decoded = jsQR(new Uint8ClampedArray(croppedPng.data), croppedPng.width, croppedPng.height)?.data ?? null;
      }
      expect(decoded).toBe(url);
    });
  }
});

describe("AI-first Visual Hero — GPT as creative designer, KAI as precision overlay", () => {
  const TINY_PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  function renderAiFirst(overrides: Partial<AdvertisementFacts> = {}): string {
    return composeAdvertisement({
      facts: { ...bilfingerFacts, ...overrides },
      plan: {
        archetype: "VISUAL_HERO",
        platformFormat: getPlatformFormat("instagram_post"),
        accentColor: "#0d4f8b",
        qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
        backgroundImageDataUri: TINY_PNG_DATA_URI,
        agencyLogoDataUri: null,
      },
    });
  }

  it("AI-first hybrid mode uses GPT image as full canvas with deterministic factual overlay", () => {
    const svg = renderAiFirst();
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    // Hybrid architecture: ALL factual content rendered deterministically on top
    for (const p of bilfingerFacts.positions) {
      expect(svg).toContain(p.title.replace(/&/g, "&amp;"));
    }
    expect(svg).toContain("9324995767");
    expect(svg).toContain("jobs@alyousufent.com");
  });

  it("AI-first mode DOES include precision overlay: agency name, RA, scan-to-verify, QR", () => {
    const svg = renderAiFirst();
    expect(svg.toLowerCase()).toContain(bilfingerFacts.agencyName.toLowerCase());
    expect(svg).toContain("SCAN TO VERIFY");
    expect(svg).toContain("RA 9986");
    expect(svg).toContain("MEA REGISTERED AGENCY");
    expect(svg).toContain(bilfingerFacts.fullRegistrationNumber!);
  });

  it("AI-first hybrid overlay renders all factual content as SVG text elements", () => {
    const aiFirstSvg = renderAiFirst();
    const countTexts = (s: string) => (s.match(/<text /g) ?? []).length;
    expect(countTexts(aiFirstSvg)).toBeGreaterThan(10);
  });

  it("fallback mode (no AI image) produces full deterministic composition with all content", () => {
    const svg = render("VISUAL_HERO");
    expect(svg).not.toContain('preserveAspectRatio="xMidYMid slice"');
    // Full template with all sections
    for (const p of bilfingerFacts.positions) {
      expect(svg).toContain(p.title.replace(/&/g, "&amp;"));
    }
    expect(svg).toContain("9324995767");
    expect(svg).toContain("jobs@alyousufent.com");
  });
});

describe("GPT creative brief — requests text-free creative canvas (hybrid architecture)", () => {
  it("the brief provides thematic context but excludes factual recruitment strings", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("Saudi Arabia");
    expect(brief).toContain("Oil & Gas");
    expect(brief).toContain("Bilfinger");
    // Factual strings must NOT appear — GPT renders no text
    expect(brief).not.toContain("9324995767");
    expect(brief).not.toContain("jobs@alyousufent.com");
    expect(brief).not.toContain("RA 9986");
    expect(brief).not.toContain(bilfingerFacts.agencyName);
    for (const p of bilfingerFacts.positions) {
      expect(brief).not.toContain(p.title);
    }
  });

  it("the brief instructs text-safe composition zones for deterministic overlay", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("text-safe");
    expect(brief).toContain("UPPER ZONE");
    expect(brief).toContain("MIDDLE ZONE");
    expect(brief).toContain("LOWER ZONE");
  });

  it("the brief explicitly prohibits all readable text and pseudo-text", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("NO readable text");
    expect(brief).toContain("NO letters");
    expect(brief).toContain("NO logos");
    expect(brief).toContain("NO QR codes");
    expect(brief).toContain("pseudo-text");
  });

  it("the brief dynamically adapts density guidance", () => {
    const sparseBrief = buildImageBrief({
      ...bilfingerFacts,
      positions: [{ title: "Welders" }],
      benefits: [],
      interview: [],
      footer: null,
    });
    expect(sparseBrief).toContain("SPARSE");
  });
});

// Sprint 007 Bug: a graduated pay scale collapsed onto ONE grounded
// position.salary string (see extraction-to-form.test.ts for the
// upstream formatting) must actually reach the rendered advertisement —
// every archetype that shows positions must render it, truthfully and
// without inventing a number of its own.
describe("composeAdvertisement — renders a position's grounded salary text (Sprint 007 Bug)", () => {
  const withTieredSalary = {
    positions: [
      {
        title: "RCM Instrument Engineer",
        count: 2,
        salary: "8 yrs to < 9 yrs: SAR 10,000 · 9 yrs to < 10 yrs: SAR 11,000",
      },
    ],
  };

  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype}: shows the position's grounded salary text exactly once, not duplicated per band`, () => {
      const svg = render(archetype, withTieredSalary);
      const occurrences = svg.split("RCM Instrument Engineer").length - 1;
      expect(occurrences).toBe(1);
      expect(svg).toContain("SAR 10,000");
      expect(svg).toContain("SAR 11,000");
    });
  }
});
