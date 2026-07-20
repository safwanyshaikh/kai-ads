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

describe("buildMasterAdvertisementPrompt", () => {
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

  it("explicitly forbids GPT from drawing a QR code or trust badge", () => {
    expect(prompt).toMatch(/do not draw any qr code/i);
  });

  it("reserves the exact bottom-right zone the KAI Trust Layer composites into", () => {
    expect(prompt).toContain(`${TRUST_ZONE.widthPct}%`);
    expect(prompt).toContain(`${TRUST_ZONE.heightPct}%`);
    expect(prompt).toMatch(/bottom-right/i);
  });

  it("instructs GPT to render the COMPLETE advertisement, not a background", () => {
    expect(prompt).toMatch(/complete typography/i);
    expect(prompt).toMatch(/complete layout/i);
    expect(prompt).toMatch(/publication-ready/i);
  });
});
