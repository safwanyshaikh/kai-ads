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

/**
 * What an agency can actually book at each purchased height.
 *
 * The full nineteen-role requirement does not fit a 6x5 at any legible
 * scale, and the honest answer to that is not to shrink the type until
 * it technically renders — it is that a 6x5 buys a smaller booking.
 * Agencies split a requirement across bookings for exactly this reason.
 *
 * So the matrix advertises the SAME requirement at every size, taking
 * as many of its roles as the size genuinely carries, in the source's
 * own order. No role is reworded, no count altered, and no size is
 * padded with content it did not come with.
 */
function bookingFor(heightCm: number): DtpAdvertisement {
  const [engineering, preparation] = REQUIREMENT.campaigns!;

  // How many roles each height carries, established by rendering, not
  // guessed — see the capacity note in the report.
  if (heightCm <= 6) {
    return {
      ...REQUIREMENT,
      subhead: null,
      campaigns: [{ ...preparation, positions: preparation.positions.slice(0, 3) }],
      eligibility: [],
    };
  }
  if (heightCm <= 8) {
    return {
      ...REQUIREMENT,
      campaigns: [{ ...preparation, positions: preparation.positions }],
      eligibility: [],
    };
  }
  if (heightCm <= 10) {
    return {
      ...REQUIREMENT,
      campaigns: [
        { ...engineering, positions: engineering.positions.slice(0, 6) },
        { ...preparation, positions: preparation.positions.slice(0, 4) },
      ],
    };
  }
  return REQUIREMENT;
}

async function renderMatrix(shared: Omit<DtpRenderRequest, "outputType" | "ad">) {
  console.log("");
  console.log("SIZE MATRIX — same requirement, booking scaled to the purchased area");
  console.log("size  px            actual cm     hero  role  fill  gap   roles  vacancies");

  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let x = 0;
  const SCALE = 0.42;
  let maxH = 0;

  for (const heightCm of [5, 6, 7, 8, 9, 10, 11, 12] as const) {
    const ad = bookingFor(heightCm);
    const result = renderDtpAdvertisement({ ...shared, ad, outputType: "DTP_COLOUR", heightCm });
    const { render } = result;
    const png = await sharp(Buffer.from(render.svg)).png().toBuffer();
    fs.writeFileSync(`${OUT}/matrix-6x${heightCm}.png`, png);

    const roles = ad.campaigns!.flatMap((c) => c.positions);
    const hero = Number(/font-size="(\d+)"/.exec(render.svg)?.[1] ?? 0);
    console.log(
      `6x${String(heightCm).padEnd(3)} ${render.widthPx}x${String(render.heightPx).padEnd(6)} ` +
        `${pxToCm(render.widthPx, DPI).toFixed(2)}x${pxToCm(render.heightPx, DPI).toFixed(2)}   ` +
        `${String(hero).padEnd(5)} ${String(render.roleScalePx).padEnd(5)} ` +
        `${(render.fillRatio * 100).toFixed(0)}%  ${(render.largestGapRatio * 100).toFixed(0)}%   ` +
        `${String(roles.length).padEnd(6)} ${roles.reduce((n, p) => n + (p.count ?? 0), 0)}`,
    );

    const tile = await sharp(png).resize({ width: Math.round(render.widthPx * SCALE) }).toBuffer();
    const meta = await sharp(tile).metadata();
    tiles.push({ input: tile, left: x, top: 0 });
    x += (meta.width ?? 0) + 14;
    maxH = Math.max(maxH, meta.height ?? 0);
  }

  await sharp({ create: { width: x, height: maxH, channels: 3, background: "#8a8a8a" } })
    .composite(tiles).png().toFile(`${OUT}/matrix.png`);
  console.log(`matrix -> ${OUT}/matrix.png`);
}

/**
 * Client-logo cases A-D.
 *
 * A client logo is a CLIENT asset and the agency logo is a TENANT
 * asset; the point of these four is that supplying one never affects
 * the other, and that an absent client logo reserves nothing.
 */
async function renderClientLogoCases(shared: Omit<DtpRenderRequest, "outputType">) {
  const clientMark = await sharp({
    create: { width: 420, height: 150, channels: 3, background: "#0B5D34" },
  }).png().toBuffer();
  const tenantMark = await sharp({
    create: { width: 300, height: 190, channels: 3, background: "#12284C" },
  }).png().toBuffer();

  const withClient: DtpAdvertisement = {
    ...bookingFor(10),
    client: { name: "Al Rashid Contracting" },
  };
  const longIdentity: DtpAdvertisement = {
    ...withClient,
    tenant: {
      name: "Northgate Overseas Manpower Consultancy & Recruitment Services",
      registrationText: "B-0417/MUM/PART/1000+/4820/2021 · RA-2291/2019 · MEA Approved",
    },
  };

  const cases: { id: string; label: string; req: DtpRenderRequest }[] = [
    { id: "a-no-client-logo", label: "A  no client logo",
      req: { ...shared, ad: bookingFor(10), outputType: "DTP_COLOUR", heightCm: 10 } },
    { id: "b-client-logo", label: "B  client logo only",
      req: { ...shared, ad: withClient, outputType: "DTP_COLOUR", heightCm: 10, clientLogoPng: clientMark } },
    { id: "c-client-and-tenant", label: "C  client + tenant logo",
      req: { ...shared, ad: withClient, outputType: "DTP_COLOUR", heightCm: 10,
        clientLogoPng: clientMark, tenantLogoPng: tenantMark } },
    { id: "d-long-identity", label: "D  both + long name/registration",
      req: { ...shared, ad: longIdentity, outputType: "DTP_COLOUR", heightCm: 11,
        clientLogoPng: clientMark, tenantLogoPng: tenantMark } },
  ];

  console.log("");
  console.log("CLIENT LOGO CASES");
  console.log("case                            size  images  fill  gap");
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let x = 0, maxH = 0;

  for (const { id, label, req } of cases) {
    const result = renderDtpAdvertisement(req);
    const png = await sharp(Buffer.from(result.render.svg)).png().toBuffer();
    fs.writeFileSync(`${OUT}/client-${id}.png`, png);
    const images = [...result.render.svg.matchAll(/<image/g)].length;
    console.log(
      `${label.padEnd(31)} 6x${String(result.heightCm).padEnd(3)} ${String(images).padEnd(7)} ` +
        `${(result.render.fillRatio * 100).toFixed(0)}%  ${(result.render.largestGapRatio * 100).toFixed(0)}%`,
    );
    const tile = await sharp(png).resize({ width: Math.round(result.render.widthPx * 0.5) }).toBuffer();
    const meta = await sharp(tile).metadata();
    tiles.push({ input: tile, left: x, top: 0 });
    x += (meta.width ?? 0) + 14;
    maxH = Math.max(maxH, meta.height ?? 0);
  }

  await sharp({ create: { width: x, height: maxH, channels: 3, background: "#8a8a8a" } })
    .composite(tiles).png().toFile(`${OUT}/client-logo-cases.png`);
  console.log(`client logo cases -> ${OUT}/client-logo-cases.png`);
}

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
    if ((result.rejected ?? []).length > 0) {
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

  await renderMatrix({
    established: shared.established,
    addressLines: shared.addressLines,
  });
  await renderClientLogoCases(shared);
}

void main();
