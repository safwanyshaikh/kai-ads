/**
 * One-off REAL GPT-Native generation for the user-supplied welder JD.
 * Requires OPENAI_API_KEY — run only in CI (see
 * .github/workflows/adhoc-single-ad.yml), never locally.
 *
 * Full real path: Creative Director -> Commercial Brief -> master prompt
 * -> GPT Image renders the COMPLETE advertisement -> KAI Trust Layer
 * composites QR/agency logo/RA license/generation ID afterward -> real
 * acceptance scoring (Visual QA + fact proofread + QR decode gate).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
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

const facts: AdvertisementFacts = {
  header: "Welders Required — Abu Dhabi",
  industry: "Construction",
  country: "United Arab Emirates",
  employer: null,
  positions: [
    { title: "Welder TIG & Arc (CS/SS)" },
    { title: "Multi Welder" },
  ],
  benefits: [
    { label: "Food Allowance", detail: "300 AED" },
    { label: "Free Accommodation" },
    { label: "Transportation" },
    { label: "Medical" },
    { label: "Yearly Leave cycle" },
  ],
  interview: [],
  contact: { phone: "8655960415" },
  footer: null,
  agencyName: "Al Yousuf Enterprises LLP",
  raLicenseId: "9986",
  fullRegistrationNumber: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
};

const brand: BrandContext = { primaryColor: "#0B3D2E", secondaryColor: "#C9A227", accentColor: "#E4572E" };

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!getEnv().OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }

  const input = factsToCreativeInput(facts, { aspectRatio: WIDTH / HEIGHT, agencyPalette: { primary: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.accentColor } });
  const direction = runCreativeDirector(input);
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, facts, { widthPx: WIDTH, heightPx: HEIGHT, brand });

  console.log("=== MASTER PROMPT ===\n", prompt, "\n=== END PROMPT ===");

  const provider = getImageGenerationProvider();
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "adhoc-welder", advertisementId: "adhoc-welder" });
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
    generationId: "KAI-ADHOC-WELDER-V1",
  });

  const acceptance = await runGptNativeAcceptance({
    finalPng,
    facts,
    expectedQrUrl: qrUrl,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    platformFormatKey: "adhoc_portrait",
  });

  writeFileSync(path.join(OUT_DIR, "welder-gpt-native-v1.png"), finalPng);
  writeFileSync(
    path.join(OUT_DIR, "welder-gpt-native-v1.report.json"),
    JSON.stringify({ imageSha256: computeImageSha256(finalPng), acceptance }, null, 2),
  );
  console.log("Wrote welder-gpt-native-v1.png —", finalPng.length, "bytes");
  console.log("Visual QA:", JSON.stringify(acceptance.visualQa, null, 2));
  console.log("Fact check:", JSON.stringify(acceptance.factCheck, null, 2));
  console.log("Defects:", acceptance.defects);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
