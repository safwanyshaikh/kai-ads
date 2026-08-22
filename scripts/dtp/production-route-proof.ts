/**
 * PRODUCTION ROUTE PROOF.
 *
 * Exercises the real generation service — the same call the API route
 * makes — with the real manpower requirement, once per product.
 *
 * WHAT THIS PROVES, AND WHAT IT CANNOT
 *
 * This sandbox has no storage provider and no image provider, so no
 * request can run to completion here. That is an environment limit,
 * not a code path, and it happens to make an exact discriminator
 * possible: the two engines fail in different places.
 *
 *   DTP    reaches the deterministic compositor, composes the
 *          classified, and stops at STORAGE.
 *   SOCIAL reaches the creative pipeline and stops at the IMAGE
 *          PROVIDER, well before storage.
 *
 * So if a DTP request ever failed with an image-provider error, the
 * routing would be broken and this script would say so. Before the
 * fix, every request took the social path regardless of what was
 * asked for.
 */
import fs from "node:fs";
import sharp from "sharp";

import { db } from "../../src/lib/db";
import { advertisementRepository } from "../../src/server/repositories/advertisement.repository";
import { buildAdvertisementFacts } from "../../src/server/generation/pipeline/requirement-intelligence";
import { dtpAdvertisementFromFacts } from "../../src/server/generation/dtp";
import { renderDtpAdvertisement } from "../../src/server/services/dtp-render.service";
import {
  buildQrTrackingUrl,
  generateAndVerifyQr,
} from "../../src/server/generation/qr-renderer";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/prod";
import { advertisementGenerationService } from "../../src/server/services/advertisement-generation.service";
import type { GenerateAdvertisementInput } from "../../src/lib/validations/advertisement-generation";

/** The real requirement — 19 roles, 127 vacancies. */
const POSITIONS = [
  { title: "Operation Manager", count: 1, qualification: "Civil or Mechanical" },
  { title: "WPR", count: 25, qualification: "Civil Engineering" },
  { title: "Time Keeper / HR Executive", count: 2, qualification: "Graduate" },
  { title: "Procurement Engineer – Estimation", count: 2, qualification: "Engineering" },
  { title: "Purchaser", count: 2, qualification: "Any Graduate" },
  { title: "Planning Engineer Lead", count: 1, qualification: "Mech/Civil" },
  { title: "Planning Engineer", count: 1, qualification: "Mech/Civil" },
  { title: "Procurement Engineer – Construction", count: 2, qualification: "Mech/Civil" },
  { title: "Procurement Manager", count: 1, qualification: "Mech/Civil" },
  { title: "Electrician", count: 10, qualification: "Diploma / Polytechnic" },
  { title: "Tile Mason", count: 2, qualification: "10th Pass" },
  { title: "IT Administrator", count: 1, qualification: "Any Graduate" },
  { title: "HVAC Technician", count: 45, qualification: "Diploma / Polytechnic" },
  { title: "DDC Technician (HVAC)", count: 7, qualification: "Dip/Degree Mech (HVAC)" },
  { title: "Mechanical Engineer (HVAC)", count: 5, qualification: "Degree Mech (HVAC)" },
  { title: "Project Manager", count: 5, qualification: "Engineering, PMP" },
  { title: "Quality Manager", count: 5, qualification: "Engineering" },
  { title: "HSE Manager", count: 5, qualification: "Engineering / Graduate" },
  { title: "PQCS", count: 5, qualification: "Engineering / Graduate" },
];

/** Where a failure happened, so routing can be read off it. */
function stageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/storage is not configured/i.test(message)) return "STORAGE (compositor already ran)";
  if (/image provider|not implemented|GEMINI|OPENAI/i.test(message)) return "IMAGE PROVIDER";
  return `OTHER: ${message.slice(0, 120)}`;
}

async function main() {
  const suffix = Date.now().toString(36);

  const agency = await db.agency.create({
    data: {
      name: "Northgate Overseas Manpower",
      registrationNumber: `B-0417-${suffix}`,
      website: "https://example-agency.test",
      officialEmail: "jobs@example-agency.test",
      logoUrl: "https://example-agency.test/logo.png",
      status: "APPROVED",
      officeAddress: "Northgate House, 2nd Floor, Andheri East, Mumbai - 400 059.",
      phone: "+91 22 4000 1122",
      fullRegistrationNumber: "B-0417/MUM/PART/1000+/4820/2021",
      brandColours: { primary: "#12284C" },
    },
  });

  const user = await db.user.create({
    data: {
      email: `route-proof-${suffix}@example-agency.test`,
      name: "Route Proof",
      agencyId: agency.id,
      role: "AGENCY_ADMIN",
      emailVerified: true,
    },
  });

  const advertisement = await db.advertisement.create({
    data: {
      agencyId: agency.id,
      createdById: user.id,
      status: "DRAFT",
      currentVersion: 1,
      header: "Saudi Arabia — Aramco Projects",
      industry: "Oil & Gas",
      country: "Saudi Arabia",
      employer: "Aramco Projects",
      style: "NEWSPAPER",
      positions: POSITIONS,
      benefits: [],
      interview: [],
      contact: { phone: "+91 22 4000 1122", email: "jobs@example-agency.test" },
    },
  });

  console.log(`roles: ${POSITIONS.length}`);
  console.log(`vacancies: ${POSITIONS.reduce((n, p) => n + p.count, 0)}`);
  console.log("");
  console.log("product        outcome");

  const cases: { label: string; input: GenerateAdvertisementInput }[] = [
    { label: "DTP_BW", input: { outputFormat: "DTP_BW" } },
    { label: "DTP_COLOUR", input: { outputFormat: "DTP_COLOUR" } },
    { label: "DTP_BW 6x8", input: { outputFormat: "DTP_BW", dtpHeightCm: 8 } },
    {
      label: "SOCIAL",
      input: { outputFormat: "SOCIAL", platformFormat: "generic_portrait" },
    },
  ];

  for (const { label, input } of cases) {
    try {
      await advertisementGenerationService.generate(
        advertisement.id, agency.id, user.id, input,
      );
      console.log(`${label.padEnd(14)} COMPLETED`);
    } catch (error) {
      console.log(`${label.padEnd(14)} stopped at ${stageOf(error)}`);
    }
  }

  /**
   * The artifacts, composed from the SAME inputs the service uses.
   *
   * buildAdvertisementFacts and dtpAdvertisementFromFacts are the
   * production adapters, called here on the production database record
   * — the only step not repeated is the upload, which is what the
   * sandbox cannot do.
   */
  const stored = await advertisementRepository.findById(advertisement.id, agency.id);
  const facts = buildAdvertisementFacts(stored!, agency);
  const brandColours = agency.brandColours as { primary?: string } | null;
  const ad = dtpAdvertisementFromFacts(facts, { accent: brandColours?.primary ?? null });

  const qr = await generateAndVerifyQr(
    buildQrTrackingUrl({ agencyVerificationId: "ver_route_proof", advertisementId: advertisement.id }),
  );

  console.log("");
  console.log("artifact          booking   px            roles in render");
  for (const outputType of ["DTP_BW", "DTP_COLOUR"] as const) {
    const rendered = renderDtpAdvertisement({
      outputType, ad,
      verificationQrPng: qr.decodable ? qr.png : null,
      addressLines: agency.officeAddress ? [agency.officeAddress] : undefined,
    });
    const png = await sharp(Buffer.from(rendered.render.svg)).png().toBuffer();
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(`${OUT}/${outputType.toLowerCase()}.png`, png);

    const present = POSITIONS.filter(
      (p) => rendered.render.svg.includes(p.title.toUpperCase()),
    ).length;
    console.log(
      `${outputType.padEnd(17)} 6x${String(rendered.heightCm).padEnd(7)} ` +
        `${rendered.render.widthPx}x${String(rendered.render.heightPx).padEnd(6)} ` +
        `${present}/${POSITIONS.length}`,
    );
  }

  await db.advertisement.deleteMany({ where: { agencyId: agency.id } });
  await db.user.deleteMany({ where: { agencyId: agency.id } });
  await db.agency.delete({ where: { id: agency.id } });
}

void main().finally(() => db.$disconnect());
