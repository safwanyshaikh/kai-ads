/**
 * One-off local test: renders the exact live-pipeline output for the
 * user-supplied JD ("Hiring for Abu Dhabi — Welders Tig & Arc / Multi
 * Welder") through the LEGACY deterministic pipeline (composeAdvertisement),
 * since GPT_NATIVE_AD_GENERATION defaults OFF and was never enabled in
 * production — this IS what the live app renders. Fully offline: this
 * archetype (STRUCTURED_PROFESSIONAL, 2 positions) never calls the AI
 * image provider, so no OPENAI_API_KEY is needed to reproduce and fix it.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  recommendArchetype,
  styleForArchetype,
  buildAdCopyPlan,
  buildCompositionDirectives,
  composeAdvertisement,
} from "@/server/generation/archetypes";
import { detectCompensationSignal } from "@/server/generation/compensation-signal.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { getPlatformFormat } from "@/lib/platform-formats";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out");

// This is what the KAI Intelligence Engine would extract from the pasted
// text — mapped by hand here since we're testing the renderer, not
// extraction. Every field traces directly to the pasted text.
const facts: AdvertisementFacts = {
  header: "Welders Required — Abu Dhabi",
  industry: "Construction",
  country: "UAE",
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const platformFormat = getPlatformFormat("generic_portrait");
  const density = classifyDensity(facts.positions.map((p) => ({ title: p.title, count: p.count })));
  const hasSalaryInfo = detectCompensationSignal(facts.benefits);

  const recommendation = recommendArchetype({
    positionCount: facts.positions.length,
    totalHeadcount: facts.positions.reduce((sum, p) => sum + (p.count ?? 1), 0),
    benefitCount: facts.benefits.length,
    interviewEventCount: facts.interview.length,
    hasSalarySignal: hasSalaryInfo,
    isUrgent: false,
    aspectRatio: platformFormat.widthPx / platformFormat.heightPx,
  });
  const archetype = recommendation.recommendedArchetype;
  const style = styleForArchetype(archetype);

  console.log("density:", density, "hasSalaryInfo:", hasSalaryInfo);
  console.log("recommendation:", recommendation);
  console.log("archetype:", archetype, "style:", style);

  const copy = buildAdCopyPlan(facts, { hasCompensationSignal: hasSalaryInfo });
  const directives = buildCompositionDirectives(facts, { archetype, copy });
  console.log("directives:", JSON.stringify(directives, null, 2));

  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "adhoc-test", advertisementId: "adhoc-welder" });
  const qr = await generateAndVerifyQr(qrUrl);

  const logoPath = "/tmp/fake-logo.png";
  const agencyLogoDataUri = existsSync(logoPath)
    ? `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
    : null;

  const svg = composeAdvertisement({
    facts,
    plan: {
      archetype,
      platformFormat,
      accentColor: "#0B3D2E",
      qrDataUri: `data:image/png;base64,${qr.png.toString("base64")}`,
      backgroundImageDataUri: null,
      agencyLogoDataUri,
      dna: null,
      copy,
      directives,
    },
  });

  writeFileSync(path.join(OUT_DIR, "welder-v1.svg"), svg);
  const png = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);
  writeFileSync(path.join(OUT_DIR, "welder-v1.png"), png);
  console.log("Wrote", path.join(OUT_DIR, "welder-v1.png"), `(${png.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
