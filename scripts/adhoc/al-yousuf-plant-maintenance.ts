import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildAdvertisementDocument } from "@/server/generation/pipeline/advertisement-document";
import { buildAgencyDna } from "@/server/generation/dna/agency-dna";
import { buildCreativeBrief } from "@/server/generation/pipeline/creative-brief";
import { renderAdvertisement } from "@/server/generation/pipeline/generate";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";
import type { DnaPack } from "@/server/generation/dna/design-dna";

/**
 * Real requirement, cleaned per the recruiter's formatting only — no
 * requirement invented or dropped. "Running Plant Maintenance" for six
 * instrumentation/rotary/electrical/mechanical trades is an operating
 * process-plant maintenance scope, not a shutdown/construction one — that
 * distinction drives the OIL_AND_GAS artwork brief below (operational
 * refinery, not turnaround/shutdown).
 */
const facts: AdvertisementFacts = {
  header: "Hiring for Running Plant Maintenance — Saudi Arabia",
  industry: "Oil & Gas",
  country: "Saudi Arabia",
  employer: null,
  projectType: "Running Plant Maintenance",
  positions: [
    { title: "Instrument Technician" },
    { title: "Electrical Technician" },
    { title: "Rotary Equipment Technician" },
    { title: "Mechanical Technician" },
    { title: "Analyzer Technician" },
    { title: "Bolt Torque Technician" },
  ],
  benefits: [],
  interview: [],
  contact: { email: "ai@alyousufent.com" },
  footer: "All applicants must have minimum 5 years relevant experience from their total experience.",
  agencyName: "Al-Yousuf Enterprises LLP",
  raLicenseId: null, // derived by buildAgencyDna from the full registration number below
  fullRegistrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
};

const agency = buildAgencyDna({
  id: "al-yousuf",
  name: "Al-Yousuf Enterprises LLP",
  registrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
  officialEmail: "ai@alyousufent.com",
  phone: null,
  logoUrl: null,
});

const OUT = path.join(process.cwd(), "scripts", "adhoc", "artifacts", "al-yousuf-plant-maintenance");
mkdirSync(OUT, { recursive: true });

interface Direction {
  slug: string;
  pack: DnaPack;
  /**
   * A specific design id, picked on merit against this requirement — not
   * left to selectDna()'s pack-then-hash fallback. That fallback is fine
   * when nothing distinguishes the candidates, but it previously landed
   * "Industrial Recruitment" on OG-02 ("Shutdown Mobilisation"), which is
   * explicitly built for turnarounds — wrong for a job that is a running,
   * operating plant, not a shutdown. `why` records the reasoning so the
   * choice is auditable, not just asserted.
   */
  dnaId: string;
  why: string;
  style: string;
  theme: string;
  /** Forces the AAT_DTP composition — required to actually reach the ASSIGNMENT_ABROAD_DTP
   * pack's DNAs, which are all AAT_DTP-composition; at 6 positions/digital the selector
   * otherwise resolves to PREMIUM_CAMPAIGN and never reaches this pack at all. */
  printOrNewspaper?: boolean;
}

// Three genuinely different creative directions, per the brief. Design DNA
// pack drives the deterministic palette/type-scale/geometry (never the
// image model); style/theme hints steer only the artwork's visual mood.
const DIRECTIONS: Direction[] = [
  {
    slug: "01-corporate-premium",
    pack: "CORPORATE_PREMIUM",
    dnaId: "CP-02",
    why:
      "CP-02 ('Oxford blue, pale accent, rule-led rows — reads like a company document') is the one Corporate " +
      "Premium design explicitly tagged for engineering/technical trades, which is exactly what six technician " +
      "roles are. It gives each role full typographic weight, correct for a lean 6-trade list. Rejected: CP-01 " +
      "is the pack's generic default with no technical tagging; CP-03/CP-07 carry heritage/hospitality motifs " +
      "(antique gold, healthcare) that don't belong on an industrial technician drive; CP-08's alternating row " +
      "bands are built for 8–15 roles, more density than this list needs.",
    style:
      "Swiss minimal editorial layout, generous whitespace, restrained and precise — the visual register of a " +
      "government tender document or an annual report, not a recruitment flyer.",
    theme: "Muted, desaturated, corporate — cool greys and a single restrained accent, no saturated colour blocking.",
  },
  {
    slug: "02-industrial-recruitment",
    pack: "OIL_AND_GAS",
    dnaId: "OG-05",
    why:
      "OG-05 ('multi-discipline EPC packages: banded rows, compact hero, salary column') is explicitly tagged " +
      "for instrumentation and electrical trades — two of our six disciplines — and its multi-discipline framing " +
      "fits a mixed instrument/electrical/rotary/mechanical/analyzer/bolt-torque maintenance crew. Rejected: " +
      "OG-02 is explicitly 'for turnarounds' — this is a running, operating plant, not a shutdown, so that " +
      "design would misrepresent the job; OG-04 targets offshore/marine and OG-07 targets pipeline/terminal " +
      "work, neither of which this requirement is.",
    style:
      "Operational process plant in routine running maintenance — instrumentation racks, pipe racks, analyzer " +
      "shelters, a maintenance technician at work with a torque tool or multimeter. Calm, controlled, everyday " +
      "operations — explicitly NOT a shutdown/turnaround scene (no scaffolding swarms, no crowds, no night " +
      "floodlighting), and explicitly NOT a construction site.",
    theme: "Industrial process-plant palette — steel blues, muted safety-orange accents, natural daylight.",
  },
  {
    slug: "03-assignment-abroad-premium",
    pack: "ASSIGNMENT_ABROAD_DTP",
    dnaId: "AA-06",
    why:
      "AA-06 ('classified structure in petroleum blue and copper — for plant and shutdown drives') is the only " +
      "one of the ten Assignment Abroad designs carrying industry tags at all, and they are oil/gas/" +
      "petrochemical/refinery — a direct match. The other nine (AA-01 house style, AA-04 for 60+ trade density, " +
      "AA-09 narrow bought-slot typographic setting, etc.) are industry-agnostic generalist classifieds with no " +
      "domain fit to defend over AA-06 here.",
    style:
      "Best modern evolution of the classic Gulf-hiring classified — high information density handled with " +
      "restraint and confident typographic hierarchy, immediately legible, built to convert a scrolling " +
      "candidate into a response, not a decorative campaign piece.",
    theme: "Confident, high-contrast, trustworthy — deep ink tones with one clear accent for the call to respond.",
    printOrNewspaper: true,
  },
];

async function main() {
  const env = getEnv();
  const logoPng = readFileSync(path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png"));
  const provider = getImageGenerationProvider();

  for (const dir of DIRECTIONS) {
    console.log(`\n=== ${dir.slug} (${dir.pack} / ${dir.dnaId}) ===`);
    console.log("Why this design:", dir.why);

    const document = buildAdvertisementDocument({
      advertisementId: `al-yousuf-plant-maintenance-${dir.slug}`,
      facts,
      agency,
      format: {
        key: "instagram_portrait",
        widthPx: 1080,
        heightPx: 1350,
        dpi: null,
        printOrNewspaper: Boolean(dir.printOrNewspaper),
      },
      preferredPack: dir.pack,
      preferredDnaId: dir.dnaId,
    });
    console.log("Design DNA:", document.design.dnaId, "—", document.design.dnaReason);

    const brief = await buildCreativeBrief(document.facts, { style: dir.style, theme: dir.theme });
    writeFileSync(path.join(OUT, `${dir.slug}.brief.txt`), brief);

    console.log("Requesting artwork (model:", env.KAI_IMAGE_MODEL, ")...");
    const { output, usage } = await provider.generate({
      prompt: brief,
      widthPx: document.format.widthPx,
      heightPx: document.format.heightPx,
      quality: env.KAI_IMAGE_QUALITY,
    });
    const backgroundPng = Buffer.from(output.imageBase64, "base64");
    console.log("Artwork generated | latencyMs:", usage.latencyMs, "| model:", usage.model);

    const rendered = await renderAdvertisement(document, {
      backgroundPng,
      agencyLogoPng: logoPng,
      qrPng: null,
    });

    writeFileSync(path.join(OUT, `${dir.slug}.png`), rendered.imagePng);
    console.log(
      "Wrote",
      path.join(OUT, `${dir.slug}.png`),
      "| footer:",
      rendered.footerSelection.style,
      "| theme:",
      rendered.themeSelection.theme,
    );
  }

  console.log("\nAll three directions written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
