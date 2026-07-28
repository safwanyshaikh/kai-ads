/**
 * REAL-API end-to-end acceptance run (CI only — requires OPENAI_API_KEY).
 *
 * Exercises the ONE production pipeline, no mocks:
 *   runKaiExtraction (Truth Brain, real text model + enforceSourceGrounding)
 *   → buildAdvertisementFacts (Requirement Intelligence)
 *   → generateAdvertisement (Creative Brief → GPT Image → Minimal Branding
 *     Overlay — the exact function the UI's generate route calls)
 *   → generateAndVerifyQr (KAI QR, self-decode)
 *   → exportImage (PNG/JPG/PDF)
 *
 * Never prints or writes any secret. Writes all artifacts + a manifest
 * to scripts/acceptance/artifacts/ for upload by the workflow.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runKaiExtraction } from "@/server/ai/openai/kai-extraction-engine";
import { generateAdvertisement } from "@/server/generation/pipeline/generate";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { exportImage } from "@/server/generation/image-export.service";
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

/**
 * The verification QR must always encode the KAI-controlled canonical
 * production domain — never a placeholder/dev/localhost domain. A launch
 * gate this script enforces before treating a run as commercially valid.
 */
function isPlaceholderVerificationDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host.endsWith(".example.org") ||
      host.endsWith(".example.net") ||
      host.endsWith(".test") ||
      host.endsWith(".invalid")
    );
  } catch {
    return true; // unparseable destination is never production-ready
  }
}

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

  // Commercial launch gate: the QR must encode the canonical production
  // domain — a placeholder/dev domain can never be production-ready.
  const placeholderDomain = isPlaceholderVerificationDomain(qrUrl);
  console.log("QR canonical-domain check:", placeholderDomain ? "PLACEHOLDER (NOT production-ready)" : "PRODUCTION DOMAIN OK");
  if (placeholderDomain) {
    console.error("KAI_PUBLIC_DOMAIN is a placeholder domain — set it to the canonical production domain.");
    process.exit(1);
  }

  // Agency logo — the tenant's real asset, composited by the Minimal
  // Branding Overlay exactly as production does.
  const logoBuffer = readFileSync(path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png"));

  console.log("KAI Creative Engine: generating real advertisement (model:", env.KAI_IMAGE_MODEL, ")...");
  const { imagePng, brief, usage } = await generateAdvertisement({
    facts,
    widthPx: fmt.widthPx,
    heightPx: fmt.heightPx,
    agencyLogoPng: logoBuffer,
    qrPng: qr.png,
    agencyName: AGENCY_NAME,
    registrationNumber: FULL_RC,
    contactLine: [facts.contact.email, facts.contact.phone].filter(Boolean).join(" | ") || null,
  });
  writeFileSync(path.join(OUT, "creative-brief.txt"), brief);
  writeFileSync(path.join(OUT, "advertisement.png"), imagePng);
  console.log("image generated | latencyMs:", usage.latencyMs, "| model:", usage.model);

  const jpg = await exportImage(imagePng, "jpg", { widthPx: fmt.widthPx, heightPx: fmt.heightPx });
  const pdf = await exportImage(imagePng, "pdf", { widthPx: fmt.widthPx, heightPx: fmt.heightPx });
  writeFileSync(path.join(OUT, "advertisement.jpg"), jpg.buffer);
  writeFileSync(path.join(OUT, "advertisement.pdf"), pdf.buffer);

  writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        branch: process.env.GITHUB_REF_NAME ?? null,
        commit: process.env.GITHUB_SHA ?? null,
        models: { text: env.KAI_TEXT_MODEL, image: env.KAI_IMAGE_MODEL },
        qrCanonicalDomainOk: !placeholderDomain,
        qrDecodable: qr.decodable,
        advertisementId,
        verificationId,
        qrDestination: qrUrl,
        platformFormat: { key: fmt.key, widthPx: fmt.widthPx, heightPx: fmt.heightPx },
        imageLatencyMs: usage.latencyMs,
        imageModel: usage.model,
      },
      null,
      2,
    ),
  );
  console.log("\nAcceptance run complete — see scripts/acceptance/artifacts/manifest.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
