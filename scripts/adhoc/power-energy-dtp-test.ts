/**
 * Final DTP/Newspaper delivery for the real Power & Energy JD — offline,
 * deterministic (no OpenAI call), through the LEGACY pipeline with all
 * fixes applied this session: destination-currency correction, the
 * fixed dead-space/logo compositing, the header/subline dedup fix.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  selectArchetype,
  styleForArchetype,
  buildAdCopyPlan,
  buildCompositionDirectives,
  composeAdvertisement,
} from "@/server/generation/archetypes";
import { detectCompensationSignal } from "@/server/generation/compensation-signal.service";
import { classifyDensity } from "@/server/generation/density-classification.service";
import { applyDestinationCurrency } from "@/server/generation/creative-director/knowledge";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { rasterizeSvg } from "@/server/generation/image-export.service";
import { getPlatformFormat } from "@/lib/platform-formats";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out");

const rawFacts: AdvertisementFacts = {
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

const facts: AdvertisementFacts = {
  ...rawFacts,
  benefits: rawFacts.benefits.map((b) => (b.detail ? { ...b, detail: applyDestinationCurrency(b.detail, rawFacts.country) } : b)),
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const platformFormat = getPlatformFormat("generic_portrait");
  const density = classifyDensity(facts.positions.map((p) => ({ title: p.title, count: p.count })));
  const hasSalaryInfo = detectCompensationSignal(facts.benefits);

  // Explicit DTP/Newspaper archetype per the request.
  const archetype = selectArchetype({ style: "NEWSPAPER", density });
  console.log("archetype:", archetype, "style:", styleForArchetype(archetype), "density:", density, "hasSalaryInfo:", hasSalaryInfo);

  const copy = buildAdCopyPlan(facts, { hasCompensationSignal: hasSalaryInfo });
  const directives = buildCompositionDirectives(facts, { archetype, copy });

  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: "final-power-energy-dtp", advertisementId: "final-power-energy-dtp" });
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

  writeFileSync(path.join(OUT_DIR, "power-energy-final-dtp.svg"), svg);
  const png = await rasterizeSvg(svg, platformFormat.widthPx, platformFormat.heightPx);
  writeFileSync(path.join(OUT_DIR, "power-energy-final-dtp.png"), png);
  console.log("Wrote power-energy-final-dtp.png —", png.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
