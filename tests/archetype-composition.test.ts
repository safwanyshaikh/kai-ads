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
} from "@/server/generation/archetypes";
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
      expect(svg).toContain("Basic salary + daily up to 4 hours OT");
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
      expect(svg).not.toContain("<hire>");
      expect(svg).toContain("&lt;hire&gt;");
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
    expect(hero).toContain("WE ARE HIRING"); // eyebrow over full-bleed background
    expect(structured).toContain("OPEN POSITIONS"); // card architecture
    expect(dense).toContain(">POSITION<"); // table header row
    expect(dtp).toContain("REQUIRED FOR SAUDI ARABIA"); // print treatment
    expect(structured).not.toContain("WE ARE HIRING");
    expect(dtp).not.toContain("OPEN POSITIONS");
  });

  it("only the DTP archetype prints the FULL official registration number in small print (reference grammar)", () => {
    expect(render("DTP_NEWSPAPER")).toContain("RC-B1487/MUM/PART/1000+/9986/2022");
  });

  it("the multi-city interview events are never concatenated into one ambiguous string", () => {
    for (const archetype of ALL_ARCHETYPES) {
      const svg = render(archetype);
      expect(svg).not.toContain("Baroda — 14th &amp; 15th July  ·  Mumbai");
      expect(svg).not.toContain("Baroda, Mumbai");
    }
  });
});

describe("buildImageBrief — Creative Brain image strategy (presentation only, no fabricated identity)", () => {
  it("describes the industry/country environment and the trades", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("Oil & Gas");
    expect(brief).toContain("Saudi Arabia");
    expect(brief).toContain("Welders — TIG & Multi");
  });
  it("explicitly prohibits text, logos, brands and signage inside the image", () => {
    const brief = buildImageBrief(bilfingerFacts);
    expect(brief).toContain("no logos");
    expect(brief).toContain("no visible brand names");
    expect(brief).toContain("no readable text");
    // The employer's name must never be sent as something to DEPICT.
    expect(brief).not.toContain("Bilfinger");
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
