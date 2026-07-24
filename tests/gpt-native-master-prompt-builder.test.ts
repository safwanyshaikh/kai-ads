import { describe, expect, it } from "vitest";
import { runCreativeDirector, type CreativeInput } from "@/server/generation/creative-director";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt, TRUST_ZONE } from "@/server/generation/gpt-native/master-prompt-builder";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const INPUT: CreativeInput = {
  employer: "Halliburton",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  header: "Requirement for Saudi Arabia — Oil & Gas Field Services",
  positions: [{ title: "Electrical Technician", count: 20 }, { title: "CP Tester", count: 5 }],
  benefits: [{ label: "Free Accommodation" }],
  interview: [{ date: "20 July", location: "Mumbai" }],
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  channel: "DTP_NEWSPAPER",
};

const FACTS: AdvertisementFacts = {
  header: "Requirement for Saudi Arabia — Oil & Gas Field Services",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Halliburton",
  positions: [{ title: "Electrical Technician", count: 20 }, { title: "CP Tester", count: 5 }],
  benefits: [{ label: "Free Accommodation" }],
  interview: [{ date: "20 July", location: "Mumbai" }],
  contact: { phone: "+91 98765 43210", email: "jobs@alyousufent.com" },
  footer: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
};

describe("buildMasterAdvertisementPrompt (Sprint 008 Workstream D — Prompt DNA)", () => {
  const direction = runCreativeDirector(INPUT);
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, FACTS, { widthPx: 1080, heightPx: 1350 });

  it("is ONE prompt string carrying every grounded fact verbatim", () => {
    expect(prompt).toContain("Electrical Technician");
    expect(prompt).toContain("CP Tester");
    expect(prompt).toContain("Halliburton");
    expect(prompt).toContain("Al-Yousuf Enterprises LLP");
    expect(prompt).toContain("+91 98765 43210");
  });

  it("never fabricates a fact absent from AdvertisementFacts", () => {
    const noSalaryFacts: AdvertisementFacts = { ...FACTS, employer: null };
    const p = buildMasterAdvertisementPrompt(brief, noSalaryFacts, { widthPx: 1080, heightPx: 1350 });
    expect(p).toContain("do not invent one");
  });

  it("explicitly forbids GPT from drawing a QR code, logo, or trust badge", () => {
    expect(prompt).toMatch(/do not draw any qr code/i);
    expect(prompt).toMatch(/do not draw or invent any logo/i);
  });

  it("reserves the exact bottom-right zone the KAI Trust Layer composites into", () => {
    expect(prompt).toContain(`${TRUST_ZONE.widthPct}%`);
    expect(prompt).toContain(`${TRUST_ZONE.heightPct}%`);
    expect(prompt).toMatch(/bottom-right/i);
  });

  it("instructs GPT to create the FULL, publication-ready advertisement", () => {
    expect(prompt).toMatch(/full advertisement/i);
    expect(prompt).toMatch(/finished typography/i);
    expect(prompt).toMatch(/publication-ready/i);
  });

  // Workstream D law: no internal enum tokens or engineering vocabulary
  // may leak into the creative brief — the image model gets art-director
  // language, never implementation constants.
  it("leaks NO internal enum tokens or engineering constants", () => {
    for (const token of [
      "DTP_GRID",
      "SINGLE_ROLE_BOX",
      "MULTI_VACANCY_POSTER",
      "MEGA_PROJECT personality",
      "WORKER_HERO",
      "URGENT_MOBILIZATION",
      "MASS_HIRING",
      "OFFSHORE_PLATFORM",
      "prominence: HIGH",
      "prominence: MEDIUM",
      "prominence: LOW",
      "EMPLOYER >",
      " -> ",
      "vacancyProminence",
      "GPT_NATIVE",
    ]) {
      expect(prompt, `internal token "${token}" leaked into the prompt`).not.toContain(token);
    }
  });

  it("translates the Brain's decisions into visual creative language", () => {
    // The reading order arrives as a sentence of human phrases, not lever enums.
    expect(prompt).toMatch(/the eye should travel/i);
    // Photography direction is explicit (Supreme P7).
    expect(prompt).toMatch(/photorealistic/i);
    expect(prompt).toMatch(/no plastic skin/i);
  });

  it("varies composition guidance with content density instead of hardcoding one layout", () => {
    const sparseFacts: AdvertisementFacts = { ...FACTS, positions: [{ title: "Site Manager", count: 1 }] };
    const sparseInput: CreativeInput = { ...INPUT, positions: [{ title: "Site Manager", count: 1 }] };
    const sparseBrief = buildCommercialAdvertisementBrief(runCreativeDirector(sparseInput));
    const sparsePrompt = buildMasterAdvertisementPrompt(sparseBrief, sparseFacts, { widthPx: 1080, heightPx: 1350 });

    const denseInput: CreativeInput = {
      ...INPUT,
      positions: Array.from({ length: 30 }, (_, i) => ({ title: `Role ${i}`, count: 1 })),
    };
    const denseFacts: AdvertisementFacts = {
      ...FACTS,
      positions: Array.from({ length: 30 }, (_, i) => ({ title: `Role ${i}`, count: 1 })),
    };
    const denseBrief = buildCommercialAdvertisementBrief(runCreativeDirector(denseInput));
    const densePrompt = buildMasterAdvertisementPrompt(denseBrief, denseFacts, { widthPx: 1080, heightPx: 1350 });

    expect(sparsePrompt).toMatch(/cinematic hero poster/i);
    expect(densePrompt).toMatch(/magazine|newspaper listing/i);
    expect(sparsePrompt).not.toEqual(densePrompt);
  });

  it("weaves the agency's Visual DNA palette in when provided (Supreme P10)", () => {
    const branded = buildMasterAdvertisementPrompt(brief, FACTS, {
      widthPx: 1080,
      heightPx: 1350,
      brand: { primaryColor: "#0B3D2E", secondaryColor: "#C9A227", accentColor: "#E4572E" },
    });
    expect(branded).toContain("#0B3D2E");
    expect(branded).toContain("#C9A227");
    expect(branded).toContain("#E4572E");
    expect(branded).toMatch(/belongs to this agency/i);
  });
});
