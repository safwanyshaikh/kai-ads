import sharp from "sharp";
import { renderFactLayer } from "../src/server/generation/pipeline/fact-layer";
import { applyBrandingOverlay } from "../src/server/generation/pipeline/branding-overlay";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts } from "../src/server/generation/pipeline/types";
import fs from "node:fs";

const OUT_DIR =
  "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad";

/**
 * Placeholder-labelled agency identity for VISUAL ACCEPTANCE ONLY — not
 * a real agency's data. Per the Final Footer Identity Pass instructions,
 * production data must come only from the verified Agency Profile.
 */
const PLACEHOLDER_AGENCY = {
  agencyName: "Sample Overseas Recruitment Agency LLP",
  registrationNumber: "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000",
  officialPhone: "+00 000 000 0000 (placeholder)",
  officialEmail: "placeholder@example-agency.invalid",
  website: "www.example-agency.invalid",
  addressLine: "Placeholder Address Line, Example City, Example Country",
};

async function syntheticHero(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 150, g: 150, b: 150 } } })
    .png()
    .toBuffer();
}

async function placeholderLogo(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 220, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      {
        input: Buffer.from(
          `<svg width="400" height="220"><circle cx="200" cy="110" r="90" fill="none" stroke="#0B1F33" stroke-width="18"/><text x="200" y="122" font-size="48" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#0B1F33">EX</text></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
}

async function placeholderQr(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
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
}

async function renderCase(name: string, widthPx: number) {
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
    benefits: [{ label: "Free Food & Accommodation" }, { label: "Free Air Ticket" }, { label: "Medical Insurance" }],
    interview: [],
    contact: { phone: "+91 98765 43210", email: "recruitment@example-agency.com" },
    agencyName: PLACEHOLDER_AGENCY.agencyName,
    fullRegistrationNumber: PLACEHOLDER_AGENCY.registrationNumber,
  };

  const factResult = await renderFactLayer({ facts, widthPx, heightPx: widthPx });
  const hero = await syntheticHero(widthPx, factResult.heightPx);
  const merged = await sharp(hero)
    .resize(widthPx, factResult.heightPx)
    .composite([{ input: factResult.png, left: 0, top: 0 }])
    .png()
    .toBuffer();

  const withFooter = await applyBrandingOverlay({
    imagePng: merged,
    widthPx,
    heightPx: factResult.heightPx,
    ...PLACEHOLDER_AGENCY,
    agencyLogoPng: await placeholderLogo(),
    qrPng: await placeholderQr(),
  });

  const outPath = `${OUT_DIR}/footer-identity-${name}.png`;
  fs.writeFileSync(outPath, withFooter);
  console.log(name, "->", outPath, "canvas", widthPx, "x", factResult.heightPx);
}

async function main() {
  // 1. Standard advertisement footer (a compact, roughly 6x8-class canvas
  // proportion by width).
  await renderCase("standard", 800);
  // 2. Wide footer — substantial horizontal space, where the identity
  // pass's two-column composition should actually engage.
  await renderCase("wide", 1600);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
