import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildAdCopyPlan,
  composeAdvertisement,
  resolveAgencyVisualDna,
  type AdvertisementArchetype,
  type AdvertisementFacts,
  type AgencyVisualDna,
} from "@/server/generation/archetypes";
import { coreHeaderText } from "@/server/generation/archetypes/advertisement-intelligence";
import { isPlaceholderVerificationDomain, COMMERCIAL_LAUNCH_THRESHOLD } from "@/server/generation/acceptance/acceptance-loop";
import { runSourceFidelityGate } from "@/server/generation/acceptance/gates";
import { getPlatformFormat } from "@/lib/platform-formats";

const bilfingerFacts: AdvertisementFacts = Object.freeze({
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
  benefits: [{ label: "Basic salary" }, { label: "Daily overtime up to 4 hours" }],
  interview: [
    { date: "14th July", location: "Baroda" },
    { date: "15th July", location: "Baroda" },
    { date: "18th July", location: "Mumbai" },
  ],
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  footer: "All applicants must have experience in shutdown projects",
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
});

const ALL_ARCHETYPES: AdvertisementArchetype[] = [
  "VISUAL_HERO",
  "STRUCTURED_PROFESSIONAL",
  "HIGH_DENSITY",
  "DTP_NEWSPAPER",
];

function render(archetype: AdvertisementArchetype, dna?: AgencyVisualDna | null): string {
  return composeAdvertisement({
    facts: bilfingerFacts,
    plan: {
      archetype,
      platformFormat: getPlatformFormat("instagram_post"),
      accentColor: "#0d4f8b",
      qrDataUri: "data:image/png;base64,iVBORw0KGgo=",
      dna,
      copy: buildAdCopyPlan(bilfingerFacts, { hasCompensationSignal: true }),
    },
  });
}

/** Every word an Advertisement Intelligence output may contain must come from the facts or this fixed glue list. */
const GLUE_WORDS = new Set(["client", "interviews", "in", "&", ","]);

function assertGrounded(text: string, facts: AdvertisementFacts) {
  const factCorpus = [
    facts.header,
    facts.industry,
    facts.country,
    facts.employer ?? "",
    ...facts.positions.map((p) => p.title),
    ...facts.benefits.map((b) => b.label),
    ...facts.interview.flatMap((e) => [e.date ?? "", e.location ?? ""]),
    facts.footer ?? "",
    facts.agencyName,
  ]
    .join(" ")
    .toLowerCase();
  for (const word of text.toLowerCase().split(/[\s—–]+/).filter(Boolean)) {
    const clean = word.replace(/[.,!?]/g, "");
    if (!clean) continue;
    expect(
      factCorpus.includes(clean) || GLUE_WORDS.has(clean),
      `word "${clean}" in "${text}" is neither grounded in the facts nor allowed glue`,
    ).toBe(true);
  }
}

describe("Agency Visual DNA — tenant-level continuity, no migration", () => {
  const logoPath = path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png");

  it("derives a deterministic palette from the Al Yousuf logo", async () => {
    const logo = readFileSync(logoPath);
    const dna1 = await resolveAgencyVisualDna({ logo });
    const dna2 = await resolveAgencyVisualDna({ logo });
    expect(dna1).toEqual(dna2);
    expect(dna1.hasLogo).toBe(true);
    expect(dna1.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(dna1.primaryColor).not.toBe("#0d4f8b"); // actually derived, not the fallback
  });

  it("different agencies (different logos) produce different DNA", async () => {
    const logo = readFileSync(logoPath);
    // A synthetic second agency logo: solid warm-red square.
    const otherLogo = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 40, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const alYousuf = await resolveAgencyVisualDna({ logo });
    const other = await resolveAgencyVisualDna({ logo: otherLogo });
    expect(alYousuf.primaryColor).not.toBe(other.primaryColor);
  });

  it("explicit overrides win over derived colors (future brand-settings column)", async () => {
    const dna = await resolveAgencyVisualDna({
      logo: readFileSync(logoPath),
      overrides: { primaryColor: "#123456" },
    });
    expect(dna.primaryColor).toBe("#123456");
  });

  it("DNA influences color continuity without collapsing the archetypes into one template", async () => {
    const dna = await resolveAgencyVisualDna({ logo: readFileSync(logoPath) });
    const outputs = ALL_ARCHETYPES.map((a) => render(a, dna));
    // Still four genuinely different structures...
    expect(outputs[0]).toContain("WE ARE HIRING");
    expect(outputs[1]).toContain("OPEN POSITIONS");
    expect(outputs[2]).toContain(">POSITION");
    expect(outputs[3]).toContain("REQUIRED FOR SAUDI ARABIA");
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        expect(outputs[i]).not.toBe(outputs[j]);
      }
    }
    // ...and DNA colors actually changed the render vs no-DNA.
    for (const archetype of ALL_ARCHETYPES) {
      expect(render(archetype, dna)).not.toBe(render(archetype, null));
    }
  });
});

describe("Advertisement Intelligence — emphasis without fact invention", () => {
  const copy = buildAdCopyPlan(bilfingerFacts, { hasCompensationSignal: true });

  it("primary headline is the header's grounded core, boilerplate stripped", () => {
    expect(copy.primaryHeadline).toBe("Bilfinger Shutdown Project");
    assertGrounded(copy.primaryHeadline, bilfingerFacts);
  });

  it("secondary headline is the grounded multi-city interview hook", () => {
    expect(copy.secondaryHeadline).toBe("Client interviews in Baroda & Mumbai");
    assertGrounded(copy.secondaryHeadline!, bilfingerFacts);
  });

  it("selects the employer/project as the strongest grounded selling point", () => {
    expect(copy.strongestSellingPoint).toBe("EMPLOYER_PROJECT");
  });

  it("falls back down the grounded precedence when angles are absent from the source", () => {
    const noEmployer = { ...bilfingerFacts, employer: null };
    expect(buildAdCopyPlan(noEmployer, { hasCompensationSignal: true }).strongestSellingPoint).toBe("COMPENSATION");
    expect(buildAdCopyPlan(noEmployer, { hasCompensationSignal: false }).strongestSellingPoint).toBe(
      "MULTI_CITY_INTERVIEWS",
    );
    const bare = { ...noEmployer, interview: [], benefits: [], footer: null };
    expect(buildAdCopyPlan(bare, { hasCompensationSignal: false }).strongestSellingPoint).toBe("NONE");
  });

  it("emphasis flags mirror only what the source contains", () => {
    expect(copy.emphasis).toEqual({ country: true, employer: true, interview: true, benefit: true });
    const bare = buildAdCopyPlan({ ...bilfingerFacts, interview: [], benefits: [] }, {});
    expect(bare.emphasis.interview).toBe(false);
    expect(bare.emphasis.benefit).toBe(false);
  });

  it("keeps the original header when stripping boilerplate would gut it", () => {
    expect(coreHeaderText("Hiring", "Saudi Arabia")).toBe("Hiring");
  });

  it("the source-fidelity gate accepts a composition using the intelligent headline (core header check)", () => {
    const svg = render("STRUCTURED_PROFESSIONAL", null);
    const gate = runSourceFidelityGate(bilfingerFacts, svg);
    expect(gate.passed, gate.failures.join("; ")).toBe(true);
  });
});

describe("Commercial launch gates", () => {
  it("the commercial threshold is 95, distinct from the 85 technical minimum", () => {
    expect(COMMERCIAL_LAUNCH_THRESHOLD).toBe(95);
  });

  it("placeholder/dev domains can never be production-ready; the canonical domain can", () => {
    expect(isPlaceholderVerificationDomain("https://kai-ads.example.com/v/x?a=y")).toBe(true);
    expect(isPlaceholderVerificationDomain("http://localhost:3000/v/x?a=y")).toBe(true);
    expect(isPlaceholderVerificationDomain("http://127.0.0.1:3000/v/x")).toBe(true);
    expect(isPlaceholderVerificationDomain("not a url")).toBe(true);
    expect(isPlaceholderVerificationDomain("https://kai-ads.vercel.app/v/av-1?a=ad-1")).toBe(false);
  });
});
