import "dotenv/config";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { generateAdvertisement } from "@/server/generation/pipeline/generate";
import { generateCreativeV2 } from "@/server/generation/experimental/creative-v2";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * Generates the SAME advertisement down both paths so they can be judged
 * side by side: the production pipeline (renderer owns the facts) and the
 * experimental Creative V2 (image model owns the whole composition).
 *
 * Usage: ENABLE_CREATIVE_V2=true npx tsx scripts/adhoc/creative-v2-compare.ts <outDir>
 */
const W = 1080;
const H = 1350;

const facts = {
  header: "PLANT MAINTENANCE — SAUDI ARABIA",
  agencyName: "Al Yousuf Enterprises LLP",
  industry: "Oil & Gas",
  country: "SAUDI ARABIA",
  positions: [
    "Instrument Technician",
    "Analyzer Technician",
    "Electrical Technician",
    "Mechanical Technical Technician",
    "Rotating Equipment Technician",
  ].map((title) => ({ title, experience: "5 years in plant maintenance" })),
  benefits: [],
  interview: [],
  contact: { email: "jobs@alyousufent.com" },
} as unknown as AdvertisementFacts;

async function main() {
  const outDir = process.argv[2] ?? ".";

  const logo = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><text x="150" y="170" font-size="54" font-weight="700" fill="#0B1F33" text-anchor="middle">AL-Yousuf</text></svg>`,
    ),
  )
    .png()
    .toBuffer();
  const qr = await sharp({ create: { width: 400, height: 400, channels: 4, background: "#111111" } })
    .png()
    .toBuffer();

  const current = await generateAdvertisement({
    facts,
    widthPx: W,
    heightPx: H,
    agencyLogoPng: logo,
    qrPng: qr,
    agencyName: facts.agencyName,
    registrationNumber: "9986",
    contactLine: "jobs@alyousufent.com",
    addressLine: "https://www.alyousufent.com",
    footerStyle: null,
    brandBadges: null,
  });
  await writeFile(`${outDir}/current.png`, current.imagePng);
  console.log(`current   model=${current.usage.model} ms=${current.usage.latencyMs}`);

  const v2 = await generateCreativeV2({ facts, widthPx: W, heightPx: H, qrPng: qr });
  await writeFile(`${outDir}/creative-v2.png`, v2.imagePng);
  console.log(`creativeV2 model=${v2.usage.model} ms=${v2.usage.latencyMs}`);
  console.log(`  missing facts   : ${v2.validation.missing.length ? v2.validation.missing.join(" | ") : "none"}`);
  console.log(`  unverified text : ${v2.validation.unverified.length ? v2.validation.unverified.join(" | ") : "none"}`);
}

main().catch((error: unknown) => {
  const e = error as { message?: string; operatorDetail?: string };
  console.error("FAILED:", e.message, e.operatorDetail ? `\nDETAIL: ${e.operatorDetail}` : "");
  process.exit(1);
});
