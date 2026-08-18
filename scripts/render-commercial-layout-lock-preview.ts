import sharp from "sharp";
import { renderFactLayer } from "../src/server/generation/pipeline/fact-layer";
import { applyBrandingOverlay } from "../src/server/generation/pipeline/branding-overlay";
import { assessHeaderZoneVisualWeight } from "../src/server/generation/pipeline/generate";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts } from "../src/server/generation/pipeline/types";
import fs from "node:fs";

const OUT_DIR = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad";

const PLACEHOLDER_AGENCY = {
  agencyName: "Sample Overseas Recruitment Agency LLP",
  registrationNumber: "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000",
  officialPhone: "+00 000 000 0000 (placeholder)",
  officialEmail: "placeholder@example-agency.invalid",
  website: "www.example-agency.invalid",
  addressLine: "Placeholder Address Line, Example City, Example Country",
};

async function bright(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 232, g: 226, b: 205 } } })
    .composite([
      { input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}"><rect x="0" y="${Math.round(heightPx*0.35)}" width="${widthPx}" height="${heightPx}" fill="#cdbf8f"/></svg>`) },
    ])
    .png()
    .toBuffer();
}

async function dark(widthPx: number, heightPx: number): Promise<Buffer> {
  const dots: string[] = [];
  for (let i = 0; i < 50; i++) {
    dots.push(`<circle cx="${Math.round(Math.random()*widthPx)}" cy="${Math.round(Math.random()*heightPx)}" r="${3+Math.random()*5}" fill="#ffd77a" opacity="0.6"/>`);
  }
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 12, g: 15, b: 20 } } })
    .composite([{ input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}">${dots.join("")}</svg>`) }])
    .png()
    .toBuffer();
}

async function mixedWithMachinery(widthPx: number, heightPx: number): Promise<Buffer> {
  // Bright sky top band (flat) + detailed machinery/crane silhouettes below —
  // exercises both "bright sky" (D) and "dark machinery" (E) in one frame.
  const skyH = Math.round(heightPx * 0.18);
  const shapes: string[] = [];
  shapes.push(`<rect x="0" y="0" width="${widthPx}" height="${skyH}" fill="#dce7f2"/>`);
  for (let i = 0; i < 5; i++) {
    const x = Math.round((i / 5) * widthPx) + 30;
    shapes.push(`<rect x="${x}" y="${skyH}" width="10" height="${Math.round(heightPx*0.3)}" fill="#1a1a1a"/>`);
    shapes.push(`<line x1="${x}" y1="${skyH+20}" x2="${x+180}" y2="${skyH+60}" stroke="#1a1a1a" stroke-width="6"/>`);
  }
  return sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: { r: 90, g: 95, b: 100 } } })
    .composite([{ input: Buffer.from(`<svg width="${widthPx}" height="${heightPx}">${shapes.join("")}</svg>`) }])
    .png()
    .toBuffer();
}

async function placeholderLogo(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 220, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: Buffer.from(`<svg width="400" height="220"><circle cx="200" cy="110" r="90" fill="none" stroke="#0B1F33" stroke-width="18"/><text x="200" y="122" font-size="48" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#0B1F33">EX</text></svg>`) }])
    .png()
    .toBuffer();
}

async function placeholderQr(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: Buffer.from(`<svg width="300" height="300">${Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>((r+c)%3===0?`<rect x="${c*30}" y="${r*30}" width="30" height="30" fill="#000"/>`:"")).join("")).join("")}</svg>`) }])
    .png()
    .toBuffer();
}

function realFacts(): AdvertisementFacts {
  return {
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
}

async function renderCase(name: string, widthPx: number, heroFn: (w: number, h: number) => Promise<Buffer>) {
  const facts = realFacts();
  const factResult = await renderFactLayer({ facts, widthPx, heightPx: widthPx });
  const heroBg = await heroFn(widthPx, factResult.heightPx);
  const headerZoneHasStrongSubject = await assessHeaderZoneVisualWeight(heroBg, widthPx);

  const factResultWithSignal = await renderFactLayer({
    facts,
    widthPx,
    heightPx: widthPx,
    headerZoneHasStrongSubject,
  });

  const merged = await sharp(heroBg)
    .resize(widthPx, factResultWithSignal.heightPx)
    .composite([{ input: factResultWithSignal.png, left: 0, top: 0 }])
    .png()
    .toBuffer();

  const withFooter = await applyBrandingOverlay({
    imagePng: merged,
    widthPx,
    heightPx: factResultWithSignal.heightPx,
    ...PLACEHOLDER_AGENCY,
    agencyLogoPng: await placeholderLogo(),
    qrPng: await placeholderQr(),
  });

  const outPath = `${OUT_DIR}/layout-lock-${name}.png`;
  fs.writeFileSync(outPath, withFooter);
  console.log(name, "-> headerZoneHasStrongSubject:", headerZoneHasStrongSubject, "canvas", widthPx, "x", factResultWithSignal.heightPx, "->", outPath);
}

async function main() {
  await renderCase("bright-flat-sky", 1080, bright);
  await renderCase("dark-scattered-lights", 1080, dark);
  await renderCase("mixed-sky-and-machinery", 1080, mixedWithMachinery);
  // Wide footer, long agency name / registration / address, using the
  // real dataset again at a wide canvas.
  await renderCase("wide-1600", 1600, mixedWithMachinery);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
