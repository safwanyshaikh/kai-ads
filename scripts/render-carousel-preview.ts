import fs from "node:fs";
import { buildRecruitmentCampaign } from "../src/server/generation/pipeline/content-intelligence";
import { decideSocialProductForFacts, assertSlidePlanIntegrity } from "../src/server/generation/pipeline/social-product-decision";
import { renderSocialCarousel, assertCarouselIntegrity } from "../src/server/generation/pipeline/social-carousel";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "../src/server/generation/pipeline/types";
import sharp from "sharp";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad";

const agencyProfile: VerifiedAgencyProfile = {
  agencyName: "Sample Overseas Recruitment Agency LLP",
  rcNumber: "PLACEHOLDER-RC-0000",
  fullRegistrationNumber: "PLACEHOLDER-RC-0000/EXAMPLE/0000+/0-0/0/0000/0000",
  registeredAddress: "Placeholder Address Line, Example City, Example Country",
  officialPhone: "+00 000 000 0000 (placeholder)",
  officialEmail: "placeholder@example-agency.invalid",
  website: "www.example-agency.invalid",
  verificationStatus: "VERIFIED",
  approvedBadges: [],
};

async function logo() {
  return sharp({ create: { width: 400, height: 220, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: Buffer.from(`<svg width="400" height="220"><circle cx="200" cy="110" r="90" fill="none" stroke="#0B1F33" stroke-width="18"/><text x="200" y="122" font-size="48" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#0B1F33">EX</text></svg>`) }])
    .png().toBuffer();
}
async function qr() {
  return sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: Buffer.from(`<svg width="300" height="300">${Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>((r+c)%3===0?`<rect x="${c*30}" y="${r*30}" width="30" height="30" fill="#000"/>`:"")).join("")).join("")}</svg>`) }])
    .png().toBuffer();
}
async function artwork(w: number, h: number) {
  const shapes: string[] = [`<rect x="0" y="0" width="${w}" height="${Math.round(h*0.2)}" fill="#dce7f2"/>`];
  for (let i = 0; i < 6; i++) {
    const x = Math.round((i / 6) * w) + 30;
    shapes.push(`<rect x="${x}" y="${Math.round(h*0.2)}" width="12" height="${Math.round(h*0.5)}" fill="#1a1a1a"/>`);
    shapes.push(`<line x1="${x}" y1="${Math.round(h*0.22)}" x2="${x+200}" y2="${Math.round(h*0.28)}" stroke="#1a1a1a" stroke-width="7"/>`);
  }
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 92, g: 99, b: 106 } } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}">${shapes.join("")}</svg>`) }])
    .png().toBuffer();
}

async function main() {
  const facts: AdvertisementFacts = {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas — Maintenance Project",
    country: "Saudi Arabia",
    employer: "Saudi Aramco Maintenance Project",
    positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
      title: p.title, count: p.count, experience: p.experience ?? undefined,
      qualification: p.qualification ?? undefined, certifications: p.certifications,
    })),
    benefits: [{ label: "Free Food & Accommodation" }, { label: "Free Air Ticket" }, { label: "Medical Insurance" }],
    interview: [{ date: "5th September 2026", location: "Mumbai" }],
    contact: { phone: "+91 98765 43210", email: "recruitment@example-agency.invalid" },
    agencyName: agencyProfile.agencyName,
    fullRegistrationNumber: agencyProfile.fullRegistrationNumber!,
    agencyProfile,
  };

  const campaign = buildRecruitmentCampaign(MANPOWER_VACANT_POSITION_2);
  const decision = await decideSocialProductForFacts(facts, campaign, 1080, 1350);
  console.log("PRODUCT:", decision.product);
  console.log("REASON :", decision.reason);
  if (!decision.slides) { console.log("single image — nothing to render"); return; }
  assertSlidePlanIntegrity(campaign, decision.slides);

  const art = await artwork(1080, 1440);
  const slides = await renderSocialCarousel({
    facts, campaign, slides: decision.slides, agencyProfile,
    agencyLogoPng: await logo(), qrPng: await qr(), artworkPng: art,
  });
  assertCarouselIntegrity(campaign, slides);

  for (const s of slides) {
    const path = `${OUT}/carousel-${String(s.index).padStart(2,"0")}-${s.kind.toLowerCase()}.png`;
    fs.writeFileSync(path, s.png);
    console.log(`  slide ${s.index} [${s.kind}] ${s.widthPx}x${s.heightPx} roles=${s.positionIndexes.length}  ${path}`);
  }
  const vac = slides.flatMap(s=>s.positionIndexes).reduce((n,i)=>n+(campaign.positions[i].count??0),0);
  console.log(`INTEGRITY: ${slides.flatMap(s=>s.positionIndexes).length}/${campaign.positions.length} roles, ${vac}/${campaign.vacancySummary.totalVacancies} vacancies`);
}
main().catch(e => { console.error(e); process.exit(1); });
