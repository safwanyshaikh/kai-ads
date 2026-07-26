/**
 * One-off REAL GPT-Native generation for the Power & Energy JD, to
 * directly compare against a plain-ChatGPT sample the user produced from
 * the same job description. Requires OPENAI_API_KEY — run only in CI.
 *
 * Full real path: Creative Director -> Commercial Brief -> master prompt
 * -> GPT Image renders the COMPLETE advertisement -> KAI Trust Layer
 * composites QR/agency logo/RA license/generation ID afterward -> real
 * acceptance scoring (Visual QA + fact proofread + QR decode gate).
 *
 * AGENCY_LOGO_URL (optional env var): if the agency's real logo is at a
 * public URL, it's fetched and composited for real, exactly like
 * gpt-native-generation.service.ts's fetchLogoBuffer(). Without it, the
 * ad renders honestly without a logo rather than fabricating a fake one.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
import { applyDestinationCurrency } from "@/server/generation/creative-director/knowledge";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt, type BrandContext } from "@/server/generation/gpt-native/master-prompt-builder";
import { applyTrustLayer, computeImageSha256 } from "@/server/generation/gpt-native/trust-layer";
import { runGptNativeAcceptance } from "@/server/generation/gpt-native/acceptance";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const WIDTH = 1024;
const HEIGHT = 1536;
const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out");

// Every field traces directly to the pasted JD — no invented values.
const facts: AdvertisementFacts = {
  header: "Power Infrastructure Engineers — Saudi Arabia",
  industry: "Power & Energy",
  country: "Saudi Arabia",
  employer: null,
  positions: [
    { title: "Testing & Commissioning Engineer" },
    { title: "Protection Engineer" },
    { title: "Design Coordinator" },
    { title: "Protection Design Engineer" },
  ],
  benefits: [
    { label: "Salary Range", detail: "5K to 7K Basic (varies based on interview assessment)" },
  ],
  interview: [],
  contact: { email: "jobs@alyousufent.com" },
  footer: "Bachelor's Degree - Electrical (5+ yrs) required · SCE/Saudi Experience preferred · GIS substation up to 400KV required",
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
};
// Mirrors what gpt-native-generation.service.ts now does for every real
// generation: a bare monetary figure gets the destination's real currency
// applied before it ever reaches the prompt.
facts.benefits = facts.benefits.map((b) =>
  b.detail ? { ...b, detail: applyDestinationCurrency(b.detail, facts.country) } : b,
);

const brand: BrandContext = { primaryColor: "#0B3D2E", secondaryColor: "#C9A227", accentColor: "#E4572E" };

async function fetchLogoBuffer(url: string | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Logo fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn("Logo fetch failed:", error);
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
  console.log("Agency logo:", agencyLogoPng ? `${agencyLogoPng.length} bytes fetched` : "none (no AGENCY_LOGO_URL set)");

  const input = factsToCreativeInput(facts, { aspectRatio: WIDTH / HEIGHT, agencyPalette: { primary: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.accentColor } });
  const direction = runCreativeDirector(input);
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, facts, { widthPx: WIDTH, heightPx: HEIGHT, brand });

  console.log("=== MASTER PROMPT ===\n", prompt, "\n=== END PROMPT ===");

  const provider = getImageGenerationProvider();
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "adhoc-power-energy", advertisementId: "adhoc-power-energy" });
  const qr = await generateAndVerifyQr(qrUrl);

  const { output } = await provider.generate({ prompt, widthPx: WIDTH, heightPx: HEIGHT, quality: getEnv().KAI_IMAGE_QUALITY });

  const finalPng = await applyTrustLayer({
    baseImagePng: Buffer.from(output.imageBase64, "base64"),
    qrPng: qr.png,
    agencyName: facts.agencyName,
    raLicenseId: facts.raLicenseId!,
    version: 1,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    generationId: "KAI-ADHOC-POWERENERGY-V1",
    agencyLogoPng,
  });

  const acceptance = await runGptNativeAcceptance({
    finalPng,
    facts,
    expectedQrUrl: qrUrl,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    platformFormatKey: "adhoc_portrait",
  });

  writeFileSync(path.join(OUT_DIR, "power-energy-gpt-native-v1.png"), finalPng);
  writeFileSync(
    path.join(OUT_DIR, "power-energy-gpt-native-v1.report.json"),
    JSON.stringify({ imageSha256: computeImageSha256(finalPng), acceptance }, null, 2),
  );
  console.log("Wrote power-energy-gpt-native-v1.png —", finalPng.length, "bytes");
  console.log("Visual QA:", JSON.stringify(acceptance.visualQa, null, 2));
  console.log("Fact check:", JSON.stringify(acceptance.factCheck, null, 2));
  console.log("Defects:", acceptance.defects);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
