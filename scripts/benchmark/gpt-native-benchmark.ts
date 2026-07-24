/**
 * Sprint 008 Workstream J — GPT-Native Benchmark Harness (Supreme
 * Principle 16: continuous, measurable benchmarking).
 *
 * REAL-API run (requires OPENAI_API_KEY): for each fixture below it runs
 * the full GPT-native creative path — Creative Director → Commercial
 * Brief → master prompt → GPT Image → Trust Layer → acceptance scoring —
 * and writes, per fixture:
 *   scripts/benchmark/artifacts/{fixture}.png        the advertisement
 *   scripts/benchmark/artifacts/{fixture}.scores.json  scored dimensions
 *   scripts/benchmark/artifacts/summary.json           run summary + deltas
 *
 * Scored automatically (from the Visual QA brain + fact verification):
 * typography/spelling fidelity, visual hierarchy, commercial appeal,
 * imagery/photography, readability, trust integration, overall quality.
 * Scored manually (recorded as null, by design — no fake numbers):
 * GPT-Pro comparison and luxury/brand consistency judgments, which
 * require a human holding both images (GPT Pro output cannot be produced
 * via API; curate samples by hand and compare against the PNGs).
 *
 * Previous-KAI comparison: if artifacts from an earlier run exist, the
 * summary reports score deltas per fixture — regression is visible
 * before rollout, satisfying "previous KAI output" benchmarking.
 *
 * Without OPENAI_API_KEY the harness prints each fixture's master prompt
 * and exits 0 — honest about being unable to score without the API.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt } from "@/server/generation/gpt-native/master-prompt-builder";
import { applyTrustLayer, computeImageSha256 } from "@/server/generation/gpt-native/trust-layer";
import { runGptNativeAcceptance } from "@/server/generation/gpt-native/acceptance";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const WIDTH = 1024;
const HEIGHT = 1536;
const ARTIFACTS_DIR = path.join(process.cwd(), "scripts/benchmark/artifacts");

const AGENCY = {
  name: "Al-Yousuf Enterprises LLP",
  ra: "9986",
  footer: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
};

/** Real requirement fixtures spanning the density spectrum. */
const FIXTURES: Record<string, AdvertisementFacts> = {
  "mukti-welders-sparse": {
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
  },
  "yanbu-rcm-medium": {
    header: "Long-Term Manpower Requirement — Yanbu, Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: null,
    positions: [
      { title: "RCM Instrument Engineer", count: 2, salary: "8-9 yrs: SAR 10,000 · 9-10 yrs: SAR 11,000 · 10-11 yrs: SAR 12,000 · 11+ yrs: SAR 13,000" },
      { title: "RCM Facilitator", count: 1, salary: "8-9 yrs: SAR 11,000 · 9-10 yrs: SAR 12,000 · 10-11 yrs: SAR 13,000 · 11+ yrs: SAR 14,000" },
    ],
    benefits: [{ label: "Overtime Applicable" }, { label: "2 Year Contract" }, { label: "8 hours/day, 5 days/week" }],
    interview: [{ date: "Online", location: "Interview Mode: Online" }],
    contact: { email: "jobs@alyousufent.com" },
    footer: AGENCY.footer,
    agencyName: AGENCY.name,
    raLicenseId: AGENCY.ra,
    fullRegistrationNumber: AGENCY.footer,
  },
  "bilfinger-shutdown-medium": {
    header: "Hiring for Bilfinger Shutdown Project",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Bilfinger",
    positions: [
      { title: "Welders — TIG & Multi" },
      { title: "Instrument and Control Technician" },
      { title: "Rotating Equipment Technician" },
      { title: "Mechanical Technician" },
      { title: "Electrical Technician" },
    ],
    benefits: [{ label: "Basic salary + daily up to 4 hours OT" }],
    interview: [
      { date: "14th & 15th July", location: "Baroda" },
      { date: "18th July", location: "Mumbai" },
    ],
    contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
    footer: "All applicants must have experience in shutdown projects",
    agencyName: AGENCY.name,
    raLicenseId: AGENCY.ra,
    fullRegistrationNumber: AGENCY.footer,
  },
};

interface FixtureScores {
  fixture: string;
  generatedAt: string;
  imageSha256: string;
  attempts: number;
  visualQaScore: number | null;
  spellingDefects: number;
  totalDefects: number;
  qrDecodable: boolean;
  /** Manual-only dimensions — never auto-faked. */
  gptProComparison: null;
  luxuryAndBrandConsistency: null;
}

async function runFixture(name: string, facts: AdvertisementFacts): Promise<FixtureScores> {
  const creativeInput = factsToCreativeInput(facts, { aspectRatio: WIDTH / HEIGHT });
  const direction = runCreativeDirector(creativeInput);
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, facts, { widthPx: WIDTH, heightPx: HEIGHT });

  const provider = getImageGenerationProvider();
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: `bench-${name}`, advertisementId: `bench-${name}` });
  const qr = await generateAndVerifyQr(qrUrl);

  console.log(`\n[${name}] generating…`);
  const { output } = await provider.generate({
    prompt,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    quality: getEnv().KAI_IMAGE_QUALITY,
  });

  const finalPng = await applyTrustLayer({
    baseImagePng: Buffer.from(output.imageBase64, "base64"),
    qrPng: qr.png,
    agencyName: facts.agencyName,
    raLicenseId: facts.raLicenseId,
    version: 1,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    generationId: `KAI-BENCH-${name.toUpperCase().slice(0, 8)}-V1`,
  });

  console.log(`[${name}] scoring…`);
  const acceptance = await runGptNativeAcceptance({
    finalPng,
    facts,
    expectedQrUrl: qrUrl,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    platformFormatKey: "benchmark_portrait",
  });

  writeFileSync(path.join(ARTIFACTS_DIR, `${name}.png`), finalPng);
  const scores: FixtureScores = {
    fixture: name,
    generatedAt: new Date().toISOString(),
    imageSha256: computeImageSha256(finalPng),
    attempts: 1,
    visualQaScore: acceptance.visualQaScore,
    spellingDefects: acceptance.defects.filter((d) => d.startsWith("Spelling")).length,
    totalDefects: acceptance.defects.length,
    qrDecodable: acceptance.qrDecodable,
    gptProComparison: null,
    luxuryAndBrandConsistency: null,
  };
  writeFileSync(path.join(ARTIFACTS_DIR, `${name}.scores.json`), JSON.stringify({ ...scores, defects: acceptance.defects }, null, 2));
  console.log(`[${name}] QA=${scores.visualQaScore ?? "skipped"} defects=${scores.totalDefects} qr=${scores.qrDecodable}`);
  return scores;
}

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  if (!getEnv().OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set — printing master prompts only (no scoring possible without the API).\n");
    for (const [name, facts] of Object.entries(FIXTURES)) {
      const direction = runCreativeDirector(factsToCreativeInput(facts, { aspectRatio: WIDTH / HEIGHT }));
      const brief = buildCommercialAdvertisementBrief(direction);
      console.log(`\n===== ${name} =====\n`);
      console.log(buildMasterAdvertisementPrompt(brief, facts, { widthPx: WIDTH, heightPx: HEIGHT }));
    }
    return;
  }

  // Previous-run scores, if any, for regression deltas.
  const previousPath = path.join(ARTIFACTS_DIR, "summary.json");
  const previous: Record<string, FixtureScores> = existsSync(previousPath)
    ? Object.fromEntries(
        (JSON.parse(readFileSync(previousPath, "utf-8")).fixtures as FixtureScores[]).map((f) => [f.fixture, f]),
      )
    : {};

  const results: FixtureScores[] = [];
  for (const [name, facts] of Object.entries(FIXTURES)) {
    results.push(await runFixture(name, facts));
  }

  const deltas = results.map((r) => ({
    fixture: r.fixture,
    visualQaScore: r.visualQaScore,
    previousScore: previous[r.fixture]?.visualQaScore ?? null,
    delta:
      r.visualQaScore != null && previous[r.fixture]?.visualQaScore != null
        ? r.visualQaScore - (previous[r.fixture].visualQaScore as number)
        : null,
  }));

  writeFileSync(previousPath, JSON.stringify({ generatedAt: new Date().toISOString(), fixtures: results, deltas }, null, 2));
  console.log("\n===== SUMMARY =====");
  for (const d of deltas) {
    console.log(`${d.fixture}: QA=${d.visualQaScore ?? "skipped"} (prev ${d.previousScore ?? "—"}, delta ${d.delta ?? "—"})`);
  }
  console.log("\nManual dimensions (GPT-Pro comparison, luxury/brand consistency): review the PNGs in scripts/benchmark/artifacts/ against curated GPT Pro samples.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
