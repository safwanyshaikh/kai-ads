/**
 * REAL CAMPAIGN ACCEPTANCE RUNNER
 *
 * Proves the complete recruiter journey against REAL providers:
 *
 *   real tenant -> real vacancy -> requirement intelligence ->
 *   creative brief (real text model) -> real image model ->
 *   KAI rendering -> factual validation -> preview -> approval ->
 *   PNG/JPG/PDF export -> verification/QR
 *
 * docs/010: "The certification benchmark must generate real
 * advertisements using the production pipeline. Only those
 * advertisements are valid evidence."
 *
 * FAIL-CLOSED BY DESIGN
 * ---------------------
 * This runner REFUSES to start unless a real text provider and a real
 * image provider are configured. It never falls back to a stub, never
 * substitutes deterministic artwork, and never fabricates model output.
 * An acceptance run that quietly produced synthetic evidence would be
 * worse than no acceptance run, because the artefacts would look real.
 *
 * REQUIRED ENVIRONMENT
 *   GEMINI_IMAGE_API_KEY   image model (required)
 *   GEMINI_TEXT_API_KEY    text model (takes priority), or
 *   OPENAI_API_KEY         text model (used when the Gemini text key is absent)
 *   KAI_IMAGE_MODEL        image model name
 *   DATABASE_URL           a reachable database
 *   BETTER_AUTH_SECRET, EMAIL_PROVIDER, STORAGE_PROVIDER
 *
 * Secrets are never printed, logged or persisted by this script — only
 * the PRESENCE of a provider is reported.
 *
 * Usage:  npx tsx scripts/acceptance/real-campaign-acceptance.ts
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getIntegrationStatus } from "@/lib/env";
import { getTextGenerationProvider } from "@/server/ai/text";
import { getImageGenerationProvider } from "@/server/ai/image";
import { db } from "@/lib/db";
import { agencyService } from "@/server/services/agency.service";
import { advertisementService } from "@/server/services/advertisement.service";
import { advertisementGenerationService } from "@/server/services/advertisement-generation.service";
import { exportImage, buildExportFilename, type ExportFormat } from "@/server/generation/image-export.service";
import { getPlatformFormat } from "@/lib/platform-formats";
import { MANPOWER_REAL_FACTS_POSITIONS } from "../../tests/fixtures/manpower-vacant-position-real";

const OUT_DIR = process.env.ACCEPTANCE_OUT_DIR ?? "/tmp/kai-acceptance";

function heading(text: string): void {
  console.log(`\n${"=".repeat(64)}\n${text}\n${"=".repeat(64)}`);
}

/**
 * Refuses to proceed on stub providers. This is the guard that keeps an
 * acceptance artefact honest.
 */
function assertRealProviders(): { text: string; image: string } {
  const status = getIntegrationStatus();

  const textProvider = status.geminiText ? "GeminiTextProvider" : status.openai ? "OpenAiTextProvider" : null;
  const imageProvider = status.geminiImage ? "KaiGeminiImageProvider" : null;

  const missing: string[] = [];
  if (!textProvider) missing.push("a text model (set GEMINI_TEXT_API_KEY or OPENAI_API_KEY)");
  if (!imageProvider) missing.push("an image model (set GEMINI_IMAGE_API_KEY)");

  if (missing.length > 0) {
    console.error(
      `\nACCEPTANCE BLOCKED — no real AI provider configured.\n\n` +
        `Missing: ${missing.join("; ")}\n\n` +
        `This runner will not substitute a stub provider, deterministic\n` +
        `artwork, or fabricated model output. Supply real credentials and\n` +
        `re-run; nothing else about the pipeline needs to change.\n`,
    );
    process.exit(2);
  }

  // Cross-check the resolved instances, so a mis-wired factory cannot
  // pass the env check and then hand back a stub anyway.
  const t = getTextGenerationProvider().constructor.name;
  const i = getImageGenerationProvider().constructor.name;
  if (t.startsWith("NotImplemented") || i.startsWith("NotImplemented")) {
    console.error(`\nACCEPTANCE BLOCKED — provider factory returned a stub (text=${t}, image=${i}).\n`);
    process.exit(2);
  }

  return { text: t, image: i };
}

async function main(): Promise<void> {
  heading("STEP 0 — provider preflight");
  const providers = assertRealProviders();
  console.log(`text model provider : ${providers.text}`);
  console.log(`image model provider: ${providers.image}`);
  console.log(`image model name    : ${process.env.KAI_IMAGE_MODEL ?? "(env default)"}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const suffix = randomUUID().slice(0, 8);
  const domain = `acceptance-${suffix}.example`;
  let agencyId = "";

  try {
    heading("STEP 1 — real tenant onboarding");
    const agency = await agencyService.register({
      name: `Acceptance Overseas ${suffix}`,
      registrationNumber: `B-${suffix}/DEL/PER/1000+/9/2026`,
      website: `https://${domain}`,
      officialEmail: `admin@${domain}`,
      logoUrl: "https://cdn.example.invalid/logo.png",
    });
    agencyId = agency.id;
    const admin = await db.user.findFirst({ where: { agencyId } });
    if (!admin) throw new Error("agency admin was not created");
    await agencyService.approve(agencyId, admin.id);

    await db.agency.update({
      where: { id: agencyId },
      data: {
        fullRegistrationNumber: `B-${suffix}/DEL/PER/1000+/9/2026`,
        meaRegistrationText: "MEA Registered",
        phone: "+91 11 4000 2020",
        officeAddress: "8 Harbour Lane, New Delhi 110001",
      },
    });
    console.log(`tenant approved: ${agencyId}`);

    heading("STEP 2 — real vacancy (accepted manpower requirement fixture)");
    const positions = MANPOWER_REAL_FACTS_POSITIONS;
    const totalVacancies = positions.reduce((n, p) => n + (p.count ?? 0), 0);
    console.log(`roles: ${positions.length}, vacancies: ${totalVacancies}`);

    const ad = await advertisementService.create(agencyId, admin.id, {
      header: "Urgent Requirement — Saudi Arabia",
      country: "Saudi Arabia",
      industry: "Oil & Gas",
      style: "VISUAL",
      positions: positions.map((p) => ({
        title: p.title,
        count: p.count ?? undefined,
        experience: p.experience ?? undefined,
        qualifications: p.qualification ? [p.qualification] : undefined,
      })),
      benefits: [],
      interview: {},
      contact: { phone: "+91 90000 11111", email: `jobs@${domain}` },
    });
    console.log(`advertisement: ${ad.id} (${ad.status})`);

    heading("STEP 3 — generation through the production pipeline");
    console.log("requirement intelligence -> creative brief -> text model -> image model -> rendering");
    const generated = await advertisementGenerationService.generate(ad.id, agencyId, admin.id, { outputFormat: "SOCIAL" as const, platformFormat: "generic_portrait", });
    console.log("generation returned:", JSON.stringify(generated).slice(0, 400));

    const stored = await db.advertisement.findUnique({ where: { id: ad.id } });
    if (!stored?.generatedAssetUrl) throw new Error("generation produced no asset");
    console.log(`trustStatus: ${stored.trustStatus}`);

    heading("STEP 4 — approval");
    await advertisementService.changeStatus(ad.id, agencyId, admin.id, "REVIEW");
    await advertisementService.changeStatus(ad.id, agencyId, admin.id, "APPROVED");
    console.log("status: APPROVED");

    heading("STEP 5 — export PNG / JPG / PDF");
    // Read the asset exactly as the export route does, including the
    // legacy data: URI case it still supports.
    const assetUrl = stored.generatedAssetUrl;
    let png: Buffer;
    if (assetUrl.startsWith("data:")) {
      const base64 = assetUrl.split(",")[1];
      if (!base64) throw new Error("generated asset is an invalid data URI");
      png = Buffer.from(base64, "base64");
    } else {
      const response = await fetch(assetUrl);
      if (!response.ok) throw new Error(`generated asset could not be retrieved (${response.status})`);
      png = Buffer.from(await response.arrayBuffer());
    }

    // Dimensions come from the stored platform format, same as the route.
    const platformFormat = getPlatformFormat(stored.platformFormat);

    for (const format of ["png", "jpg", "pdf"] as ExportFormat[]) {
      const out = await exportImage(png, format, {
        widthPx: platformFormat.widthPx,
        heightPx: platformFormat.heightPx,
      });
      const name = buildExportFilename({
        country: stored.country,
        industry: stored.industry,
        firstPositionTitle: positions[0]?.title,
        format,
      });
      const file = path.join(OUT_DIR, name);
      fs.writeFileSync(file, out.buffer);
      console.log(`${format.toUpperCase().padEnd(4)} ${out.mimeType.padEnd(16)} ${out.buffer.length} bytes -> ${file}`);
    }

    heading("ACCEPTANCE ARTEFACTS");
    console.log(`Inspect the rendered advertisement(s) in: ${OUT_DIR}`);
    console.log("Visual QA is a human/inspection step — this runner produces the evidence, it does not grade it.");
  } finally {
    if (agencyId) await db.agency.deleteMany({ where: { id: agencyId } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("\nACCEPTANCE FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
