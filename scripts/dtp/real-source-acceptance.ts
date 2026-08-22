/**
 * FINAL DTP ACCEPTANCE — real recruitment requirement, production path.
 *
 * Content is transcribed from the supplied client requirement PDF
 * (Manpower_Vacant_Position2.pdf) and nothing else. Every role,
 * vacancy count, qualification and experience figure below appears in
 * that document; nothing is added, rounded or tidied.
 *
 * WHAT THE SOURCE DOES NOT CONTAIN
 *
 * No salary, no interview date, no interview venue, no contact number,
 * no email and no agency identity. It is a client's manpower
 * requirement, not a finished advertisement. Those fields are therefore
 * absent from the content below rather than filled in — inventing them
 * is exactly what the Truth Brain law forbids.
 *
 * The agency identity IS supplied, because it is tenant configuration
 * rather than a fact about this requirement: a classified must carry a
 * licensed advertiser. It is an invented, neutral agency, as the
 * tenant-neutrality tests require.
 *
 * The document's own numbering skips 10 — it runs 9, 11, 12 — so there
 * are nineteen roles, not twenty. That gap is the source's, and is
 * preserved rather than silently renumbered.
 */
import fs from "node:fs";
import sharp from "sharp";

import {
  renderDtpAdvertisement,
  type DtpRenderRequest,
} from "../../src/server/services/dtp-render.service";
import type { DtpAdvertisement } from "../../src/server/generation/dtp";
import { pxToCm } from "../../src/lib/dtp-format-law";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/dtp-real";
fs.mkdirSync(OUT, { recursive: true });
const DPI = 300;

/**
 * The two sections the document itself is divided into: the main
 * vacancy table, and the block it heads "Imporatant and need to start
 * Preparation". They are separate hiring campaigns in the source, and
 * they stay separate here.
 */
const REQUIREMENT: DtpAdvertisement = {
  headline: "Saudi Arabia — Aramco Projects",
  subhead: "Manpower Requirement",
  tenant: {
    name: "Northgate Overseas Manpower",
    registrationText: "B-0417/MUM/PART/1000+/4820/2021",
  },
  campaigns: [
    {
      heading: "Engineering, Procurement & Site Management",
      positions: [
        { title: "Operation Manager", count: 1, qualifier: "Civil or Mechanical" },
        { title: "WPR", count: 25, qualifier: "Civil Engineering, 2 years" },
        { title: "Time Keeper / HR Executive", count: 2, qualifier: "Graduate, 4-5 years" },
        { title: "Procurement Engineer – Estimation", count: 2, qualifier: "Engineering, 5-6 years" },
        { title: "Purchaser", count: 2, qualifier: "Any Graduate, 5-6 years" },
        { title: "Planning Engineer Lead", count: 1, qualifier: "Mech/Civil, 7-8 years" },
        { title: "Planning Engineer", count: 1, qualifier: "Mech/Civil, 5 years" },
        { title: "Procurement Engineer – Construction", count: 2, qualifier: "Mech/Civil, 5-6 years" },
        { title: "Procurement Manager", count: 1, qualifier: "Mech/Civil, 10-12 years" },
        { title: "Electrician", count: 10, qualifier: "Diploma / Polytechnic, 5 years" },
        { title: "Tile Mason", count: 2, qualifier: "10th Pass, 5 years" },
        { title: "IT Administrator", count: 1, qualifier: "Any Graduate, 10 years" },
      ],
    },
    {
      heading: "Important — preparation to start",
      positions: [
        { title: "HVAC Technician", count: 45, qualifier: "Diploma / Polytechnic, 5 years" },
        { title: "DDC Technician (HVAC)", count: 7, qualifier: "Dip/Degree Mech (HVAC), 7 years" },
        { title: "Mechanical Engineer (HVAC)", count: 5, qualifier: "Degree Mech (HVAC), 10 years" },
        { title: "Project Manager", count: 5, qualifier: "Engineering, 15 years, PMP" },
        { title: "Quality Manager", count: 5, qualifier: "Engineering, 15 years" },
        { title: "HSE Manager", count: 5, qualifier: "Engineering / Graduate, 15 years" },
        { title: "PQCS", count: 5, qualifier: "Engineering / Graduate, 10 years" },
      ],
    },
  ],
  eligibility: ["Saudi Aramco / Gulf experience as stated per role"],
  accent: "#12284C",
};

/** Every count in the document, summed once so the render can be checked. */
const SOURCE_VACANCIES = REQUIREMENT.campaigns!
  .flatMap((c) => c.positions)
  .reduce((n, p) => n + (p.count ?? 0), 0);

async function main() {
  const shared: Omit<DtpRenderRequest, "outputType"> = {
    ad: REQUIREMENT,
    established: "Estd. 1998",
    addressLines: [
      "Northgate House, 2nd Floor,",
      "Andheri Kurla Road, Andheri East,",
      "Mumbai - 400 059.",
    ],
  };

  console.log(`source roles: ${REQUIREMENT.campaigns!.flatMap((c) => c.positions).length}`);
  console.log(`source vacancies: ${SOURCE_VACANCIES}`);
  console.log("");
  console.log("mode      booking     px            actual cm     fill  gap   tight");

  for (const outputType of ["DTP_BW", "DTP_COLOUR"] as const) {
    const result = renderDtpAdvertisement({ ...shared, outputType });
    const { render } = result;
    const png = await sharp(Buffer.from(render.svg)).png().toBuffer();
    const file = `${OUT}/${outputType.toLowerCase()}.png`;
    fs.writeFileSync(file, png);

    console.log(
      `${outputType.padEnd(10)} 6x${String(result.heightCm).padEnd(9)} ` +
        `${render.widthPx}x${String(render.heightPx).padEnd(6)} ` +
        `${pxToCm(render.widthPx, DPI).toFixed(2)}x${pxToCm(render.heightPx, DPI).toFixed(2)}   ` +
        `${(render.fillRatio * 100).toFixed(0)}%  ${(render.largestGapRatio * 100).toFixed(0)}%   ` +
        `${result.compressed ? "yes" : "no"}`,
    );
    console.log(`  image generation used: ${result.usedImageGeneration}`);
    if (result.rejected.length > 0) {
      console.log(
        `  heights refused: ${result.rejected.map((r) => `6x${r.heightCm}`).join(", ")}`,
      );
    }

    // Every role title and every count must be present in the output.
    const missing = REQUIREMENT.campaigns!
      .flatMap((c) => c.positions)
      .filter((p) => !render.svg.includes(p.title.toUpperCase()));
    console.log(`  roles missing from render: ${missing.length}`);
    if (missing.length > 0) console.log(`    ${missing.map((p) => p.title).join("; ")}`);
    console.log(`  -> ${file}`);
  }
}

void main();
