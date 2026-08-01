import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import { buildCreativeBrief } from "@/server/generation/pipeline/creative-brief";
import { buildEditableAdvertisementSvg, rasterizeEditableSvg } from "@/server/generation/pipeline/editable-svg";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const OUT = path.join(process.cwd(), "scripts", "adhoc", "artifacts");
mkdirSync(OUT, { recursive: true });

// The exact Bilfinger source, verbatim (same as scripts/acceptance/bilfinger-acceptance.ts).
const facts: AdvertisementFacts = {
  header: "Hiring for Bilfinger Shutdown Project",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: "Bilfinger",
  projectType: "Shutdown Project",
  positions: [
    { title: "Welders - TIG & Multi", experience: "Shutdown experience required" },
    { title: "Instrument and Control Technician" },
    { title: "Rotating Equipment Technician" },
    { title: "Mechanical Technician" },
    { title: "Electrical Technician" },
  ],
  benefits: [{ label: "Basic salary + daily overtime up to 4 hours" }],
  interview: [
    { date: "14th & 15th July", location: "Baroda" },
    { date: "18th July", location: "Mumbai" },
  ],
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
  footer: "All applicants must have experience in shutdown projects",
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "RC-B1487",
  fullRegistrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
};

const agency = buildAgencyDna({
  id: "al-yousuf",
  name: "Al Yousuf Enterprises LLP",
  registrationNumber: "RC-B1487/MUM/PART/1000+/9986/2022",
  officialEmail: "jobs@alyousufent.com",
  phone: "9324995767",
  logoUrl: null,
});

async function main() {
  const env = getEnv();
  const document = buildAdvertisementDocument({
    advertisementId: "bilfinger-gold-standard",
    facts,
    agency,
    format: { key: "instagram_portrait", widthPx: 1080, heightPx: 1350, dpi: null, printOrNewspaper: false },
    preferredPack: "OIL_AND_GAS",
  });
  console.log("Design DNA:", document.design.dnaId, "—", document.design.dnaReason);

  console.log("Requesting background artwork (model:", env.KAI_IMAGE_MODEL, ")...");
  const brief = await buildCreativeBrief(document.facts, {});
  writeFileSync(path.join(OUT, "bilfinger-brief.txt"), brief);
  const provider = getImageGenerationProvider();
  const { output, usage } = await provider.generate({
    prompt: brief,
    widthPx: document.format.widthPx,
    heightPx: document.format.heightPx,
    quality: env.KAI_IMAGE_QUALITY,
  });
  const backgroundPng = Buffer.from(output.imageBase64, "base64");
  writeFileSync(path.join(OUT, "bilfinger-background.png"), backgroundPng);
  console.log("Artwork generated | latencyMs:", usage.latencyMs, "| model:", usage.model);

  const logoBuffer = readFileSync(
    path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png"),
  );

  const result = await buildEditableAdvertisementSvg(document, {
    backgroundPng,
    agencyLogoPng: logoBuffer,
    qrPng: null,
  });
  writeFileSync(path.join(OUT, "bilfinger-gold-standard.svg"), result.svg);

  const png = await rasterizeEditableSvg(result.svg, result.widthPx, result.heightPx);
  writeFileSync(path.join(OUT, "bilfinger-gold-standard.png"), png);

  console.log("Design:", document.design.dnaId, "| footer:", result.footerSelection.style);
  console.log("Size:", result.widthPx, "x", result.heightPx);
  console.log("Wrote", path.join(OUT, "bilfinger-gold-standard.svg"), "and .png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
