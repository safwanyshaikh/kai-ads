/**
 * Manual, one-off real generation through the ONE production pipeline —
 * for debugging/tuning the Creative Brief prompt against a single fixture.
 * Requires OPENAI_API_KEY. Not part of CI gating.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAdvertisement } from "@/server/generation/pipeline/generate";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";
import { getEnv } from "@/lib/env";

const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out");

const AGENCY = {
  name: "Al-Yousuf Enterprises LLP",
  ra: "9986",
  footer: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
};

const facts: AdvertisementFacts = {
  header: "Multi Welders Required for Saudi Arabia",
  industry: "Construction",
  country: "Saudi Arabia",
  employer: null,
  positions: [{ title: "Multi Welder", salary: "SR 2,500 for 8 hours + 300 Food Allowance", experience: "Gulf experience is a must" }],
  benefits: [{ label: "Food Allowance", detail: "SR 300" }],
  interview: [],
  contact: { email: "jobs@alyousufent.com", phone: "8655960413" },
  footer: AGENCY.footer,
  agencyName: AGENCY.name,
  raLicenseId: AGENCY.ra,
  fullRegistrationNumber: AGENCY.footer,
};

async function fetchLogoBuffer(url: string | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!getEnv().OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }

  const agencyLogoPng = await fetchLogoBuffer(process.env.AGENCY_LOGO_URL);
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "adhoc-single", advertisementId: `adhoc-${Date.now()}` });
  const qr = await generateAndVerifyQr(qrUrl);

  const { imagePng, brief, usage } = await generateAdvertisement({
    facts,
    widthPx: 1024,
    heightPx: 1536,
    agencyLogoPng,
    qrPng: qr.png,
    footerText: AGENCY.name,
  });

  writeFileSync(path.join(OUT_DIR, "single-ad-test.png"), imagePng);
  writeFileSync(path.join(OUT_DIR, "single-ad-test.brief.txt"), brief);
  console.log(`Wrote single-ad-test.png — ${imagePng.length} bytes, model=${usage.model}, latencyMs=${usage.latencyMs}, qrDecodable=${qr.decodable}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
