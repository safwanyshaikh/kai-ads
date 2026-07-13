/**
 * REAL-API end-to-end acceptance run (CI only — requires OPENAI_API_KEY).
 *
 * Exercises the actual production modules, no mocks:
 *   runKaiExtraction (Truth Brain, gpt text model + enforceSourceGrounding)
 *   → recommendArchetype (Creative Brain suitability)
 *   → KaiCreativeEngineProvider (real gpt image model, Visual Hero only)
 *   → composeAdvertisement (four archetype engines)
 *   → generateAndVerifyQr (KAI QR, self-decode)
 *   → runAcceptanceLoop (Gates A/B/C + KaiVisualQaProvider vision QA,
 *     bounded corrections, max 3 iterations)
 *   → exportImage (PNG/JPG/PDF)
 *
 * Never prints or writes any secret. Writes all artifacts + a manifest
 * to scripts/acceptance/artifacts/ for upload by the workflow.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { runKaiExtraction } from "@/server/ai/openai/kai-extraction-engine";
import {
  buildAdCopyPlan,
  buildImageBrief,
  composeAdvertisement,
  recommendArchetype,
  resolveAgencyVisualDna,
  type AdvertisementArchetype,
  type AdvertisementFacts,
} from "@/server/generation/archetypes";
import {
  COMMERCIAL_LAUNCH_THRESHOLD,
  isPlaceholderVerificationDomain,
  runAcceptanceLoop,
} from "@/server/generation/acceptance/acceptance-loop";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getVisualQaProvider } from "@/server/ai/visual-qa";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { rasterizeSvg, exportImage } from "@/server/generation/image-export.service";
import { getPlatformFormat } from "@/lib/platform-formats";
import { deriveCompactRegistrationNumber } from "@/lib/registration-number";
import { normalizeInterviewEvents } from "@/server/generation/interview-events";
import { getEnv } from "@/lib/env";

const OUT = path.join(process.cwd(), "scripts", "acceptance", "artifacts");
mkdirSync(OUT, { recursive: true });

// The exact Bilfinger source, verbatim.
const SOURCE_TEXT = `Hiring for Bilfinger Shutdown Project Saudi Arabia

Positions:
- Welders - TIG & Multi
- Instrument and Control Technician
- Rotating Equipment Technician
- Mechanical Technician
- Electrical Technician

Benefit:
- Basic salary + daily overtime up to 4 hours

Mandatory experience:
- All applicants must have experience in shutdown projects

Contact:
9324995767

Email:
jobs@alyousufent.com

Interview:
- Baroda — 14th & 15th July
- Mumbai — 18th July`;

// Verified tenant identity (agency record fields, not extraction output —
// exactly as the production service reads them from the Agency table).
const AGENCY_NAME = "Al Yousuf Enterprises LLP";
const FULL_RC = "RC-B1487/MUM/PART/1000+/9986/2022";

const ARCHETYPES: AdvertisementArchetype[] = [
  "STRUCTURED_PROFESSIONAL", // recommended first
  "VISUAL_HERO",
  "HIGH_DENSITY",
  "DTP_NEWSPAPER",
];

const ACCENTS: Record<AdvertisementArchetype, string> = {
  VISUAL_HERO: "#e0342c",
  STRUCTURED_PROFESSIONAL: "#0d4f8b",
  HIGH_DENSITY: "#0d4f8b",
  DTP_NEWSPAPER: "#8b0d0d",
};

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set — this acceptance run requires the real API.");
    process.exit(1);
  }
  const env = getEnv();
  const fmt = getPlatformFormat("instagram_post");

  // ---- TRUTH BRAIN: real extraction over the exact source ----
  console.log("=== Truth Brain: real extraction (model:", env.KAI_TEXT_MODEL, ") ===");
  const extraction = await runKaiExtraction({ text: SOURCE_TEXT });
  writeFileSync(path.join(OUT, "extraction-result.json"), JSON.stringify(extraction, null, 2));
  console.log("extraction latencyMs:", extraction.usage.latencyMs, "| model:", extraction.model);
  console.log("extraction result:", JSON.stringify(extraction.result, null, 2));

  const r = extraction.result;
  const facts: AdvertisementFacts = Object.freeze({
    // Header is recruiter-controlled in production (draft field); the
    // source's own first line is used verbatim.
    header: "Hiring for Bilfinger Shutdown Project",
    industry: r.industry.value ?? "Oil & Gas",
    country: r.country.value ?? "Saudi Arabia",
    employer: r.employer.value,
    positions: r.positions.map((p) => ({
      title: p.title,
      count: p.quantity.value ?? undefined,
      experience: p.experience.value ?? undefined,
    })),
    benefits: (r.benefits.value ?? []).map((label: string) => ({ label })),
    interview:
      r.interviewEvents.length > 0
        ? normalizeInterviewEvents({ events: r.interviewEvents })
        : normalizeInterviewEvents({ date: r.interviewDate.value, location: r.interviewVenue.value }),
    contact: {
      phone: r.contact.value?.phone ?? undefined,
      email: r.contact.value?.email ?? undefined,
    },
    footer: "All applicants must have experience in shutdown projects",
    agencyName: AGENCY_NAME,
    raLicenseId: deriveCompactRegistrationNumber(FULL_RC),
    fullRegistrationNumber: FULL_RC,
  });
  writeFileSync(path.join(OUT, "facts.json"), JSON.stringify(facts, null, 2));

  // ---- CREATIVE BRAIN: suitability ----
  const recommendation = recommendArchetype({
    positionCount: facts.positions.length,
    totalHeadcount: facts.positions.reduce((s, p) => s + (p.count ?? 1), 0),
    benefitCount: facts.benefits.length,
    interviewEventCount: facts.interview.length,
    hasSalarySignal: true,
    isUrgent: false,
    aspectRatio: fmt.widthPx / fmt.heightPx,
  });
  writeFileSync(path.join(OUT, "archetype-recommendation.json"), JSON.stringify(recommendation, null, 2));
  console.log("=== Creative Brain recommendation ===");
  console.log(JSON.stringify(recommendation, null, 2));

  // ---- KAI QR (verification moat) ----
  const advertisementId = `ad-bilfinger-${Date.now()}`;
  const verificationId = "av-al-yousuf-acceptance";
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: verificationId, advertisementId });
  const qr = await generateAndVerifyQr(qrUrl);
  console.log("QR destination:", qrUrl, "| self-decode:", qr.decodable);
  if (!qr.decodable) {
    console.error("QR self-decode FAILED — aborting.");
    process.exit(1);
  }
  const qrDataUri = `data:image/png;base64,${qr.png.toString("base64")}`;

  const visualQa = getVisualQaProvider();
  console.log("Visual QA Brain:", visualQa ? `configured (${env.KAI_VISION_MODEL})` : "NOT CONFIGURED");

  // Commercial launch gate: the QR must encode the canonical production
  // domain — a placeholder/dev domain can never be production-ready.
  const placeholderDomain = isPlaceholderVerificationDomain(qrUrl);
  console.log("QR canonical-domain check:", placeholderDomain ? "PLACEHOLDER (NOT production-ready)" : "PRODUCTION DOMAIN OK");
  if (placeholderDomain) {
    console.error("KAI_PUBLIC_DOMAIN is a placeholder domain — set it to the canonical production domain.");
    process.exit(1);
  }

  // Agency Visual DNA — derived from the tenant's real logo asset.
  const logoBuffer = readFileSync(path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png"));
  const agencyLogoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  const dna = await resolveAgencyVisualDna({ logo: logoBuffer });
  console.log("Agency Visual DNA:", JSON.stringify(dna));
  writeFileSync(path.join(OUT, "visual-dna.json"), JSON.stringify(dna, null, 2));

  // Advertisement Intelligence — grounded emphasis plan.
  const copy = buildAdCopyPlan(facts, { hasCompensationSignal: true });
  console.log("Ad copy plan:", JSON.stringify(copy));
  writeFileSync(path.join(OUT, "ad-copy-plan.json"), JSON.stringify(copy, null, 2));
  console.log("Commercial launch threshold:", COMMERCIAL_LAUNCH_THRESHOLD);

  const cropQrRegion = async (png: Buffer) => {
    const w = Math.round(fmt.widthPx * 0.45);
    const h = Math.round(fmt.heightPx * 0.3);
    return sharp(png)
      .extract({ left: fmt.widthPx - w, top: fmt.heightPx - h, width: w, height: h })
      .png()
      .toBuffer();
  };

  const manifest: Record<string, unknown>[] = [];

  for (const archetype of ARCHETYPES) {
    console.log(`\n=== ${archetype} ===`);
    console.log(
      "suitability:",
      recommendation.suitabilityScores[archetype],
      "| mode:",
      archetype === recommendation.recommendedArchetype ? "AUTO-RECOMMENDED" : "EXPLICITLY FORCED (acceptance matrix)",
    );

    // Real image generation — Visual Hero only.
    let backgroundImageDataUri: string | null = null;
    if (archetype === "VISUAL_HERO") {
      console.log("KAI Creative Engine: generating real background (model:", env.KAI_IMAGE_MODEL, ")...");
      const provider = getImageGenerationProvider();
      const { output, usage } = await provider.generate({
        prompt: buildImageBrief(facts),
        widthPx: fmt.widthPx,
        heightPx: fmt.heightPx,
        quality: "medium",
      });
      backgroundImageDataUri = `data:${output.mimeType};base64,${output.imageBase64}`;
      writeFileSync(path.join(OUT, "visual-hero-raw-background.png"), Buffer.from(output.imageBase64, "base64"));
      console.log("image generated | latencyMs:", usage.latencyMs, "| model:", usage.model);
    }

    const outcome = await runAcceptanceLoop(
      facts,
      {
        archetype,
        platformFormat: fmt,
        accentColor: ACCENTS[archetype],
        qrDataUri,
        backgroundImageDataUri,
        agencyLogoDataUri,
        dna,
        copy,
      },
      {
        compose: (f, p) => composeAdvertisement({ facts: f, plan: p }),
        rasterize: (svg) => rasterizeSvg(svg, fmt.widthPx, fmt.heightPx),
        visualQa,
        expectedQrUrl: qrUrl,
        cropQrRegion,
        passThreshold: COMMERCIAL_LAUNCH_THRESHOLD,
        regenerateImage:
          archetype === "VISUAL_HERO"
            ? async (defectNotes) => {
                console.log("REGENERATE_IMAGE requested — regenerating with defect feedback...");
                try {
                  const provider = getImageGenerationProvider();
                  const { output } = await provider.generate({
                    prompt: `${buildImageBrief(facts)} Address these defects from a previous attempt: ${defectNotes.join("; ")}`,
                    widthPx: fmt.widthPx,
                    heightPx: fmt.heightPx,
                    quality: "medium",
                  });
                  writeFileSync(
                    path.join(OUT, `visual-hero-raw-background-regen-${Date.now()}.png`),
                    Buffer.from(output.imageBase64, "base64"),
                  );
                  return `data:${output.mimeType};base64,${output.imageBase64}`;
                } catch (error) {
                  console.error("image regeneration failed:", error instanceof Error ? error.message : error);
                  return null;
                }
              }
            : undefined,
      },
    );

    writeFileSync(path.join(OUT, `${archetype}.png`), outcome.finalPng);
    const jpg = await exportImage(outcome.finalPng, "jpg", { widthPx: fmt.widthPx, heightPx: fmt.heightPx });
    const pdf = await exportImage(outcome.finalPng, "pdf", { widthPx: fmt.widthPx, heightPx: fmt.heightPx });
    writeFileSync(path.join(OUT, `${archetype}.jpg`), jpg.buffer);
    writeFileSync(path.join(OUT, `${archetype}.pdf`), pdf.buffer);
    writeFileSync(
      path.join(OUT, `${archetype}-acceptance-history.json`),
      JSON.stringify({ status: outcome.status, finalScore: outcome.finalScore, blockReason: outcome.blockReason, iterations: outcome.iterations }, null, 2),
    );

    console.log("status:", outcome.status, "| finalScore:", outcome.finalScore, "| iterations:", outcome.iterations.length);
    for (const it of outcome.iterations) {
      console.log(
        `  iteration ${it.iteration}: gates A/B/C = ${it.gates.sourceFidelity.passed}/${it.gates.technicalRender.passed}/${it.gates.qr.passed}` +
          ` | score: ${it.visualQa?.overallScore ?? "n/a"} | catastrophic: ${JSON.stringify(it.visualQa?.catastrophicDefects ?? [])}` +
          ` | defects: ${JSON.stringify(it.visualQa?.defects ?? [])} | corrections: ${JSON.stringify(it.visualQa?.requiredCorrections ?? [])}` +
          ` | tuning applied: ${JSON.stringify(it.tuning)} | image regenerated: ${it.regeneratedImage}`,
      );
    }
    if (outcome.blockReason) console.log("  blockReason:", outcome.blockReason);

    manifest.push({
      archetype,
      mode: archetype === recommendation.recommendedArchetype ? "recommended" : "forced",
      suitabilityScore: recommendation.suitabilityScores[archetype],
      status: outcome.status,
      finalScore: outcome.finalScore,
      iterations: outcome.iterations.length,
      blockReason: outcome.blockReason ?? null,
      usedRealAiImage: archetype === "VISUAL_HERO" && backgroundImageDataUri !== null,
    });
  }

  writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        branch: process.env.GITHUB_REF_NAME ?? null,
        commit: process.env.GITHUB_SHA ?? null,
        models: { text: env.KAI_TEXT_MODEL, vision: env.KAI_VISION_MODEL, image: env.KAI_IMAGE_MODEL },
        commercialThreshold: COMMERCIAL_LAUNCH_THRESHOLD,
        qrCanonicalDomainOk: !placeholderDomain,
        visualDna: dna,
        adCopyPlan: copy,
        advertisementId,
        verificationId,
        qrDestination: qrUrl,
        platformFormat: { key: fmt.key, widthPx: fmt.widthPx, heightPx: fmt.heightPx },
        recommendation,
        results: manifest,
      },
      null,
      2,
    ),
  );
  console.log("\n=== MANIFEST ===");
  console.log(JSON.stringify(manifest, null, 2));

  const deterministicBlock = manifest.some((m) => m.status === "BLOCKED_DETERMINISTIC");
  if (deterministicBlock) {
    console.error("A deterministic gate failed — see manifest.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
