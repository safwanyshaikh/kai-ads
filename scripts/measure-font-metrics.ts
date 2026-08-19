import "../src/server/generation/font-config";
import sharp from "sharp";

/**
 * Provenance for the measured advance-width factors in
 * src/lib/kdl-typography.ts.
 *
 * Rasterizes each bundled KDL role face through the same librsvg the
 * renderers draw with, and divides real ink width by
 * (characters x fontSize). The planner's width estimate has to match
 * what the renderer really draws (Final Production Lock §9 geometry
 * parity) — a factor guessed by eye is exactly how a wrapped line
 * escapes the row the planner reserved for it.
 *
 * Re-run this after changing or adding a bundled face, and round the
 * result UP into TYPE_ROLE: over-reserving costs a little space,
 * under-reserving causes overlap.
 *
 *   npx tsx scripts/measure-font-metrics.ts
 */
const SAMPLES = [
  { label: "upper", text: "HVAC TECHNICIAN SUPERVISOR" },
  { label: "mixed", text: "Registered Address Mumbai" },
  { label: "digits", text: "127 45 25 10 7 5 2 1" },
];

const FACES = [
  { family: "KaiDisplay", weights: [400] },
  { family: "KaiHeader", weights: [500, 600, 700] },
  { family: "KaiPosition", weights: [600, 700] },
  { family: "KaiNumeric", weights: [400] },
  { family: "KaiFine", weights: [400, 700] },
  { family: "KaiSans", weights: [400, 700] },
];

async function inkWidth(text: string, family: string, weight: number, size: number): Promise<number> {
  const W = 4000;
  const H = Math.round(size * 3);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#fff"/>` +
    `<text x="10" y="${Math.round(size * 1.6)}" font-family="${family}, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="#000">${text.replace(/&/g, "&amp;")}</text>` +
    `</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels] < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  return maxX < 0 ? 0 : maxX - minX + 1;
}

async function main() {
  const size = 60;
  for (const face of FACES) {
    for (const weight of face.weights) {
      const out: string[] = [];
      for (const s of SAMPLES) {
        const w = await inkWidth(s.text, face.family, weight, size);
        out.push(`${s.label}=${(w / (s.text.length * size)).toFixed(3)}`);
      }
      console.log(`${face.family.padEnd(12)} w${weight}  ${out.join("  ")}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
