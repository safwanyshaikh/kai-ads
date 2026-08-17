import sharp from "sharp";
import { renderFactLayer } from "../src/server/generation/pipeline/fact-layer";
import { applyBrandingOverlay } from "../src/server/generation/pipeline/branding-overlay";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts } from "../src/server/generation/pipeline/types";
import fs from "node:fs";

const OUT_DIR =
  "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad";

async function syntheticHero(widthPx: number, heightPx: number, kind: "bright" | "dark" | "mixed"): Promise<Buffer> {
  if (kind === "bright") {
    // Stand-in for a bright desert/sky construction photo — pale sand and
    // near-white sky tones, the worst case for text contrast.
    return sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 235, g: 225, b: 200 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="${widthPx}" height="${heightPx}"><rect x="0" y="${Math.round(heightPx * 0.4)}" width="${widthPx}" height="${heightPx}" fill="#d8cba0"/><rect x="${Math.round(widthPx * 0.2)}" y="${Math.round(heightPx * 0.3)}" width="${Math.round(widthPx * 0.05)}" height="${Math.round(heightPx * 0.35)}" fill="#8a8a8a"/></svg>`,
          ),
        },
      ])
      .png()
      .toBuffer();
  }
  if (kind === "dark") {
    // Stand-in for a dusk/night industrial photo — dark navy/charcoal with
    // scattered bright work-lights.
    const base = sharp({
      create: { width: widthPx, height: heightPx, channels: 3, background: { r: 15, g: 18, b: 24 } },
    });
    const dots: string[] = [];
    for (let i = 0; i < 40; i++) {
      const x = Math.round(Math.random() * widthPx);
      const y = Math.round(Math.random() * heightPx);
      dots.push(`<circle cx="${x}" cy="${y}" r="${3 + Math.random() * 6}" fill="#ffd77a" opacity="0.6"/>`);
    }
    return base
      .composite([{ input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}">${dots.join("")}</svg>`) }])
      .png()
      .toBuffer();
  }
  // Mixed-detail — a busy crane/scaffolding silhouette pattern, alternating
  // light and dark bands to simulate high local contrast.
  const bands: string[] = [];
  for (let y = 0; y < heightPx; y += 24) {
    const shade = y % 48 === 0 ? "#7a8a99" : "#2c3844";
    bands.push(`<rect x="0" y="${y}" width="${widthPx}" height="24" fill="${shade}"/>`);
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.round((i / 12) * widthPx);
    bands.push(`<rect x="${x}" y="0" width="6" height="${heightPx}" fill="#111820"/>`);
  }
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 100, g: 110, b: 120 } } })
    .composite([{ input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}">${bands.join("")}</svg>`) }])
    .png()
    .toBuffer();
}

async function main() {
  const facts: AdvertisementFacts = {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas — Maintenance Project",
    country: "Saudi Arabia",
    employer: "Saudi Aramco Maintenance Project",
    positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
      title: p.title,
      count: p.count,
      experience: p.experience ?? undefined,
      qualification: p.qualification ?? undefined,
      certifications: p.certifications,
    })),
    benefits: [
      { label: "Free Food & Accommodation" },
      { label: "Free Air Ticket" },
      { label: "Medical Insurance" },
    ],
    interview: [],
    contact: { phone: "+91 98765 43210", email: "recruitment@example-agency.com" },
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };

  const widthPx = 1080;
  const heightPx = 1080;

  const factResult = await renderFactLayer({ facts, widthPx, heightPx });
  console.log("Fact layer:", { heightPx: factResult.heightPx, artworkHeightPx: factResult.artworkHeightPx });

  // Simple placeholder agency logo + QR — visual proof assets only, not
  // committed. A verified logo/QR would come from storage in production.
  const logoPng = await sharp({
    create: { width: 400, height: 220, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="400" height="220"><circle cx="200" cy="110" r="90" fill="none" stroke="#0B1F33" stroke-width="18"/><text x="200" y="122" font-size="52" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#0B1F33">AY</text></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
  const qrPng = await sharp({
    create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="300" height="300">${Array.from({ length: 10 }, (_, r) =>
            Array.from({ length: 10 }, (_, c) =>
              (r + c) % 3 === 0 ? `<rect x="${c * 30}" y="${r * 30}" width="30" height="30" fill="#000"/>` : "",
            ).join(""),
          ).join("")}</svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();

  for (const kind of ["bright", "dark", "mixed"] as const) {
    const hero = await syntheticHero(widthPx, factResult.heightPx, kind);
    // Composite the fact layer's own PNG (which has its own transparency
    // where it draws nothing) over the synthetic hero, standing in for
    // Gemini's artwork the way generate.ts actually layers them.
    const merged = await sharp(hero)
      .resize(widthPx, factResult.heightPx)
      .composite([{ input: factResult.png, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const withFooter = await applyBrandingOverlay({
      imagePng: merged,
      widthPx,
      heightPx: factResult.heightPx,
      agencyName: "Al-Yousuf Enterprises L.L.P.",
      registrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
      officialPhone: "+971 4 123 4567",
      officialEmail: "info@alyousufenterprises.com",
      website: "www.alyousufenterprises.com",
      addressLine: "Office 12, Deira Business Tower, Dubai, UAE",
      agencyLogoPng: logoPng,
      qrPng,
    });

    const outPath = `${OUT_DIR}/commercial-lock-${kind}.png`;
    fs.writeFileSync(outPath, withFooter);
    console.log("written", outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
